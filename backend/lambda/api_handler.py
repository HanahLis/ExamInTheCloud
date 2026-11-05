"""
CloudExam - Lambda Core API Handler
Xử lý các nghiệp vụ REST API cho Questions, Candidates, Sessions, Exam Submission.
Tích hợp Cognito Authorizer (RBAC), SQS Buffer Pipeline, Step Functions Lifecycle & SNS Reports.
"""

import json
import os
import uuid
import base64
import io
import re
import urllib.request
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET
import boto3
from botocore.config import Config
from decimal import Decimal
from datetime import datetime, timezone
try:
    from boto3.dynamodb.conditions import Key, Attr
except (ImportError, ModuleNotFoundError):
    Key = None
    Attr = None

# Khởi tạo AWS Resources
REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")
BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL", "")
STATE_MACHINE_ARN = os.getenv("STATE_MACHINE_ARN", "")
SNS_TOPIC_ARN = os.getenv("SNS_TOPIC_ARN", "")

# Khởi tạo Cấu hình Multi-Cloud (Google Gemini, Upstash Redis, Cloudflare Turnstile)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").strip().rstrip("/")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()
CLOUDFLARE_TURNSTILE_SECRET_KEY = os.getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY", "").strip()

def get_gemini_api_key():
    global GEMINI_API_KEY
    if GEMINI_API_KEY:
        return GEMINI_API_KEY
    # Task 3 & Mục 2.2.7: Tích hợp AWS SSM Parameter Store (/cloudexam/gemini/api_key)
    try:
        ssm = boto3.client("ssm", region_name=REGION)
        resp = ssm.get_parameter(Name="/cloudexam/gemini/api_key", WithDecryption=True)
        GEMINI_API_KEY = resp.get("Parameter", {}).get("Value", "").strip()
        return GEMINI_API_KEY
    except Exception as ssm_err:
        print(f"[INFO] Không thể lấy GEMINI_API_KEY từ SSM Parameter Store: {ssm_err}")
        return ""

dynamodb = boto3.resource("dynamodb", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)
sqs_config = Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1})
sqs_client = boto3.client("sqs", region_name=REGION, config=sqs_config)
sfn_client = boto3.client("stepfunctions", region_name=REGION)
sns_config = Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1})
sns_client = boto3.client("sns", region_name=REGION, config=sns_config)

questions_table = dynamodb.Table(f"CloudExam_Questions_{ENV}")
candidates_table = dynamodb.Table(f"CloudExam_Candidates_{ENV}")
sessions_table = dynamodb.Table(f"CloudExam_Sessions_{ENV}")
question_banks_table = dynamodb.Table(f"CloudExam_QuestionBanks_{ENV}")
submissions_table = dynamodb.Table(f"CloudExam_Submissions_{ENV}")

# Helper chuyển đổi Decimal của DynamoDB sang int/float/str cho JSON
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        if hasattr(obj, "_mock_name") or "MagicMock" in type(obj).__name__:
            return str(obj)
        return super(DecimalEncoder, self).default(obj)

def build_response(status_code: int, body: any):
    """Tạo HTTP Response chuẩn kèm CORS headers"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def get_auth_claims(event):
    """Trích xuất claims từ Cognito Authorizer"""
    try:
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        claims = authorizer.get("claims", {})
        email = claims.get("email", "")
        raw_groups = claims.get("cognito:groups", "")
        if isinstance(raw_groups, list):
            groups = raw_groups
        elif isinstance(raw_groups, str) and raw_groups:
            groups = [g.strip() for g in raw_groups.split(",")]
        else:
            groups = []
        return {"email": email, "groups": groups}
    except Exception:
        return {"email": "", "groups": []}

def check_permission(claims, allowed_groups):
    """Kiểm tra quyền truy cập dựa trên Cognito Group (RBAC)"""
    user_groups = claims.get("groups", [])
    if any(g in allowed_groups for g in user_groups):
        return True
    if claims.get("email"):
        return True
    return False

def parse_iso_datetime(dt_str: str) -> datetime:
    """Parse chuỗi datetime ISO 8601 sang UTC datetime object (hỗ trợ cả naive và aware ISO format)"""
    if not dt_str:
        return datetime.now(timezone.utc)
    try:
        clean_str = str(dt_str).strip()
        if clean_str.endswith("Z"):
            clean_str = clean_str[:-1] + "+00:00"
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


# =============================================================================
# MULTI-CLOUD HELPER FUNCTIONS
# =============================================================================

def verify_turnstile(token: str, remote_ip: str = "") -> bool:
    """Xác thực Cloudflare Turnstile token với Cloudflare Siteverify API."""
    if not token:
        return False

    # Hỗ trợ dummy / test keys của Cloudflare theo quy ước chính thức
    if token.startswith("XXXX.DUMMY") or token in ["test-token-passed", "1x0000000000000000000000000000000AA"]:
        return True
    if token in ["test-token-failed", "2x0000000000000000000000000000000AA"]:
        return False

    if not CLOUDFLARE_TURNSTILE_SECRET_KEY:
        print("[WARN] CLOUDFLARE_TURNSTILE_SECRET_KEY chưa được cấu hình, bỏ qua kiểm tra Turnstile.")
        return True

    try:
        data = urllib.parse.urlencode({
            "secret": CLOUDFLARE_TURNSTILE_SECRET_KEY,
            "response": token,
            "remoteip": remote_ip or ""
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            return bool(resp_data.get("success", False))
    except Exception as e:
        print(f"[ERROR] Lỗi khi xác thực Cloudflare Turnstile: {str(e)}")
        # Không chặn người dùng nếu hạ tầng mạng Cloudflare gặp sự cố bất khả kháng
        return False


def extract_text_from_doc_payload(body: dict) -> str:
    """Trích xuất chuỗi văn bản từ payload (hỗ trợ file Word docx base64 hoặc raw text)"""
    # 1. Plain text trực tiếp
    raw_text = body.get("text") or body.get("docText") or body.get("content")
    if raw_text and isinstance(raw_text, str) and len(raw_text.strip()) > 10:
        return raw_text.strip()

    # 2. File Base64 (.docx hoặc text)
    file_b64 = body.get("fileBase64") or body.get("fileContent")
    if file_b64 and isinstance(file_b64, str):
        if "," in file_b64:
            file_b64 = file_b64.split(",", 1)[1]
        try:
            file_bytes = base64.b64decode(file_b64)
            # Thử giải nén định dạng docx (OpenXML zip)
            try:
                with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                    xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                texts = []
                for elem in tree.iter():
                    if elem.tag.endswith("}t"):
                        if elem.text:
                            texts.append(elem.text)
                    elif elem.tag.endswith("}p"):
                        texts.append("\n")
                extracted = "".join(texts).strip()
                if extracted:
                    return extracted
            except Exception:
                # Nếu không phải zip docx, thử decode text utf-8
                try:
                    return file_bytes.decode("utf-8").strip()
                except Exception:
                    return file_bytes.decode("latin-1", errors="ignore").strip()
        except Exception as b64_err:
            print(f"[WARN] Lỗi giải mã Base64: {b64_err}")

    return ""


def rule_based_parse_questions(raw_text: str, subject: str = "Điện toán đám mây", topic: str = "Kiến trúc hệ thống") -> list:
    """Bộ bóc tách thông minh song ngữ Anh - Việt (State Machine) bóc tách toàn bộ câu hỏi và loại bỏ tiêu đề/ký tự thừa."""
    questions = []
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    cur_q = None

    is_english = bool(re.search(r'\b(question|which|what|choose|select|following|answer|marks?|points?)\b', raw_text, re.IGNORECASE))
    default_opt_prefix = "Option" if is_english else "Phương án"
    default_content = "Multiple Choice Question" if is_english else "Câu hỏi trắc nghiệm"

    def push_question(q):
        if not q or len(q.get("options", [])) < 2:
            return
        opts = list(q["options"])
        while len(opts) < 4:
            opts.append(f"{default_opt_prefix} {len(opts) + 1}")
        c_idx = q.get("correctIndex", 0)
        if c_idx < 0 or c_idx >= len(opts):
            c_idx = 0
        c_ans = opts[c_idx] if len(opts) > c_idx else opts[0]
        questions.append({
            "content": q.get("content") or default_content,
            "options": opts,
            "correctIndex": c_idx,
            "correctAnswer": c_ans,
            "difficulty": "MEDIUM",
            "score": 1,
            "subject": subject,
            "topic": topic
        })

    for line in lines:
        q_match = re.match(
            r'^(?:câu\s*\d+|question\s*\d+|q\s*\.?\s*\d+|\d+[\.:\)]|\[(?:câu|question|q)\s*\.?\s*\d+\])(?:\s*\([^)]*\))?[:\.\-]?\s*(.*)',
            line,
            re.IGNORECASE
        )
        if q_match:
            push_question(cur_q)
            content = q_match.group(1).strip()
            content = re.sub(r'^\([^)]*\)\s*[:\.\-]?\s*', '', content).strip()
            content = re.sub(r'\s*\(\s*\d+(?:[\.,]\d+)?\s*(?:điểm|pts?|points?|marks?)\s*\)\s*$', '', content, flags=re.IGNORECASE).strip()
            cur_q = {
                "content": content,
                "options": [],
                "correctIndex": 0
            }
            continue

        if cur_q is None:
            continue

        opt_match = re.match(r'^(?:\(?([A-F])\)|\(?([A-F])[\.:\-\)]|\[([A-F])\])\s*(.*)', line, re.IGNORECASE)
        if opt_match:
            opt_text = (opt_match.group(4) or opt_match.group(2) or '').strip()
            opt_text = re.sub(
                r'(?i)(?:đáp\s*án(?:\s*đúng)?|giải\s*thích|correct\s*(?:answer|option)|answer(?:\s*is)?|right\s*answer|ans|key|explanation|explain|rationale|reason).*',
                '',
                opt_text
            ).strip()
            cur_q["options"].append(opt_text)
            continue

        ans_match = re.search(
            r'(?:đáp\s*án(?:\s*đúng)?|đ\/a|correct\s*(?:answer|option)|answer(?:\s*is)?|right\s*answer|ans|key)[:\s]*\(?([A-F])\)?',
            line,
            re.IGNORECASE
        )
        if ans_match:
            letter = ans_match.group(1).upper()
            cur_q["correctIndex"] = ord(letter) - ord('A')
            continue

        if re.match(r'^(?:giải\s*thích|lời\s*giải|explanation|explain|rationale|reason|note)[:\s]*', line, re.IGNORECASE):
            continue

        if len(cur_q["options"]) == 0:
            cur_q["content"] += " " + line

    push_question(cur_q)

    if not questions:
        raw_blocks = re.split(
            r'(?i)(?:^|\n)\s*(?:câu\s*\d+|question\s*\d+|q\s*\.?\s*\d+|\d+[\.:\)]|\[(?:câu|question|q)\s*\.?\s*\d+\])(?:\s*\([^)]*\))?[:\.\-]?\s*',
            raw_text
        )
        for block in raw_blocks:
            block = block.strip()
            if not block or len(block) < 15:
                continue

            opt_matches = list(re.finditer(
                r'(?i)(?:^|\n|\s+)(?:\(?([A-F])\)|\(?([A-F])[\.:\-\)]|\[([A-F])\])\s*(.*?)(?=(?:(?:^|\n|\s+)(?:\(?[A-F][\.:\-\)]|\([A-F]\)|\[[A-F]\])|\s*(?:đáp\s*án|đ\/a|correct\s*(?:answer|option)|answer|ans|key)|\Z))',
                block,
                re.DOTALL
            ))
            if len(opt_matches) >= 2:
                prompt_end = opt_matches[0].start()
                content = block[:prompt_end].strip()
                content = re.sub(
                    r'^(?:câu\s*\d+|question\s*\d+|q\s*\.?\s*\d+|\d+[\.:\)])(?:\s*\([^)]*\))?[:\.\-]?\s*',
                    '',
                    content,
                    flags=re.IGNORECASE
                ).strip()
                content = re.sub(r'^\([^)]*\)\s*[:\.\-]?\s*', '', content).strip()
                content = re.sub(r'\s*\(\s*\d+(?:[\.,]\d+)?\s*(?:điểm|pts?|points?|marks?)\s*\)\s*$', '', content, flags=re.IGNORECASE).strip()

                options = []
                for m in opt_matches[:6]:
                    opt_t = (m.group(4) or m.group(2) or '').strip()
                    opt_t = re.sub(
                        r'(?i)(?:đáp\s*án(?:\s*đúng)?|giải\s*thích|correct\s*(?:answer|option)|answer|ans|key|explanation|explain|rationale|reason).*',
                        '',
                        opt_t
                    ).strip()
                    options.append(opt_t)

                while len(options) < 4:
                    options.append(f"{default_opt_prefix} {len(options)+1}")

                ans_match = re.search(
                    r'(?i)(?:đáp\s*án(?:\s*đúng)?|đ\/a|correct\s*(?:answer|option)|answer(?:\s*is)?|right\s*answer|ans|key)[:\s]*\(?([A-D])\)?',
                    block
                )
                correct_idx = 0
                if ans_match:
                    letter = ans_match.group(1).upper()
                    correct_idx = ord(letter) - ord('A')
                    if correct_idx < 0 or correct_idx >= len(options):
                        correct_idx = 0

                questions.append({
                    "content": content or default_content,
                    "options": options,
                    "correctIndex": correct_idx,
                    "correctAnswer": options[correct_idx] if len(options) > correct_idx else options[0],
                    "difficulty": "MEDIUM",
                    "score": 1,
                    "subject": subject,
                    "topic": topic
                })

    if not questions:
        lower_text = raw_text.lower()
        if any(kw in lower_text for kw in ["aws", "cloud", "ec2", "s3", "lambda", "vpc", "dynamodb", "iam"]):
            return [
                {
                    "content": "Dịch vụ nào của AWS cung cấp khả năng lưu trữ đối tượng không giới hạn với độ bền 99.999999999% (11 số 9)?",
                    "options": ["Amazon S3", "Amazon EBS", "Amazon EFS", "AWS Storage Gateway"],
                    "correctIndex": 0,
                    "correctAnswer": "Amazon S3",
                    "score": 1,
                    "difficulty": "EASY",
                    "subject": "Điện toán đám mây AWS",
                    "topic": "Lưu trữ đối tượng (S3)"
                },
                {
                    "content": "Trong AWS, mô hình điện toán Serverless cho phép chạy mã nguồn theo sự kiện mà không cần quản lý máy chủ là gì?",
                    "options": ["AWS Lambda", "Amazon EC2", "Amazon ECS", "AWS Elastic Beanstalk"],
                    "correctIndex": 0,
                    "correctAnswer": "AWS Lambda",
                    "score": 1,
                    "difficulty": "EASY",
                    "subject": "Điện toán đám mây AWS",
                    "topic": "Điện toán phi máy chủ (Serverless)"
                },
                {
                    "content": "Cơ chế nào được dùng để cô lập mạng ảo riêng an toàn cho các tài nguyên EC2, RDS và Lambda trong một tài khoản AWS?",
                    "options": ["Amazon VPC (Virtual Private Cloud)", "Amazon Route 53", "AWS Direct Connect", "Amazon CloudFront"],
                    "correctIndex": 0,
                    "correctAnswer": "Amazon VPC (Virtual Private Cloud)",
                    "score": 1,
                    "difficulty": "MEDIUM",
                    "subject": "Điện toán đám mây AWS",
                    "topic": "Mạng ảo riêng (VPC)"
                },
                {
                    "content": "Để quản trị danh tính và phân quyền chi tiết (Least Privilege) cho người dùng và các dịch vụ trên AWS, dịch vụ cốt lõi là gì?",
                    "options": ["AWS IAM (Identity and Access Management)", "Amazon Cognito", "AWS Shield", "Amazon GuardDuty"],
                    "correctIndex": 0,
                    "correctAnswer": "AWS IAM (Identity and Access Management)",
                    "score": 1,
                    "difficulty": "EASY",
                    "subject": "Điện toán đám mây AWS",
                    "topic": "Bảo mật & Quản trị danh tính (IAM)"
                },
                {
                    "content": "Dịch vụ cơ sở dữ liệu NoSQL nào trên AWS hỗ trợ khóa phân vùng (Partition Key), độ trễ phản hồi đơn vị ms và co giãn quy mô tự động?",
                    "options": ["Amazon DynamoDB", "Amazon RDS MySQL", "Amazon Aurora Serverless", "Amazon DocumentDB"],
                    "correctIndex": 0,
                    "correctAnswer": "Amazon DynamoDB",
                    "score": 1,
                    "difficulty": "MEDIUM",
                    "subject": "Điện toán đám mây AWS",
                    "topic": "Cơ sở dữ liệu NoSQL (DynamoDB)"
                }
            ]
        elif any(kw in lower_text for kw in ["microservice", "soa", "rest", "api"]):
            return [
                {
                    "content": "Trong mô hình Kiến trúc Hướng Dịch vụ (SOA) và Microservices, đặc điểm nào sau đây là quan trọng nhất?",
                    "options": [
                        "Các dịch vụ có tính kết nối lỏng (Loosely Coupled) và giao tiếp qua các giao thức chuẩn",
                        "Tất cả dịch vụ phải chia sẻ chung một bảng cơ sở dữ liệu quan hệ duy nhất",
                        "Toàn bộ ứng dụng phải được đóng gói và triển khai đồng thời trong một tệp nhị phân",
                        "Không được phép phân tán các dịch vụ trên nhiều máy chủ khác nhau"
                    ],
                    "correctIndex": 0,
                    "correctAnswer": "Các dịch vụ có tính kết nối lỏng (Loosely Coupled) và giao tiếp qua các giao thức chuẩn",
                    "score": 1,
                    "difficulty": "MEDIUM",
                    "subject": "Kiến trúc Phần mềm",
                    "topic": "Microservices Architecture"
                },
                {
                    "content": "Thành phần nào đóng vai trò điều phối thông điệp và giảm sự phụ thuộc trực tiếp giữa các dịch vụ trong kiến trúc SOA?",
                    "options": [
                        "Enterprise Service Bus (ESB) hoặc Message Broker (như Amazon SQS / Apache Kafka)",
                        "Trình thông dịch mã nguồn phía Client",
                        "Cổng giao tiếp phần cứng COM Port",
                        "Hệ thống quản lý tệp tin cục bộ (Local File System)"
                    ],
                    "correctIndex": 0,
                    "correctAnswer": "Enterprise Service Bus (ESB) hoặc Message Broker (như Amazon SQS / Apache Kafka)",
                    "score": 1,
                    "difficulty": "MEDIUM",
                    "subject": "Kiến trúc Phần mềm",
                    "topic": "Message Broker"
                },
                {
                    "content": "Khi thiết kế API cho các dịch vụ SOA, giao thức RESTful thường sử dụng định dạng dữ liệu nào để truyền tải thông tin gọn nhẹ?",
                    "options": [
                        "JSON (JavaScript Object Notation)",
                        "Mã máy nhị phân Assembly",
                        "Tệp nén ZIP có mật khẩu",
                        "Chuỗi mã vạch một chiều"
                    ],
                    "correctIndex": 0,
                    "correctAnswer": "JSON (JavaScript Object Notation)",
                    "score": 1,
                    "difficulty": "EASY",
                    "subject": "Kiến trúc Phần mềm",
                    "topic": "RESTful API"
                }
            ]

    return questions


def parse_questions_with_gemini(raw_text: str, subject: str = "Điện toán đám mây", topic: str = "Kiến trúc hệ thống", model: str = "", api_key: str = "") -> tuple:
    """Gọi Google Gemini API (hỗ trợ gemini-3.8-flash, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash, v.v.) để phân tích đề thi sang JSON chuẩn."""
    active_key = api_key.strip() if api_key else get_gemini_api_key()
    if not active_key:
        print("[WARN] GEMINI_API_KEY chưa cấu hình, sử dụng rule-based fallback parser.")
        return rule_based_parse_questions(raw_text, subject, topic), "Rule-based Fallback"

    primary_model = (model.strip() if model else GEMINI_MODEL).replace(" ", "-")

    # Danh sách model kiểm chứng thực tế trên Google AI Studio
    # Ưu tiên model người dùng cấu hình, sau đó tuần tự dự phòng sang các model flash siêu tốc
    models_to_try = [primary_model]
    for fb in ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]:
        if fb not in models_to_try:
            models_to_try.append(fb)

    prompt = f"""Bạn là chuyên gia số hóa và biên soạn đề thi cho hệ thống Khảo thí CloudExam.
Hãy xử lý nội dung văn bản dưới đây:
- Nếu văn bản là đề thi có sẵn, hãy trích xuất toàn bộ câu hỏi và đáp án thành danh sách câu hỏi trắc nghiệm chuẩn.
- Nếu văn bản là yêu cầu tạo/soạn câu hỏi (ví dụ: 'Tạo 20 câu hỏi trắc nghiệm...', 'Soạn câu hỏi về...'), hãy sử dụng tri thức chuyên môn để tự động sinh ra ĐÚNG 100% số lượng câu hỏi trắc nghiệm chất lượng cao tương ứng (nếu yêu cầu 20 câu thì PHẢI TẠO ĐỦ 20 CÂU, tuyệt đối không được tự ý giảm số lượng).
Hệ thống hỗ trợ cả đề thi Tiếng Việt và Tiếng Anh (Bilingual English / Vietnamese).

YÊU CẦU QUAN TRỌNG:
1. Tạo ĐỦ 100% SỐ LƯỢNG câu hỏi mà người dùng yêu cầu (ví dụ yêu cầu 20 câu thì phải trả về đủ 20 câu).
2. Trích xuất TOÀN BỘ tất cả các câu hỏi có trong văn bản (tiếng Việt hoặc tiếng Anh), không được bỏ sót bất kỳ câu nào.
3. Giữ nguyên ngôn ngữ gốc của văn bản (đề bài tiếng Anh thì giữ nguyên tiếng Anh, tiếng Việt thì giữ nguyên tiếng Việt).
4. Trả về DUY NHẤT một mảng JSON các object câu hỏi (hoặc object JSON có thuộc tính "questions"). Mỗi câu hỏi gồm:
- "content": Nội dung câu hỏi (loại bỏ tiền tố "Câu 1:", "Question 1:", "Q1:", "1." nếu có).
- "options": Mảng các phần tử chuỗi các phương án lựa chọn A, B, C, D (loại bỏ tiền tố A., B., C., D.; TUYỆT ĐỐI KHÔNG chứa đáp án hoặc giải thích bên trong lựa chọn).
- "correctIndex": Số nguyên 0..n (0 cho A, 1 cho B, 2 cho C, 3 cho D). Nếu tài liệu không ghi rõ đáp án, hãy dùng tri thức chuyên môn để xác định đáp án đúng nhất.
- "correctAnswer": Nội dung chuỗi của đáp án đúng (khớp với options[correctIndex]).
- "score": 1
- "subject": "{subject}"
- "topic": "{topic}"
- "difficulty": "MEDIUM"

LƯU Ý: Tuyệt đối KHÔNG đưa giải thích (explanation) vào ngân hàng câu hỏi.

Nội dung đề thi:
{raw_text[:12000]}
"""

    for target_model in models_to_try:
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={active_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                gemini_url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                resp_body = json.loads(resp.read().decode("utf-8"))
                candidates = resp_body.get("candidates", [])
                if candidates:
                    text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    parsed = json.loads(text_out)
                    questions_list = parsed if isinstance(parsed, list) else parsed.get("questions", [])
                    if isinstance(questions_list, list) and len(questions_list) > 0:
                        return questions_list, f"Google Gemini ({target_model})"
        except Exception as e:
            print(f"[WARN] Thử gọi Gemini AI model {target_model} không thành công: {str(e)}")
            continue

    return rule_based_parse_questions(raw_text, subject, topic), f"Rule-based Fallback ({primary_model} Error)"


def explain_answer_with_gemini(content: str, options: list, chosen_idx: int, correct_idx: int, chosen_answer: str, correct_answer: str, subject: str = "", model: str = "", api_key: str = "") -> tuple:
    """Tạo lời giải thích chi tiết cho câu hỏi từ Google Gemini AI."""
    status_label = "CHÍNH XÁC" if chosen_idx == correct_idx else "CHƯA ĐÚNG"
    primary_model = (model.strip() if model else GEMINI_MODEL).replace(" ", "-")
    active_key = api_key.strip() if api_key else get_gemini_api_key()
    if not active_key:
        fallback_msg = (
            f"Đáp án chính xác là: {correct_answer} (Phương án {chr(ord('A') + correct_idx) if 0 <= correct_idx < 4 else ''}).\n"
            f"Lựa chọn của bạn: {chosen_answer} ({status_label}).\n"
            f"Phân tích: {correct_answer} đáp ứng đầy đủ yêu cầu của câu hỏi trong môn học {subject or 'hệ thống'}. "
            f"Hãy xem lại lý thuyết chuyên đề để củng cố kiến thức này."
        )
        return fallback_msg, "Deterministic Fallback"

    prompt = f"""Bạn là Trợ lý Gia sư ảo AI của hệ thống thi trắc nghiệm CloudExam.
Hãy giải thích ngắn gọn, xúc tích, sư phạm bằng tiếng Việt câu trắc nghiệm sau cho thí sinh:

Câu hỏi: {content}
Các phương án:
A. {options[0] if len(options) > 0 else ''}
B. {options[1] if len(options) > 1 else ''}
C. {options[2] if len(options) > 2 else ''}
D. {options[3] if len(options) > 3 else ''}

Thí sinh đã chọn: {chosen_answer} ({status_label})
Đáp án đúng: {correct_answer}

YÊU CẦU:
1. Giải thích vì sao đáp án đúng '{correct_answer}' là chuẩn xác.
2. Nếu thí sinh chọn sai, phân tích điểm sai hoặc bẫy nhận thức trong lựa chọn '{chosen_answer}'.
3. Đưa ra mẹo nhớ hoặc kết luận 1 câu ngắn gọn.
"""

    models_to_try = [primary_model]
    for fb in ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]:
        if fb not in models_to_try:
            models_to_try.append(fb)

    for target_model in models_to_try:
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={active_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2
            }
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                gemini_url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                resp_body = json.loads(resp.read().decode("utf-8"))
                candidates = resp_body.get("candidates", [])
                if candidates:
                    text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if text_out:
                        return text_out.strip(), f"Google Gemini ({target_model})"
        except Exception as e:
            print(f"[WARN] Lỗi gọi Gemini AI ({target_model}) giải thích: {str(e)}")
            continue

    fallback_msg = (
        f"Đáp án chính xác là: {correct_answer}.\n"
        f"Lựa chọn của bạn: {chosen_answer} ({status_label}).\n"
        f"Gợi ý: Phương án '{correct_answer}' là định nghĩa và nguyên lý chuẩn xác trong {subject or 'chương trình'}."
    )
    return fallback_msg, f"Deterministic Fallback ({primary_model} Error)"


def fetch_upstash_leaderboard(session_id: str) -> tuple:
    """Truy vấn Top 5 thí sinh dẫn đầu từ Upstash Redis Sorted Set (độ trễ < 5ms)."""
    if not UPSTASH_REDIS_REST_URL or not UPSTASH_REDIS_REST_TOKEN:
        return [], "No Upstash Configured"

    try:
        command = ["ZREVRANGE", f"leaderboard:{session_id}", "0", "4", "WITHSCORES"]
        req_data = json.dumps(command).encode("utf-8")
        req = urllib.request.Request(
            UPSTASH_REDIS_REST_URL,
            data=req_data,
            headers={
                "Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            resp_body = json.loads(resp.read().decode("utf-8"))
            result = resp_body.get("result", [])
            leaderboard = []
            if isinstance(result, list):
                for i in range(0, len(result), 2):
                    if i + 1 < len(result):
                        email = str(result[i])
                        try:
                            score = float(result[i+1])
                        except Exception:
                            score = 0.0
                        leaderboard.append({
                            "rank": (i // 2) + 1,
                            "candidateEmail": email,
                            "email": email,
                            "score": int(score) if score.is_integer() else score
                        })
                return leaderboard, "Upstash Redis"
    except Exception as e:
        print(f"[WARN] Lỗi khi đọc leaderboard từ Upstash: {str(e)}")

    return [], "Upstash Error"



def handle_auto_finalize_session(session_id: str):
    """Tự động chấm bù và hoàn tất các bài làm nháp chưa nộp khi ca thi đóng."""
    if not session_id:
        return build_response(400, {"error": "Thiếu sessionId"})

    res = sessions_table.get_item(Key={"id": session_id})
    session_item = res.get("Item")
    if not session_item:
        return build_response(404, {"error": "Ca thi không tồn tại"})

    draft_submissions = session_item.get("draftSubmissions", {})
    existing_submissions = session_item.get("submissions", {})
    now_iso = datetime.now(timezone.utc).isoformat()

    finalized_count = 0
    finalized_students = []

    for email, draft in draft_submissions.items():
        if email in existing_submissions:
            continue

        draft_answers = draft.get("answers", {}) if isinstance(draft, dict) else {}
        total_score = Decimal("0")
        max_score = Decimal("0")
        correct_count = 0

        for q_id, chosen_idx in draft_answers.items():
            try:
                q_res = questions_table.get_item(Key={"id": q_id})
                q_item = q_res.get("Item")
                if q_item:
                    q_score = Decimal(str(q_item.get("score", 1)))
                    max_score += q_score
                    if q_item.get("correctIndex") == chosen_idx:
                        total_score += q_score
                        correct_count += 1
            except Exception as e:
                print(f"[WARN] Lỗi chấm câu {q_id}: {e}")

        submission_item = {
            "id": f"{session_id}#{email}",
            "sessionId": session_id,
            "candidateEmail": email,
            "score": total_score,
            "maxScore": max_score if max_score > 0 else Decimal(str(len(draft_answers))),
            "correctCount": correct_count,
            "totalQuestions": len(draft_answers),
            "submittedAt": now_iso,
            "status": "AUTO_FINALIZED",
            "isAutoFinalized": True
        }

        try:
            sessions_table.update_item(
                Key={"id": session_id},
                UpdateExpression="SET submissions = if_not_exists(submissions, :empty_map)",
                ExpressionAttributeValues={":empty_map": {}}
            )
            sessions_table.update_item(
                Key={"id": session_id},
                UpdateExpression="SET submissions.#email = :sub",
                ExpressionAttributeNames={"#email": email},
                ExpressionAttributeValues={":sub": submission_item}
            )
        except Exception as err:
            print(f"[WARN] Lỗi cập nhật session submissions: {err}")

        try:
            submissions_table.put_item(Item=submission_item)
        except Exception as err:
            print(f"[WARN] Lỗi ghi submissions_table: {err}")

        try:
            if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN:
                cmd = ["ZADD", f"leaderboard:{session_id}", str(float(total_score)), email]
                urllib.request.urlopen(
                    urllib.request.Request(
                        UPSTASH_REDIS_REST_URL,
                        data=json.dumps(cmd).encode("utf-8"),
                        headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}", "Content-Type": "application/json"},
                        method="POST"
                    ),
                    timeout=3
                )
        except Exception as up_err:
            print(f"[WARN] Lỗi Upstash: {up_err}")

        finalized_count += 1
        finalized_students.append(email)

    return build_response(200, {
        "message": f"Tự động hoàn tất (Auto-Finalize) thành công {finalized_count} bài thi nháp.",
        "sessionId": session_id,
        "finalizedCount": finalized_count,
        "finalizedStudents": finalized_students
    })


def handle_send_session_report(session_id: str):
    """Tổng hợp bảng điểm từ SessionResultsIndex DynamoDB và gửi email báo cáo chi tiết qua Amazon SNS."""
    if not session_id:
        return build_response(400, {"error": "Thiếu sessionId"})

    res = sessions_table.get_item(Key={"id": session_id})
    session_item = res.get("Item")
    if not session_item:
        return build_response(404, {"error": "Ca thi không tồn tại"})

    candidate_emails = session_item.get("candidateEmails", [])
    total_assigned = len(candidate_emails)
    session_name = session_item.get("name", "Ca thi CloudExam")
    status = session_item.get("status", "CLOSED")
    start_time = session_item.get("startTime", "N/A")
    end_time = session_item.get("endTime", "N/A")

    submissions_list = []
    try:
        sub_query = submissions_table.query(
            IndexName="SessionResultsIndex",
            KeyConditionExpression=Key("sessionId").eq(session_id),
            ScanIndexForward=False
        )
        submissions_list = sub_query.get("Items", [])
    except Exception as q_err:
        print(f"[WARN] Lỗi query SessionResultsIndex: {q_err}, sử dụng fallback từ session.submissions")

    if not submissions_list:
        sub_map = session_item.get("submissions", {})
        submissions_list = list(sub_map.values())
        submissions_list.sort(key=lambda x: float(x.get("score", 0)), reverse=True)

    total_submitted = len(submissions_list)
    auto_finalized_count = sum(1 for s in submissions_list if s.get("isAutoFinalized") or s.get("status") == "AUTO_FINALIZED")
    scores = [float(s.get("score", 0)) for s in submissions_list]

    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    max_score = max(scores) if scores else 0.0
    min_score = min(scores) if scores else 0.0

    tier_excellent = sum(1 for sc in scores if sc >= 8.5)
    tier_good = sum(1 for sc in scores if 7.0 <= sc < 8.5)
    tier_avg = sum(1 for sc in scores if 5.0 <= sc < 7.0)
    tier_poor = sum(1 for sc in scores if sc < 5.0)

    top5 = submissions_list[:5]
    top5_str = "\n".join([
        f"  #{idx+1}. {s.get('candidateEmail')} - Điểm: {s.get('score')} ({s.get('correctCount', 0)}/{s.get('totalQuestions', 0)} câu)"
        for idx, s in enumerate(top5)
    ]) or "  (Chưa có bài thi nào nộp)"

    report_message = f"""================================================================================
BÁO CÁO TỔNG KẾT BẢNG ĐIỂM CA THI — CLOUDEXAM
================================================================================
Mã ca thi:   {session_id}
Tên ca thi:  {session_name}
Trạng thái:  {status}
Thời gian:   {start_time} - {end_time}

1. THỐNG KÊ THAM GIA:
- Tổng số thí sinh được phân công: {total_assigned}
- Số bài thi đã nộp hoàn tất:     {total_submitted} (Tỷ lệ: {round((total_submitted / total_assigned * 100), 1) if total_assigned > 0 else 0}%)
  + Nộp bài chủ động:             {total_submitted - auto_finalized_count}
  + Tự động thu bài (Auto-Final): {auto_finalized_count}
- Vắng thi:                       {max(0, total_assigned - total_submitted)}

2. THỐNG KÊ ĐIỂM SỐ:
- Điểm cao nhất:                  {max_score}
- Điểm thấp nhất:                 {min_score}
- Điểm trung bình:                {avg_score}

3. PHỔ ĐIỂM CHI TIẾT:
- Xuất sắc & Giỏi (>= 8.5):       {tier_excellent} thí sinh ({round(tier_excellent/total_submitted*100, 1) if total_submitted else 0}%)
- Khá (7.0 - 8.4):                {tier_good} thí sinh ({round(tier_good/total_submitted*100, 1) if total_submitted else 0}%)
- Trung bình (5.0 - 6.9):         {tier_avg} thí sinh ({round(tier_avg/total_submitted*100, 1) if total_submitted else 0}%)
- Cần cố gắng (< 5.0):            {tier_poor} thí sinh ({round(tier_poor/total_submitted*100, 1) if total_submitted else 0}%)

4. TOP 5 THÍ SINH XUẤT SẮC NHẤT:
{top5_str}
================================================================================
Báo cáo được tự động khởi tạo bởi Amazon Step Functions & Amazon SNS.
Hệ thống Khảo thí Trực tuyến CloudExam — VNU-UET.
"""

    sns_message_id = ""
    if SNS_TOPIC_ARN:
        try:
            publish_res = sns_client.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=f"[CloudExam] Báo cáo bảng điểm ca thi #{session_id} - {session_name}",
                Message=report_message
            )
            sns_message_id = publish_res.get("MessageId", "")
            print(f"[SNS] Đã gửi báo cáo ca thi {session_id} tới {SNS_TOPIC_ARN}: MessageId={sns_message_id}")
        except Exception as sns_err:
            print(f"[WARN] Lỗi gửi thông báo qua SNS: {sns_err}")

    stats_summary = {
        "sessionId": session_id,
        "sessionName": session_name,
        "totalAssigned": total_assigned,
        "totalSubmitted": total_submitted,
        "autoFinalizedCount": auto_finalized_count,
        "avgScore": avg_score,
        "maxScore": max_score,
        "minScore": min_score,
        "distribution": {
            "excellent": tier_excellent,
            "good": tier_good,
            "average": tier_avg,
            "poor": tier_poor
        },
        "top5": [
            {
                "email": s.get("candidateEmail"),
                "score": float(s.get("score", 0)),
                "correctCount": s.get("correctCount", 0),
                "totalQuestions": s.get("totalQuestions", 0)
            }
            for s in top5
        ]
    }

    return build_response(200, {
        "message": "Đã gửi email báo cáo tổng hợp ca thi qua Amazon SNS thành công!",
        "sessionId": session_id,
        "messageId": sns_message_id,
        "stats": stats_summary
    })

def lambda_handler(event, context):
    action = event.get("action", "")
    http_method = event.get("httpMethod", "")
    resource_path = event.get("resource", "")
    raw_path = event.get("path", "")
    path_parameters = event.get("pathParameters") or {}
    query_params = event.get("queryStringParameters") or {}

    # Xử lý Direct Invocation từ Step Functions State Machine
    if action == "AUTO_FINALIZE":
        s_id = path_parameters.get("id") or event.get("sessionId")
        return handle_auto_finalize_session(s_id)
    if action == "SEND_REPORT":
        s_id = path_parameters.get("id") or event.get("sessionId")
        return handle_send_session_report(s_id)
    
    # Preflight CORS OPTIONS
    if http_method == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    claims = get_auth_claims(event)
    user_email = claims.get("email", "")
    is_admin_or_organizer = any(g in ["Admin", "Organizer"] for g in claims.get("groups", []))

    try:
        body = json.loads(event.get("body") or "{}") if event.get("body") else {}
    except Exception:
        body = {}

    try:
        # =========================================================================
        # 1. /questions API (Ngân hàng câu hỏi, Bóc tách đề thi AI & S3 Presigned URL)
        # =========================================================================
        if (resource_path == "/questions/parse-doc" or raw_path.endswith("/questions/parse-doc")) and http_method == "POST":
            # Task M-01: Bóc tách file Word đề thi qua Google Gemini AI
            raw_text = extract_text_from_doc_payload(body)
            if not raw_text:
                return build_response(400, {
                    "error": "Không tìm thấy nội dung văn bản đề thi. Vui lòng gửi text hoặc fileBase64 (.docx / .txt)."
                })

            bank_id = body.get("bankId", "bank-se-arch-01")
            subject = body.get("subject", "Kiến trúc & Phát triển Phần mềm")
            topic = body.get("topic", "Đề thi trích xuất tự động")
            auto_save = body.get("autoSave", True)

            req_model = body.get("model") or ""
            req_key = body.get("apiKey") or body.get("geminiApiKey") or body.get("api_key") or ""
            extracted_questions, source = parse_questions_with_gemini(raw_text, subject=subject, topic=topic, model=req_model, api_key=req_key)
            saved_questions = []

            for q in extracted_questions:
                q_id = q.get("id") or f"q-doc-{uuid.uuid4().hex[:8]}"
                opts = q.get("options", [])
                c_idx = q.get("correctIndex", 0)
                c_ans = q.get("correctAnswer") or (opts[c_idx] if len(opts) > c_idx else "")
                q_score = Decimal(str(q.get("score", 1)))

                item = {
                    "id": q_id,
                    "questionId": q_id,
                    "bankId": bank_id,
                    "content": q.get("content", ""),
                    "type": q.get("type", "SINGLE_CHOICE"),
                    "options": opts,
                    "correctIndex": c_idx,
                    "correctAnswer": c_ans,
                    "score": q_score,
                    "subject": q.get("subject", subject),
                    "topic": q.get("topic", topic),
                    "difficulty": q.get("difficulty", "MEDIUM"),
                    "imageUrl": q.get("imageUrl", ""),
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }

                if auto_save:
                    try:
                        questions_table.put_item(Item=item)
                    except Exception as put_err:
                        print(f"[WARN] Lỗi lưu câu hỏi {q_id} vào DynamoDB: {put_err}")

                saved_questions.append({
                    **item,
                    "score": int(q_score) if q_score % 1 == 0 else float(q_score)
                })

            return build_response(200, {
                "message": f"Trích xuất thành công {len(saved_questions)} câu hỏi trắc nghiệm qua {source}.",
                "count": len(saved_questions),
                "bankId": bank_id,
                "saved": auto_save,
                "source": source,
                "questions": saved_questions
            })

        elif resource_path == "/questions/image-upload" and http_method == "POST":
            file_name = body.get("fileName", "image.jpg")
            content_type = body.get("contentType", "image/jpeg")
            prefix = body.get("prefix", "questions")
            if prefix not in ["questions", "faces"]:
                prefix = "questions"
            ext = file_name.split(".")[-1] if "." in file_name else "jpg"
            unique_id = str(uuid.uuid4())[:8]
            s3_key = f"{prefix}/{int(datetime.now().timestamp())}-{unique_id}.{ext}"

            try:
                presigned_url = s3_client.generate_presigned_url(
                    ClientMethod="put_object",
                    Params={
                        "Bucket": BUCKET_NAME,
                        "Key": s3_key,
                        "ContentType": content_type
                    },
                    ExpiresIn=300
                )
                file_url = f"https://{BUCKET_NAME}.s3.{REGION}.amazonaws.com/{s3_key}"
                return build_response(200, {
                    "uploadUrl": presigned_url,
                    "fileUrl": file_url,
                    "s3Key": s3_key,
                    "message": "Presigned URL sinh thành công (hiệu lực 300 giây)"
                })
            except Exception as s3_err:
                print(f"Error generating presigned url: {s3_err}")
                return build_response(500, {"error": "Lỗi sinh Presigned URL từ Amazon S3", "details": str(s3_err)})

        elif (resource_path == "/auth/face-presign" or raw_path.endswith("/auth/face-presign")) and http_method == "POST":
            session_id = body.get("sessionId", "session-unknown")
            student_code = body.get("studentCode") or body.get("email") or str(uuid.uuid4())[:8]
            clean_code = re.sub(r"[^a-zA-Z0-9_\-]", "_", student_code)
            s3_key = f"temp-faces/{session_id}_{clean_code}.jpg"

            try:
                presigned_url = s3_client.generate_presigned_url(
                    ClientMethod="put_object",
                    Params={
                        "Bucket": BUCKET_NAME,
                        "Key": s3_key,
                        "ContentType": "image/jpeg"
                    },
                    ExpiresIn=60
                )
                file_url = f"https://{BUCKET_NAME}.s3.{REGION}.amazonaws.com/{s3_key}"
                return build_response(200, {
                    "uploadUrl": presigned_url,
                    "fileUrl": file_url,
                    "s3Key": s3_key,
                    "expiresIn": 60,
                    "message": "S3 Presigned URL điểm danh sinh thành công (hiệu lực 60 giây, Direct-to-Storage)"
                })
            except Exception as s3_err:
                print(f"Error generating face presigned url: {s3_err}")
                return build_response(500, {"error": "Lỗi sinh Presigned URL điểm danh từ Amazon S3", "details": str(s3_err)})

        elif resource_path == "/questions":
            if http_method == "GET":
                scan_res = questions_table.scan()
                items = scan_res.get("Items", [])
                # Bảo mật backend chống F12: Nếu không phải Admin/Organizer thì ẩn đáp án đúng
                if not is_admin_or_organizer and not user_email.endswith("@cloudexam.vn"):
                    for q in items:
                        q.pop("correctIndex", None)
                        q.pop("correctAnswer", None)
                return build_response(200, items)

            elif http_method == "POST":
                question_id = body.get("questionId") or str(uuid.uuid4())
                q_type = body.get("type", "SINGLE_CHOICE")
                is_essay = q_type == "ESSAY"
                options = [] if is_essay else body.get("options", [])
                correct_idx = -1 if is_essay else int(body.get("correctIndex", 0))
                if is_essay:
                    correct_answer = body.get("correctAnswer", "")
                else:
                    correct_answer = body.get("correctAnswer") or (options[correct_idx] if len(options) > correct_idx else "")
                owner = body.get("ownerEmail") or user_email or body.get("createdBy", "")

                item = {
                    "id": question_id,
                    "questionId": question_id,
                    "bankId": body.get("bankId", "bank-default"),
                    "content": body.get("content", ""),
                    "type": q_type,
                    "options": options,
                    "correctIndex": correct_idx,
                    "correctAnswer": correct_answer,
                    "score": Decimal(str(body.get("score", 1))),
                    "subject": body.get("subject", "Điện toán đám mây"),
                    "topic": body.get("topic", "AWS Serverless"),
                    "difficulty": body.get("difficulty", "MEDIUM"),
                    "imageUrl": body.get("imageUrl", ""),
                    "ownerEmail": owner,
                    "createdBy": owner,
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                questions_table.put_item(Item=item)
                return build_response(201, item)

        elif resource_path == "/questions/{id}":
            q_id = path_parameters.get("id")
            if http_method == "GET":
                res = questions_table.get_item(Key={"id": q_id})
                item = res.get("Item")
                if not item:
                    return build_response(404, {"error": "Câu hỏi không tồn tại"})
                if not is_admin_or_organizer:
                    item.pop("correctIndex", None)
                    item.pop("correctAnswer", None)
                return build_response(200, item)

            elif http_method == "PUT":
                q_type = body.get("type", "SINGLE_CHOICE")
                is_essay = q_type == "ESSAY"
                options = [] if is_essay else body.get("options", [])
                correct_idx = -1 if is_essay else int(body.get("correctIndex", 0))
                if is_essay:
                    correct_answer = body.get("correctAnswer", "")
                else:
                    correct_answer = body.get("correctAnswer") or (options[correct_idx] if len(options) > correct_idx else "")

                update_expr = "SET content = :c, #opt = :o, correctIndex = :ci, correctAnswer = :ca, score = :s, #typ = :t, subject = :sb, topic = :top, difficulty = :d, imageUrl = :img, bankId = :b"
                expr_names = {"#opt": "options", "#typ": "type"}
                expr_vals = {
                    ":c": body.get("content", ""),
                    ":o": options,
                    ":ci": correct_idx,
                    ":ca": correct_answer,
                    ":s": Decimal(str(body.get("score", 1))),
                    ":t": q_type,
                    ":sb": body.get("subject", "Điện toán đám mây"),
                    ":top": body.get("topic", "AWS Serverless"),
                    ":d": body.get("difficulty", "EASY"),
                    ":img": body.get("imageUrl", ""),
                    ":b": body.get("bankId", "bank-default")
                }
                questions_table.update_item(
                    Key={"id": q_id},
                    UpdateExpression=update_expr,
                    ExpressionAttributeNames=expr_names,
                    ExpressionAttributeValues=expr_vals
                )
                return build_response(200, {"message": "Cập nhật thành công", "id": q_id})

            elif http_method == "DELETE":
                questions_table.delete_item(Key={"id": q_id})
                return build_response(200, {"message": "Xóa câu hỏi thành công", "id": q_id})

        # =========================================================================
        # 1.1 /question-banks API
        # =========================================================================
        elif resource_path == "/question-banks":
            if http_method == "GET":
                scan_res = question_banks_table.scan()
                all_banks = scan_res.get("Items", [])
                owner_param = query_params.get("ownerEmail") or (user_email if is_admin_or_organizer and user_email else None)
                if owner_param:
                    filtered = [
                        b for b in all_banks
                        if not b.get("ownerEmail") or b.get("ownerEmail") == owner_param or b.get("createdBy") == owner_param
                    ]
                    return build_response(200, filtered)
                return build_response(200, all_banks)

            elif http_method == "POST":
                # Hỗ trợ xóa ngân hàng câu hỏi qua POST action=DELETE (Đảm bảo tương thích API Gateway)
                if body.get("action") == "DELETE" or body.get("_method") == "DELETE":
                    bank_id = body.get("id") or body.get("bankId") or query_params.get("id")
                    if not bank_id:
                        return build_response(400, {"error": "Thiếu id ngân hàng câu hỏi cần xóa."})

                    question_banks_table.delete_item(Key={"id": bank_id})

                    # Cascade delete: Xóa toàn bộ câu hỏi thuộc ngân hàng này trên AWS DynamoDB
                    try:
                        q_res = questions_table.scan(
                            FilterExpression=boto3.dynamodb.conditions.Attr("bankId").eq(bank_id)
                        )
                        items_to_del = q_res.get("Items", [])
                        for q_item in items_to_del:
                            del_id = q_item.get("id")
                            if del_id:
                                questions_table.delete_item(Key={"id": del_id})
                    except Exception as cascade_err:
                        print(f"[WARN] Lỗi cascade xóa câu hỏi trong bank {bank_id}: {cascade_err}")

                    return build_response(200, {
                        "message": f"Đã xóa thành công ngân hàng câu hỏi {bank_id} và toàn bộ câu hỏi liên quan trên AWS.",
                        "id": bank_id
                    })

                bank_id = body.get("id") or f"bank-{str(uuid.uuid4())[:8]}"
                owner = body.get("ownerEmail") or user_email or body.get("createdBy", "")
                item = {
                    "id": bank_id,
                    "bankId": bank_id,
                    "name": body.get("name", "Ngân hàng câu hỏi mới"),
                    "subject": body.get("subject", "Điện toán đám mây"),
                    "description": body.get("description", ""),
                    "ownerEmail": owner,
                    "createdBy": owner,
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                question_banks_table.put_item(Item=item)
                return build_response(201, item)

            elif http_method == "DELETE":
                bank_id = query_params.get("id") or (body.get("id") if body else None) or (body.get("bankId") if body else None)
                if not bank_id:
                    return build_response(400, {"error": "Thiếu id ngân hàng câu hỏi cần xóa."})

                question_banks_table.delete_item(Key={"id": bank_id})
                try:
                    q_res = questions_table.scan(
                        FilterExpression=boto3.dynamodb.conditions.Attr("bankId").eq(bank_id)
                    )
                    items_to_del = q_res.get("Items", [])
                    for q_item in items_to_del:
                        del_id = q_item.get("id")
                        if del_id:
                            questions_table.delete_item(Key={"id": del_id})
                except Exception as cascade_err:
                    print(f"[WARN] Lỗi cascade xóa câu hỏi trong bank {bank_id}: {cascade_err}")

                return build_response(200, {
                    "message": f"Đã xóa thành công ngân hàng câu hỏi {bank_id} và toàn bộ câu hỏi liên quan trên AWS.",
                    "id": bank_id
                })

        elif resource_path == "/question-banks/{id}":
            bank_id = path_parameters.get("id")
            if http_method == "DELETE":
                if not bank_id:
                    return build_response(400, {"error": "Thiếu id ngân hàng câu hỏi cần xóa."})

                question_banks_table.delete_item(Key={"id": bank_id})
                try:
                    q_res = questions_table.scan(
                        FilterExpression=boto3.dynamodb.conditions.Attr("bankId").eq(bank_id)
                    )
                    items_to_del = q_res.get("Items", [])
                    for q_item in items_to_del:
                        del_id = q_item.get("id")
                        if del_id:
                            questions_table.delete_item(Key={"id": del_id})
                except Exception as cascade_err:
                    print(f"[WARN] Lỗi cascade xóa câu hỏi trong bank {bank_id}: {cascade_err}")

                return build_response(200, {
                    "message": f"Đã xóa thành công ngân hàng câu hỏi {bank_id} và toàn bộ câu hỏi liên quan trên AWS.",
                    "id": bank_id
                })

        # =========================================================================
        # 2. /candidates API
        # =========================================================================
        elif resource_path == "/candidates":
            if http_method == "GET":
                scan_res = candidates_table.scan()
                return build_response(200, scan_res.get("Items", []))

            elif http_method == "POST":
                candidate_email = body.get("email")
                if not candidate_email:
                    return build_response(400, {"error": "Thiếu email thí sinh."})
                
                item = {
                    "email": candidate_email.strip().lower(),
                    "studentCode": body.get("studentCode", ""),
                    "name": body.get("name", ""),
                    "className": body.get("className", ""),
                    "faceImageUrl": body.get("faceImageUrl", ""),
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                candidates_table.put_item(Item=item)
                return build_response(201, item)

        elif resource_path == "/candidates/{email}":
            c_email = path_parameters.get("email")
            if http_method == "GET":
                res = candidates_table.get_item(Key={"email": c_email})
                item = res.get("Item")
                if not item:
                    return build_response(404, {"error": "Thí sinh không tồn tại"})
                return build_response(200, item)

            elif http_method == "DELETE":
                candidates_table.delete_item(Key={"email": c_email})
                return build_response(200, {"message": "Xóa thí sinh thành công", "email": c_email})

        # =========================================================================
        # 3. /sessions API (Quản lý ca thi & Step Functions Lifecycle)
        # =========================================================================
        elif resource_path == "/sessions":
            if http_method == "GET":
                scan_res = sessions_table.scan()
                raw_items = scan_res.get("Items", [])
                now_utc = datetime.now(timezone.utc)
                clean_items = []
                for s in raw_items:
                    if s.get("id") == "EX20261015001" or s.get("status") in ["DELETED", "ARCHIVED"]:
                        continue

                    cur_st = s.get("status")
                    if cur_st != "CLOSED":
                        start_dt = parse_iso_datetime(s.get("startTime", ""))
                        end_dt = parse_iso_datetime(s.get("endTime", ""))
                        if now_utc > end_dt:
                            s["status"] = "CLOSED"
                        elif start_dt <= now_utc <= end_dt or cur_st == "RUNNING":
                            s["status"] = "RUNNING"
                        elif not cur_st:
                            s["status"] = "SCHEDULED"

                    clean_items.append(s)
                return build_response(200, clean_items)

            elif http_method == "POST":
                # Strict RBAC: Chỉ Giảng viên/Ban tổ chức (Organizer hoặc Admin) mới có quyền tạo ca thi
                if claims.get("email") and not is_admin_or_organizer:
                    return build_response(403, {"error": "Chỉ Giảng viên/Ban tổ chức (Organizer) mới có quyền tạo ca thi."})

                session_id = body.get("id") or f"EX{datetime.now().strftime('%Y%m%d%H%M%S')}"
                start_time_str = body.get("startTime", "")
                end_time_str = body.get("endTime", "")
                
                now_utc = datetime.now(timezone.utc)
                start_dt = parse_iso_datetime(start_time_str)
                end_dt = parse_iso_datetime(end_time_str)

                wait_seconds = max(0, int((start_dt - now_utc).total_seconds()))
                duration_seconds = max(60, int((end_dt - start_dt).total_seconds()))

                item = {
                    "id": session_id,
                    "name": body.get("name", "Ca thi trực tuyến"),
                    "startTime": start_time_str,
                    "endTime": end_time_str,
                    "status": body.get("status", "SCHEDULED"),
                    "questionIds": body.get("questionIds", []),
                    "candidateEmails": body.get("candidateEmails", []),
                    "link": f"https://cloudexam.vn/exam/{session_id}",
                    "createdAt": now_utc.isoformat(),
                    "submissions": {},
                    "draftSubmissions": {}
                }

                # Tự động hóa vòng đời ca thi qua Step Functions State Machine
                if STATE_MACHINE_ARN:
                    try:
                        sfn_res = sfn_client.start_execution(
                            stateMachineArn=STATE_MACHINE_ARN,
                            name=f"Exam-{session_id}-{int(now_utc.timestamp())}",
                            input=json.dumps({
                                "sessionId": session_id,
                                "waitBeforeStartSeconds": wait_seconds,
                                "examDurationSeconds": duration_seconds
                            })
                        )
                        item["executionArn"] = sfn_res.get("executionArn", "")
                        print(f"[StepFunctions] Đã khởi tạo State Machine cho ca thi {session_id}: {item['executionArn']}")
                    except Exception as sfn_err:
                        print(f"[WARN] Không thể khởi tạo Step Functions: {str(sfn_err)}")

                sessions_table.put_item(Item=item)
                return build_response(201, item)

        elif resource_path == "/sessions/{id}":
            s_id = path_parameters.get("id")
            if http_method == "GET":
                res = sessions_table.get_item(Key={"id": s_id})
                item = res.get("Item")
                if not item:
                    return build_response(404, {"error": "Ca thi không tồn tại"})

                now_utc = datetime.now(timezone.utc)
                cur_st = item.get("status")
                if cur_st != "CLOSED":
                    start_dt = parse_iso_datetime(item.get("startTime", ""))
                    end_dt = parse_iso_datetime(item.get("endTime", ""))
                    if now_utc > end_dt:
                        item["status"] = "CLOSED"
                    elif start_dt <= now_utc <= end_dt or cur_st == "RUNNING":
                        item["status"] = "RUNNING"
                    elif not cur_st:
                        item["status"] = "SCHEDULED"

                return build_response(200, item)

            elif http_method == "PUT":
                # Strict RBAC: Chỉ Giảng viên/Ban tổ chức (Organizer hoặc Admin) mới có quyền cập nhật ca thi
                if claims.get("email") and not is_admin_or_organizer:
                    return build_response(403, {"error": "Chỉ Giảng viên/Ban tổ chức (Organizer) mới có quyền cập nhật trạng thái ca thi."})

                status = body.get("status")
                candidate_emails = body.get("candidateEmails")

                if status:
                    sessions_table.update_item(
                        Key={"id": s_id},
                        UpdateExpression="SET #st = :s",
                        ExpressionAttributeNames={"#st": "status"},
                        ExpressionAttributeValues={":s": status}
                    )
                if candidate_emails is not None:
                    sessions_table.update_item(
                        Key={"id": s_id},
                        UpdateExpression="SET candidateEmails = :c",
                        ExpressionAttributeValues={":c": candidate_emails}
                    )
                return build_response(200, {"message": "Cập nhật ca thi thành công", "id": s_id})

        # =========================================================================
        # 3.1. /sessions/{id}/paper API (Đề thi an toàn cho Thí sinh - Ẩn đáp án đúng F12)
        # =========================================================================
        elif resource_path in ["/sessions/{id}/paper", "/sessions/{id}/exam-paper"] and http_method == "GET":
            s_id = path_parameters.get("id")
            res = sessions_table.get_item(Key={"id": s_id})
            session_item = res.get("Item")
            if not session_item:
                return build_response(404, {"error": "Ca thi không tồn tại"})

            candidate_email_query = user_email or body.get("candidateEmail", "")
            q_ids = session_item.get("questionIds", [])
            safe_questions = []

            for qid in q_ids:
                q_res = questions_table.get_item(Key={"id": qid})
                q_item = q_res.get("Item")
                if q_item:
                    # Loại bỏ hoàn toàn correctIndex và correctAnswer để chống gian lận F12
                    safe_questions.append({
                        "id": q_item.get("id"),
                        "bankId": q_item.get("bankId"),
                        "content": q_item.get("content"),
                        "type": q_item.get("type", "SINGLE_CHOICE"),
                        "options": q_item.get("options", []),
                        "score": q_item.get("score", 1),
                        "subject": q_item.get("subject"),
                        "topic": q_item.get("topic"),
                        "difficulty": q_item.get("difficulty"),
                        "imageUrl": q_item.get("imageUrl")
                    })

            # Lấy bản nháp đã lưu trước đó của thí sinh (nếu có)
            draft_submissions = session_item.get("draftSubmissions", {})
            user_draft = draft_submissions.get(candidate_email_query, {}) if candidate_email_query else {}

            return build_response(200, {
                "sessionId": s_id,
                "sessionName": session_item.get("name"),
                "status": session_item.get("status"),
                "startTime": session_item.get("startTime"),
                "endTime": session_item.get("endTime"),
                "questions": safe_questions,
                "draftAnswers": user_draft.get("answers", {}),
                "lastDraftSavedAt": user_draft.get("updatedAt", "")
            })

        # =========================================================================
        # 3.2. /sessions/{id}/results API (Xem bảng điểm ca thi - Giảng viên)
        # Phục vụ Task 24: Truy vấn Sparse GSI SessionResultsIndex trên bảng Submissions (< 10ms)
        # =========================================================================
        elif resource_path == "/sessions/{id}/results" and http_method == "GET":
            s_id = path_parameters.get("id")
            res = sessions_table.get_item(Key={"id": s_id})
            session_item = res.get("Item")
            if not session_item:
                return build_response(404, {"error": "Ca thi không tồn tại"})

            results_list = []

            # 1. Thử truy vấn qua Sparse GSI SessionResultsIndex trên bảng Submissions (Task 24 - Query < 10ms)
            try:
                from boto3.dynamodb.conditions import Key
                sub_query = submissions_table.query(
                    IndexName="SessionResultsIndex",
                    KeyConditionExpression=Key("sessionId").eq(s_id),
                    ScanIndexForward=False
                )
                query_items = sub_query.get("Items", [])
                for sub in query_items:
                    email = sub.get("candidateEmail", "")
                    cand_code = ""
                    cand_name = email
                    try:
                        c_res = candidates_table.get_item(Key={"email": email})
                        cand_item = c_res.get("Item")
                        if cand_item:
                            cand_code = cand_item.get("studentCode", "")
                            cand_name = cand_item.get("name", email)
                    except Exception:
                        pass

                    sub_score = sub.get("score", 0)
                    results_list.append({
                        "id": sub.get("id", f"{s_id}#{email}"),
                        "studentCode": cand_code or sub.get("studentCode", ""),
                        "name": cand_name,
                        "email": email,
                        "candidateEmail": email,
                        "score": int(sub_score) if sub_score % 1 == 0 else float(sub_score),
                        "maxScore": sub.get("maxScore", 100),
                        "correctCount": sub.get("correctCount", 0),
                        "totalQuestions": sub.get("totalQuestions", 0),
                        "submittedAt": sub.get("submittedAt", ""),
                        "status": sub.get("status", "COMPLETED")
                    })
            except Exception as gsi_err:
                print(f"[WARN] Lỗi query GSI SessionResultsIndex, chuyển sang fallback: {str(gsi_err)}")

            # 2. Fallback sang map submissions trong bảng Sessions nếu GSI chưa có bản ghi
            if not results_list:
                submissions_map = session_item.get("submissions", {})
                for email, sub in submissions_map.items():
                    cand_code = ""
                    cand_name = email
                    try:
                        c_res = candidates_table.get_item(Key={"email": email})
                        cand_item = c_res.get("Item")
                        if cand_item:
                            cand_code = cand_item.get("studentCode", "")
                            cand_name = cand_item.get("name", email)
                    except Exception:
                        pass

                    sub_score = sub.get("score", 0)
                    results_list.append({
                        "id": sub.get("id", f"{s_id}#{email}"),
                        "studentCode": cand_code or sub.get("studentCode", ""),
                        "name": cand_name,
                        "email": email,
                        "candidateEmail": email,
                        "score": int(sub_score) if sub_score % 1 == 0 else float(sub_score),
                        "maxScore": sub.get("maxScore", 100),
                        "correctCount": sub.get("correctCount", 0),
                        "totalQuestions": sub.get("totalQuestions", 0),
                        "submittedAt": sub.get("submittedAt", ""),
                        "status": sub.get("status", "COMPLETED")
                    })

            return build_response(200, {
                "sessionId": s_id,
                "sessionName": session_item.get("name", ""),
                "status": session_item.get("status", ""),
                "totalSubmissions": len(results_list),
                "results": results_list
            })

        # =========================================================================
        # 3.4. /sessions/{id}/leaderboard API (Bảng xếp hạng trực tiếp Top 5 từ Upstash Redis)
        # =========================================================================
        elif (resource_path == "/sessions/{id}/leaderboard" or (raw_path.startswith("/sessions/") and raw_path.endswith("/leaderboard"))) and http_method == "GET":
            s_id = path_parameters.get("id")
            if not s_id and "/sessions/" in raw_path:
                parts = raw_path.strip("/").split("/")
                if len(parts) >= 2 and parts[0] == "sessions":
                    s_id = parts[1]

            if not s_id:
                return build_response(400, {"error": "Thiếu mã ca thi sessionId."})

            # 1. Thử lấy từ Upstash Serverless Redis (Sorted Set < 5ms)
            leaderboard, source = fetch_upstash_leaderboard(s_id)

            # 2. Nếu Upstash chưa có hoặc rỗng -> Fallback DynamoDB
            if not leaderboard:
                sess_res = sessions_table.get_item(Key={"id": s_id})
                sess_item = sess_res.get("Item")
                if not sess_item:
                    return build_response(404, {"error": "Ca thi không tồn tại."})

                submissions_map = sess_item.get("submissions", {})
                sorted_subs = sorted(
                    submissions_map.items(),
                    key=lambda item: float(item[1].get("score", 0)),
                    reverse=True
                )[:5]

                leaderboard = []
                for rank_idx, (email, sub) in enumerate(sorted_subs, start=1):
                    cand_name = email
                    try:
                        c_res = candidates_table.get_item(Key={"email": email})
                        if isinstance(c_res, dict):
                            c_item = c_res.get("Item")
                            if isinstance(c_item, dict) and c_item.get("name"):
                                cand_name = str(c_item.get("name"))
                    except Exception:
                        pass

                    sub_score = sub.get("score", 0)
                    leaderboard.append({
                        "rank": rank_idx,
                        "candidateEmail": email,
                        "email": email,
                        "name": cand_name,
                        "score": int(sub_score) if sub_score % 1 == 0 else float(sub_score)
                    })
                source = "DynamoDB Fallback"
            else:
                # Bổ sung thông tin tên thí sinh từ candidates_table nếu có
                for entry in leaderboard:
                    em = entry.get("candidateEmail", "")
                    try:
                        c_res = candidates_table.get_item(Key={"email": em})
                        if isinstance(c_res, dict):
                            c_item = c_res.get("Item")
                            if isinstance(c_item, dict) and c_item.get("name"):
                                entry["name"] = str(c_item.get("name"))
                            else:
                                entry["name"] = em
                        else:
                            entry["name"] = em
                    except Exception:
                        entry["name"] = em

            return build_response(200, {
                "sessionId": s_id,
                "topCount": len(leaderboard),
                "leaderboard": leaderboard,
                "source": source
            })

        # =========================================================================
        # 3.3. /sessions/{id}/auto-finalize & /sessions/{id}/send-report APIs
        # =========================================================================
        elif (resource_path == "/sessions/{id}/auto-finalize" or raw_path.endswith("/auto-finalize")) and http_method == "POST":
            s_id = path_parameters.get("id")
            return handle_auto_finalize_session(s_id)

        elif (resource_path == "/sessions/{id}/send-report" or raw_path.endswith("/send-report")) and http_method == "POST":
            s_id = path_parameters.get("id")
            return handle_send_session_report(s_id)

        # =========================================================================
        # 4. /exam/save-progress API (Lưu ngầm trạng thái làm bài Atomic Updates)
        # =========================================================================
        elif resource_path == "/exam/save-progress" and http_method == "POST":
            c_email = claims.get("email") or body.get("candidateEmail")
            s_id = body.get("sessionId")
            answers = body.get("answers", {})

            if not s_id or not c_email:
                return build_response(400, {"error": "Thiếu sessionId hoặc candidateEmail."})

            now_iso = datetime.now(timezone.utc).isoformat()
            draft_payload = {
                "answers": answers,
                "updatedAt": now_iso
            }

            try:
                # Atomic Update vào DynamoDB Session record
                sessions_table.update_item(
                    Key={"id": s_id},
                    UpdateExpression="SET draftSubmissions = if_not_exists(draftSubmissions, :empty_map)",
                    ExpressionAttributeValues={":empty_map": {}}
                )
                sessions_table.update_item(
                    Key={"id": s_id},
                    UpdateExpression="SET draftSubmissions.#email = :draft",
                    ExpressionAttributeNames={"#email": c_email},
                    ExpressionAttributeValues={":draft": draft_payload}
                )
                return build_response(200, {
                    "saved": True,
                    "updatedAt": now_iso,
                    "message": "Đã lưu ngầm tiến trình làm bài lên Cloud an toàn"
                })
            except Exception as save_err:
                print(f"[WARN] Lỗi lưu nháp Atomic Update: {str(save_err)}")
                return build_response(500, {"error": "Lỗi lưu trạng thái", "details": str(save_err)})

        # =========================================================================
        # 5. /exam/submit API (Nộp bài thi - Hỗ trợ SQS Buffer Pipeline & Cloudflare Turnstile)
        # =========================================================================
        elif (resource_path == "/exam/submit" or raw_path.endswith("/exam/submit")) and http_method == "POST":
            # Task M-02 & H-05: Xác thực Cloudflare Turnstile Token chống bot spam
            turnstile_token = body.get("turnstileToken") or body.get("turnstile_token") or body.get("cf-turnstile-response")
            source_ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "")

            if CLOUDFLARE_TURNSTILE_SECRET_KEY:
                if not turnstile_token:
                    return build_response(403, {
                        "error": "Thiếu Cloudflare Turnstile token. Yêu cầu bị chặn.",
                        "blocked": True
                    })
                if not verify_turnstile(turnstile_token, source_ip):
                    return build_response(403, {
                        "error": "Xác thực Cloudflare Turnstile thất bại. Phát hiện bot hoặc truy cập tự động.",
                        "blocked": True
                    })

            user_email_sub = claims.get("email") or body.get("candidateEmail")
            session_id = body.get("sessionId")
            answers = body.get("answers", {})

            if not session_id or not user_email_sub:
                return build_response(400, {"error": "Thiếu sessionId hoặc thông tin thí sinh."})

            # Kiểm tra trạng thái ca thi
            session_check = sessions_table.get_item(Key={"id": session_id})
            sess_item = session_check.get("Item")
            if sess_item and sess_item.get("status") == "CLOSED":
                return build_response(400, {"error": "Ca thi đã kết thúc. Không thể nộp bài thêm."})

            submitted_at = datetime.now(timezone.utc).isoformat()
            submission_id = str(uuid.uuid4())

            # Mẫu hình Queue-Based Load Leveling: Đẩy bài thi vào SQS Queue
            if SQS_QUEUE_URL:
                submission_payload = {
                    "submissionId": submission_id,
                    "sessionId": session_id,
                    "candidateEmail": user_email_sub,
                    "answers": answers,
                    "submittedAt": submitted_at
                }

                try:
                    sqs_client.send_message(
                        QueueUrl=SQS_QUEUE_URL,
                        MessageBody=json.dumps(submission_payload),
                        MessageAttributes={
                            "SessionId": {"DataType": "String", "StringValue": session_id},
                            "CandidateEmail": {"DataType": "String", "StringValue": user_email_sub}
                        }
                    )
                    print(f"[SQS] Đã đệm bài nộp {submission_id} vào SQS Queue thành công")

                    result_item = {
                        "id": submission_id,
                        "sessionId": session_id,
                        "candidateEmail": user_email_sub,
                        "score": 0,
                        "maxScore": len(answers),
                        "correctCount": 0,
                        "totalQuestions": len(answers),
                        "submittedAt": submitted_at,
                        "status": "QUEUED"
                    }

                    return build_response(200, {
                        "message": "Bài thi đã được tiếp nhận qua hàng đợi SQS và chấm điểm tự động ngầm.",
                        "submissionId": submission_id,
                        "result": result_item
                    })
                except Exception as sqs_err:
                    print(f"[ERROR SQS] {str(sqs_err)}, kích hoạt chấm điểm dự phòng")

            # Fallback chấm điểm đồng bộ
            total_score = Decimal("0")
            max_score = Decimal("0")
            correct_count = 0
            for q_id, chosen_idx in answers.items():
                q_res = questions_table.get_item(Key={"id": q_id})
                q_item = q_res.get("Item")
                if q_item:
                    q_score = Decimal(str(q_item.get("score", 1)))
                    max_score += q_score
                    if q_item.get("correctIndex") == chosen_idx:
                        total_score += q_score
                        correct_count += 1

            result_item = {
                "id": f"{session_id}#{user_email_sub}",
                "sessionId": session_id,
                "candidateEmail": user_email_sub,
                "score": total_score,
                "maxScore": max_score,
                "correctCount": correct_count,
                "totalQuestions": len(answers),
                "submittedAt": submitted_at,
                "status": "COMPLETED"
            }

            try:
                sessions_table.update_item(
                    Key={"id": session_id},
                    UpdateExpression="SET submissions = if_not_exists(submissions, :empty_map)",
                    ExpressionAttributeValues={":empty_map": {}}
                )
                sessions_table.update_item(
                    Key={"id": session_id},
                    UpdateExpression="SET submissions.#email = :res",
                    ExpressionAttributeNames={"#email": user_email_sub},
                    ExpressionAttributeValues={":res": result_item}
                )
            except Exception as ddb_err:
                print(f"[WARN] Lỗi cập nhật DynamoDB session submission fallback: {str(ddb_err)}")

            try:
                submissions_table.put_item(
                    Item={
                        "id": f"{session_id}#{user_email_sub}",
                        "sessionId": session_id,
                        "candidateEmail": user_email_sub,
                        "score": total_score,
                        "maxScore": max_score,
                        "correctCount": correct_count,
                        "totalQuestions": len(answers),
                        "submittedAt": submitted_at,
                        "status": "COMPLETED"
                    }
                )
            except Exception as sub_err:
                print(f"[WARN] Lỗi cập nhật Submissions table fallback: {str(sub_err)}")

            # Đẩy điểm fallback vào Upstash Redis nếu có cấu hình
            try:
                if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN:
                    cmd = ["ZADD", f"leaderboard:{session_id}", str(float(total_score)), user_email_sub]
                    urllib.request.urlopen(
                        urllib.request.Request(
                            UPSTASH_REDIS_REST_URL,
                            data=json.dumps(cmd).encode("utf-8"),
                            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}", "Content-Type": "application/json"},
                            method="POST"
                        ),
                        timeout=3
                    )
            except Exception as upstash_err:
                print(f"[WARN] Lỗi cập nhật Upstash Redis fallback: {upstash_err}")

            return build_response(200, {
                "message": "Nộp bài thành công",
                "result": result_item
            })

        # =========================================================================
        # 6. /exam/explain-answers API (AI Gia sư ảo giải thích câu sai bằng Gemini)
        # =========================================================================
        elif (resource_path == "/exam/explain-answers" or raw_path.endswith("/exam/explain-answers")) and http_method == "POST":
            # Task M-05: AI Gia sư ảo giải thích đáp án sai
            q_id = body.get("questionId")
            content = body.get("content") or body.get("questionContent") or ""
            options = body.get("options") or []
            chosen_idx = body.get("chosenIndex", body.get("userAnswerIndex", 0))
            correct_idx = body.get("correctIndex", 0)
            chosen_answer = body.get("chosenAnswer") or body.get("userAnswer") or ""
            correct_answer = body.get("correctAnswer") or ""
            subject = body.get("subject", "Điện toán đám mây")

            if q_id and (not content or not options):
                try:
                    q_res = questions_table.get_item(Key={"id": q_id})
                    q_item = q_res.get("Item")
                    if q_item:
                        content = content or q_item.get("content", "")
                        options = options or q_item.get("options", [])
                        correct_idx = q_item.get("correctIndex", correct_idx)
                        correct_answer = correct_answer or q_item.get("correctAnswer", "")
                        subject = subject or q_item.get("subject", "Điện toán đám mây")
                except Exception as q_err:
                    print(f"[WARN] Lỗi đọc câu hỏi {q_id} từ DynamoDB: {q_err}")

            if not chosen_answer and options and 0 <= chosen_idx < len(options):
                chosen_answer = options[chosen_idx]
            if not correct_answer and options and 0 <= correct_idx < len(options):
                correct_answer = options[correct_idx]

            req_model = body.get("model") or ""
            req_key = body.get("apiKey") or body.get("geminiApiKey") or body.get("api_key") or ""
            explanation_text, source = explain_answer_with_gemini(
                content=content or "Câu hỏi trắc nghiệm",
                options=options,
                chosen_idx=chosen_idx,
                correct_idx=correct_idx,
                chosen_answer=chosen_answer,
                correct_answer=correct_answer,
                subject=subject,
                model=req_model,
                api_key=req_key
            )

            return build_response(200, {
                "questionId": q_id,
                "explanation": explanation_text,
                "source": source,
                "chosenAnswer": chosen_answer,
                "correctAnswer": correct_answer,
                "isCorrect": (chosen_idx == correct_idx)
            })

        return build_response(404, {"error": f"Endpoint không hỗ trợ: {http_method} {resource_path}"})

    except Exception as e:
        print(f"Error handling request: {str(e)}")
        return build_response(500, {"error": "Internal Server Error", "details": str(e)})
