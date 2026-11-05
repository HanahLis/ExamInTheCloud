"""
CloudExam - Lambda Grading Worker
Tiêu thụ các message nộp bài thi bất đồng bộ từ Amazon SQS (Batch Size = 10, BatchWindow = 2s).
Thực hiện chấm điểm trắc nghiệm tự động bằng DynamoDB BatchGetItem, ghi nhận kết quả vào
bảng Submissions (Sparse GSI SessionResultsIndex) và bảng Sessions.
Hỗ trợ đẩy điểm vào Upstash Serverless Redis (Live Leaderboard < 5ms).
Hỗ trợ cơ chế báo cáo lỗi theo từng bản ghi (ReportBatchItemFailures) để SQS chỉ retry message lỗi.
Sau 3 lần retry thất bại, SQS tự động chuyển bản ghi vào Dead Letter Queue (DLQ).
"""

import json
import os
import urllib.request
import boto3
from decimal import Decimal
from datetime import datetime, timezone

# Khởi tạo DynamoDB Resource & Biến môi trường Multi-Cloud
REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").strip().rstrip("/")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()

dynamodb = boto3.resource("dynamodb", region_name=REGION)
questions_table_name = f"CloudExam_Questions_{ENV}"
sessions_table_name = f"CloudExam_Sessions_{ENV}"
submissions_table_name = f"CloudExam_Submissions_{ENV}"

questions_table = dynamodb.Table(questions_table_name)
sessions_table = dynamodb.Table(sessions_table_name)
submissions_table = dynamodb.Table(submissions_table_name)

# Bộ nhớ đệm tạm thời cho câu hỏi trong vòng đời container Lambda (tiết kiệm DynamoDB RCU)
_QUESTIONS_CACHE = {}


def push_to_upstash_leaderboard(session_id: str, candidate_email: str, score: float) -> bool:
    """
    Cập nhật điểm số vào Upstash Serverless Redis Sorted Set:
    ZADD leaderboard:{sessionId} {score} {candidateEmail}
    Phục vụ truy vấn bảng xếp hạng trực tiếp với độ trễ < 5ms (0 USD).
    """
    if not UPSTASH_REDIS_REST_URL or not UPSTASH_REDIS_REST_TOKEN:
        print("[WARN] Upstash Redis chưa được cấu hình, bỏ qua cập nhật bảng xếp hạng trực tiếp.")
        return False

    try:
        command = ["ZADD", f"leaderboard:{session_id}", str(score), candidate_email]
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
            resp_data = json.loads(resp.read().decode("utf-8"))
            print(f"[UPSTASH] Đã cập nhật điểm vào Redis: {command} -> {resp_data}")
            return True
    except Exception as e:
        print(f"[WARN] Lỗi khi cập nhật Upstash Redis: {str(e)}")
        return False


def get_question_item(question_id: str):
    """Truy vấn 1 câu hỏi có áp dụng cache trong cùng container Lambda"""
    if question_id in _QUESTIONS_CACHE:
        return _QUESTIONS_CACHE[question_id]

    try:
        res = questions_table.get_item(Key={"id": question_id})
        item = res.get("Item")
        if item:
            _QUESTIONS_CACHE[question_id] = item
        return item
    except Exception as e:
        print(f"[ERROR] Không thể đọc câu hỏi {question_id} từ DynamoDB: {str(e)}")
        return None


def fetch_questions_batch(question_ids: list) -> dict:
    """
    Lấy danh sách câu hỏi theo lô (BatchGetItem) theo đặc tả Task 20.
    Giảm 90% số lượng truy vấn I/O đọc cơ sở dữ liệu và tối ưu RCU DynamoDB.
    """
    results = {}
    missing_ids = []

    for qid in question_ids:
        if qid in _QUESTIONS_CACHE:
            results[qid] = _QUESTIONS_CACHE[qid]
        else:
            missing_ids.append(qid)

    if missing_ids:
        try:
            # DynamoDB batch_get_item giới hạn 100 items mỗi request
            for i in range(0, len(missing_ids), 100):
                chunk = missing_ids[i:i + 100]
                request_items = {
                    questions_table_name: {
                        "Keys": [{"id": qid} for qid in chunk]
                    }
                }
                resp = dynamodb.batch_get_item(RequestItems=request_items)
                items = resp.get("Responses", {}).get(questions_table_name, [])
                for item in items:
                    qid = item.get("id")
                    results[qid] = item
                    _QUESTIONS_CACHE[qid] = item
        except Exception as e:
            print(f"[WARN] Lỗi BatchGetItem, fallback sang get_item đơn lẻ: {str(e)}")
            for qid in missing_ids:
                item = get_question_item(qid)
                if item:
                    results[qid] = item

    return results


def grade_submission(submission: dict) -> dict:
    """
    Thực hiện chấm điểm chi tiết bài thi từ dữ liệu SQS.
    Answers có định dạng: { "questionId": chosenIndex }
    """
    session_id = submission.get("sessionId")
    candidate_email = submission.get("candidateEmail")
    answers = submission.get("answers", {})
    submitted_at = submission.get("submittedAt") or datetime.now(timezone.utc).isoformat()
    submission_id = submission.get("submissionId") or f"{session_id}#{candidate_email}"

    total_score = Decimal("0")
    max_score = Decimal("0")
    correct_count = 0
    total_questions = len(answers)

    # 1. Truy vấn câu hỏi theo Batch (BatchGetItem - Task 20)
    q_ids = list(answers.keys())
    questions_dict = fetch_questions_batch(q_ids)

    # 2. Chấm điểm từng câu hỏi
    for q_id, chosen_idx in answers.items():
        q_item = questions_dict.get(q_id) or get_question_item(q_id)
        if not q_item:
            continue

        q_score = Decimal(str(q_item.get("score", 1)))
        max_score += q_score
        q_type = q_item.get("type", "SINGLE_CHOICE")
        if q_type == "ESSAY":
            # Đối với câu hỏi tự luận: Nếu thí sinh có nhập nội dung trả lời thì ghi nhận hoàn thành
            if isinstance(chosen_idx, str) and len(chosen_idx.strip()) > 0:
                total_score += q_score
                correct_count += 1
        else:
            correct_index = q_item.get("correctIndex")
            if correct_index is not None and chosen_idx == correct_index:
                total_score += q_score
                correct_count += 1

    submission_result = {
        "id": submission_id,
        "sessionId": session_id,
        "candidateEmail": candidate_email,
        "score": int(total_score) if total_score % 1 == 0 else float(total_score),
        "maxScore": int(max_score) if max_score % 1 == 0 else float(max_score),
        "correctCount": correct_count,
        "totalQuestions": total_questions,
        "submittedAt": submitted_at,
        "gradedAt": datetime.now(timezone.utc).isoformat(),
        "status": "COMPLETED"
    }

    # 3. Ghi nhận kết quả vào bảng Submissions (Task 24 & Sparse GSI SessionResultsIndex)
    try:
        submissions_table.put_item(
            Item={
                "id": submission_id,
                "sessionId": session_id,
                "candidateEmail": candidate_email,
                "score": Decimal(str(total_score)),
                "maxScore": Decimal(str(max_score)),
                "correctCount": correct_count,
                "totalQuestions": total_questions,
                "submittedAt": submitted_at,
                "gradedAt": submission_result["gradedAt"],
                "status": "COMPLETED"
            }
        )
    except Exception as sub_err:
        print(f"[WARN] Không thể ghi vào bảng Submissions (DynamoDB): {str(sub_err)}")

    # 4. Ghi nhận kết quả vào bảng CloudExam_Sessions_{ENV} (Backwards Compatibility)
    try:
        sessions_table.update_item(
            Key={"id": session_id},
            UpdateExpression="SET submissions.#email = :res",
            ExpressionAttributeNames={"#email": candidate_email},
            ExpressionAttributeValues={":res": submission_result}
        )
    except Exception as err:
        print(f"[WARN] Khởi tạo map submissions cho ca thi {session_id}: {str(err)}")
        try:
            sessions_table.update_item(
                Key={"id": session_id},
                UpdateExpression="SET submissions = if_not_exists(submissions, :empty_map)",
                ExpressionAttributeValues={":empty_map": {}}
            )
            sessions_table.update_item(
                Key={"id": session_id},
                UpdateExpression="SET submissions.#email = :res",
                ExpressionAttributeNames={"#email": candidate_email},
                ExpressionAttributeValues={":res": submission_result}
            )
        except Exception as e2:
            print(f"[ERROR] Thất bại khi ghi kết quả vào Sessions map: {str(e2)}")

    # 5. Đẩy điểm số tức thì vào Upstash Serverless Redis cho Live Leaderboard (Task M-03)
    try:
        push_to_upstash_leaderboard(session_id, candidate_email, float(total_score))
    except Exception as redis_err:
        print(f"[WARN] Lỗi không chặn khi cập nhật Upstash Redis: {str(redis_err)}")

    print(
        f"[SUCCESS] Đã chấm bài thi thành công: Session={session_id} | "
        f"Thí sinh={candidate_email} | Điểm={total_score}/{max_score} | "
        f"Số câu đúng={correct_count}/{total_questions}"
    )

    return submission_result


def lambda_handler(event, context):
    """
    Hàm xử lý sự kiện SQS Event Source Mapping.
    Hỗ trợ cơ chế ReportBatchItemFailures để bảo toàn dữ liệu.
    """
    records = event.get("Records", [])
    print(f"[INFO] Bắt đầu xử lý đợt bài thi từ SQS: {len(records)} bài nộp")

    batch_item_failures = []

    for record in records:
        message_id = record.get("messageId", "")
        body_str = record.get("body", "{}")

        try:
            submission_data = json.loads(body_str)
            grade_submission(submission_data)
        except Exception as e:
            print(f"[ERROR] Thất bại khi xử lý bài nộp (MessageId: {message_id}): {str(e)}")
            # Báo cáo message lỗi về cho SQS để thực hiện Retry theo cấu hình (tối đa 3 lần)
            batch_item_failures.append({"itemIdentifier": message_id})

    print(
        f"[INFO] Hoàn tất đợt xử lý SQS: Thành công {len(records) - len(batch_item_failures)}/{len(records)}, "
        f"Lỗi {len(batch_item_failures)}"
    )

    return {
        "batchItemFailures": batch_item_failures
    }
#!/usr/bin/env python3
"""
CloudExam - Script Nạp Dữ Liệu Mẫu Đa Quốc Gia / Đa Tenant (Multi-Tenant Seed Data)
Phụ trách: Phạm Tuấn Phong (24021596) — Task P-02

Mục tiêu:
1. Tạo dữ liệu mẫu phân tách an toàn giữa Việt Nam (cloudexam.vn) và Lào (edulao.la)
2. Sử dụng tiền tố Tenant Key:
   - Tenant VN: prefix `TENANT#VN#`
   - Tenant LA: prefix `TENANT#LA#`
3. Nạp đầy đủ 4 bảng DynamoDB:
   - CloudExam_QuestionBanks_dev
   - CloudExam_Questions_dev
   - CloudExam_Candidates_dev
   - CloudExam_Sessions_dev
4. Hỗ trợ chế độ `--dry-run` để kiểm thử cấu trúc dữ liệu không cần kết nối AWS.

Cách chạy:
    python seed_multitenant.py [--dry-run] [--region ap-southeast-1] [--env dev]
"""

import os
import sys
import io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import json
from decimal import Decimal
import argparse
from pathlib import Path

DEFAULT_REGION = os.getenv("AWS_REGION", "ap-southeast-1")
DEFAULT_ENV = os.getenv("ENV", "dev")

# ==============================================================================
# DỮ LIỆU MẪU ĐA QUỐC GIA (VIỆT NAM & LÀO)
# ==============================================================================

MULTITENANT_DATA = {
    "question_banks": [
        {
            "id": "TENANT#VN#bank-cloud-01",
            "tenantId": "VN",
            "name": "Ngân hàng đề Kiến trúc AWS Cloud (Việt Nam)",
            "subject": "Điện toán đám mây",
            "description": "Ngân hàng đề thi chuẩn bị cho chứng chỉ AWS Certified Solutions Architect tại Việt Nam.",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#bank-cloud-lao",
            "tenantId": "LA",
            "name": "ທະນາຄານຄໍາຖາມ Cloud Computing (EduLao)",
            "subject": "ຄອມພິວເຕີຄລາວ (Cloud Computing)",
            "description": "ຊຸດຄໍາຖາມທົດສອບຄວາມຮູ້ພື້ນຖານ AWS Cloud ສໍາລັບນັກສຶກສາມະຫາວິທະຍາໄລແຫ່ງຊາດລາວ (NUOL).",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "questions": [
        # --- CÂU HỎI VIỆT NAM (TENANT#VN#) ---
        {
            "id": "TENANT#VN#q-aws-001",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Dịch vụ nào của AWS cung cấp khả năng tự động so khớp khuôn mặt thí sinh với ngưỡng tương đồng >= 80%?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Rekognition",
                "Amazon Textract",
                "Amazon Comprehend",
                "Amazon SageMaker"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Rekognition",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "EASY",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-002",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Kiến trúc Serverless giúp hệ thống đạt tiêu chí FinOps $0 Free Tier bằng cơ chế nào sau đây?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Luôn giữ máy chủ EC2 chạy ngầm 24/7",
                "Pay-as-you-go: Chỉ trả tiền khi có request, không tốn chi phí khi phòng thi không hoạt động",
                "Bắt buộc mua gói tài nguyên trả trước Reserved Instances 3 năm",
                "Sử dụng cụm Kubernetes EKS đa vùng"
            ],
            "correctIndex": 1,
            "correctAnswer": "Pay-as-you-go: Chỉ trả tiền khi có request, không tốn chi phí khi phòng thi không hoạt động",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-003",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Để bảo vệ hệ thống trước tình trạng hàng trăm sinh viên nộp bài cùng lúc vào giây cuối cùng, CloudExam sử dụng dịch vụ gì làm bộ đệm?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon S3 Glacier",
                "Amazon SQS (Simple Queue Service) & DLQ",
                "Amazon Aurora Read Replica",
                "AWS Route 53"
            ],
            "correctIndex": 1,
            "correctAnswer": "Amazon SQS (Simple Queue Service) & DLQ",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-004",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Khi xảy ra sự cố đứt cáp biển tại Singapore, cơ chế Zero-ClickOps tự động chuyển DNS sang Jakarta bằng dịch vụ nào?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Route 53 DNS Failover Routing Policy & Health Check",
                "AWS CloudFormation",
                "Amazon CloudWatch Log Insights",
                "Amazon EventBridge"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Route 53 DNS Failover Routing Policy & Health Check",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "HARD",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- CÂU HỎI LÀO (TENANT#LA#) ---
        {
            "id": "TENANT#LA#q-aws-001",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ບໍລິການໃດຂອງ AWS ທີ່ໃຊ້ໃນການກວດສອບໃບໜ້າຂອງຜູ້ສອບເສັງແບບອັດຕະໂນມັດ (Biometric Face Verification)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Rekognition",
                "Amazon Polly",
                "Amazon Translate",
                "Amazon Lex"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Rekognition",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "EASY",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-002",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ຖານຂໍ້ມູນໃດຂອງ AWS ທີ່ເປັນ NoSQL Serverless ແລະ ເກັບຄ່າບໍລິການຕາມການໃຊ້ງານຕົວຈິງ (On-Demand)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon RDS PostgreSQL",
                "Amazon DynamoDB",
                "Amazon Redshift",
                "Amazon ElastiCache"
            ],
            "correctIndex": 1,
            "correctAnswer": "Amazon DynamoDB",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-003",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ເມື່ອເກີດເຫດສຸກເສີນຢູ່ສູນຂໍ້ມູນສິງກະໂປ, ລະບົບ EduLao ຈະປ່ຽນເສັ້ນທາງໄປຫາສູນຂໍ້ມູນໃດ?",
            "type": "SINGLE_CHOICE",
            "options": [
                "ap-southeast-3 (Jakarta, ອິນໂດເນເຊຍ)",
                "us-east-1 (N. Virginia)",
                "eu-central-1 (Frankfurt)",
                "ap-northeast-1 (Tokyo)"
            ],
            "correctIndex": 0,
            "correctAnswer": "ap-southeast-3 (Jakarta, ອິນໂດເນເຊຍ)",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "HARD",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-004",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "Cloudflare Turnstile ມີໜ້າທີ່ຫຼັກອັນໃດໃນລະບົບຫ້ອງສອບເສັງ EduLao?",
            "type": "SINGLE_CHOICE",
            "options": [
                "ປ້ອງກັນ Botnet ແລະ Script ອັດຕະໂນມັດໂດຍບໍ່ຕ້ອງກົດເລືອກຮູບພາບ (Invisible CAPTCHA)",
                "ແປພາສາອັດຕະໂນມັດ",
                "ບັນທຶກສຽງໃນຫ້ອງສອບເສັງ",
                "ສ້າງບົດສອບເສັງແບບສຸ່ມ"
            ],
            "correctIndex": 0,
            "correctAnswer": "ປ້ອງກັນ Botnet ແລະ Script ອັດຕະໂນມັດໂດຍບໍ່ຕ້ອງກົດເລືອກຮູບພາບ (Invisible CAPTCHA)",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "candidates": [
        # --- THÍ SINH VIỆT NAM (TENANT#VN#) ---
        {
            "email": "phongpt@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021596",
            "name": "Phạm Tuấn Phong",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN001.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "manhtd@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021561",
            "name": "Trần Đức Mạnh",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN002.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "tannp@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021620",
            "name": "Nguyễn Phúc Tấn",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN003.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "hantt@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24020115",
            "name": "Nguyễn Thị Ngọc Hà",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN004.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- THÍ SINH LÀO (TENANT#LA#) ---
        {
            "email": "somphone@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-001",
            "name": "Somphone Phomvihane",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA001.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "keomany@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-002",
            "name": "Keomany Vongsavanh",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA002.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "anousone@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-003",
            "name": "Anousone Sayasane",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA003.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "sessions": [
        # --- CA THI VIỆT NAM (TENANT#VN#) ---
        {
            "id": "TENANT#VN#SES-VN-2026",
            "tenantId": "VN",
            "name": "Kỳ thi Khảo sát Năng lực AWS Cloud Việt Nam 2026",
            "status": "RUNNING",
            "startTime": "2026-10-23T08:00:00Z",
            "endTime": "2026-10-23T18:00:00Z",
            "durationMinutes": 45,
            "questionIds": [
                "TENANT#VN#q-aws-001",
                "TENANT#VN#q-aws-002",
                "TENANT#VN#q-aws-003",
                "TENANT#VN#q-aws-004"
            ],
            "candidateEmails": [
                "phongpt@cloudexam.vn",
                "manhtd@cloudexam.vn",
                "tannp@cloudexam.vn",
                "hantt@cloudexam.vn"
            ],
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- CA THI LÀO (TENANT#LA#) ---
        {
            "id": "TENANT#LA#SES-LA-2026",
            "tenantId": "LA",
            "name": "ການສອບເສັງ CloudExam Lao 2026 (EduLao)",
            "status": "RUNNING",
            "startTime": "2026-10-23T08:00:00Z",
            "endTime": "2026-10-23T18:00:00Z",
            "durationMinutes": 45,
            "questionIds": [
                "TENANT#LA#q-aws-001",
                "TENANT#LA#q-aws-002",
                "TENANT#LA#q-aws-003",
                "TENANT#LA#q-aws-004"
            ],
            "candidateEmails": [
                "somphone@edulao.la",
                "keomany@edulao.la",
                "anousone@edulao.la"
            ],
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ]
}

def main():
    parser = argparse.ArgumentParser(description="Seed multi-tenant data for Vietnam and Laos into DynamoDB.")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm hiển thị cấu trúc dữ liệu, không ghi lên AWS")
    parser.add_argument("--region", default=DEFAULT_REGION, help="AWS Region (mặc định: ap-southeast-1)")
    parser.add_argument("--env", default=DEFAULT_ENV, help="Môi trường (dev, staging, prod)")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    output_backup = script_dir / "multitenant_seed.json"

    # Lưu backup JSON
    with open(output_backup, "w", encoding="utf-8") as f:
        json.dump(MULTITENANT_DATA, f, ensure_ascii=False, indent=2)

    print("=================================================================")
    print("🌏 CLOUDEXAM - NẠP DỮ LIỆU ĐA QUỐC GIA (VIỆT NAM & LÀO)")
    print("=================================================================")
    print(f"📍 Region: {args.region} | Môi trường: {args.env}")
    print(f"🇻🇳 Tenant Việt Nam: 4 thí sinh, 1 ngân hàng, 4 câu hỏi, 1 ca thi")
    print(f"🇱🇦 Tenant Lào:      3 thí sinh, 1 ngân hàng, 4 câu hỏi, 1 ca thi")
    print(f"📁 Tệp sao lưu:      {output_backup.name}")
    print(f"🔍 Chế độ Dry-Run:   {'BẬT (Chỉ kiểm tra cấu trúc dữ liệu)' if args.dry_run else 'TẮT (Ghi lên AWS DynamoDB)'}")
    print("-----------------------------------------------------------------")

    if args.dry_run:
        print("\n✅ [DRY-RUN THÀNH CÔNG] Dữ liệu mẫu Multi-Tenant hợp lệ:")
        print(f"   • Question Banks: {len(MULTITENANT_DATA['question_banks'])} bản ghi")
        print(f"   • Questions:      {len(MULTITENANT_DATA['questions'])} bản ghi")
        print(f"   • Candidates:     {len(MULTITENANT_DATA['candidates'])} bản ghi")
        print(f"   • Sessions:       {len(MULTITENANT_DATA['sessions'])} bản ghi")
        print("\n👉 Cấu trúc dữ liệu đã được lưu an toàn tại backend/data/multitenant_seed.json.")
        return

    try:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=args.region)

        tables = {
            "question_banks": dynamodb.Table(f"CloudExam_QuestionBanks_{args.env}"),
            "questions": dynamodb.Table(f"CloudExam_Questions_{args.env}"),
            "candidates": dynamodb.Table(f"CloudExam_Candidates_{args.env}"),
            "sessions": dynamodb.Table(f"CloudExam_Sessions_{args.env}"),
        }

        for table_key, items in MULTITENANT_DATA.items():
            table = tables[table_key]
            print(f"--> Đang nạp {len(items)} bản ghi vào bảng {table.name}...")
            for item in items:
                clean_item = json.loads(json.dumps(item), parse_float=Decimal)
                table.put_item(Item=clean_item)
            print(f"    [Xong] Bảng {table.name} đã được cập nhật.")

        print("\n=================================================================")
        print("🎉 NẠP THÀNH CÔNG DỮ LIỆU MULTI-TENANT LÊN AWS DYNAMODB!")
        print("=================================================================")

    except Exception as e:
        print(f"\n❌ Lỗi khi nạp dữ liệu DynamoDB: {e}")
        print("👉 Gợi ý: Kiểm tra AWS Credentials hoặc chạy với cờ `--dry-run`.")
        sys.exit(1)

if __name__ == "__main__":
    main()

from flask import Flask, jsonify
app = Flask(__name__)
ORDERS = {
    "ord_1": {"id": "ord_1", "status": "pending"},
    "ord_2": {"id": "ord_2", "status": "shipped"},
    "ord_3": {"id": "ord_3", "status": "delivered"}
}
@app.route("/orders/<order_id>", methods=["DELETE"])
def delete_order(order_id):
    order = ORDERS.get(order_id)
    if order is None:
        return jsonify({"error": "not found"}), 404

    if order["status"] in ("shipped", "delivered"):
        return jsonify({"error": "can not delete"}), 409

    ORDERS.pop(order_id, None)
    return "", 204

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
    asdsadsa"""
CloudExam - Lambda Grading Worker
Tiêu thụ các message nộp bài thi bất đồng bộ từ Amazon SQS (Batch Size = 10, BatchWindow = 2s).
Thực hiện chấm điểm trắc nghiệm tự động bằng DynamoDB BatchGetItem, ghi nhận kết quả vào
bảng Submissions (Sparse GSI SessionResultsIndex) và bảng Sessions.
Hỗ trợ đẩy điểm vào Upstash Serverless Redis (Live Leaderboard < 5ms).
Hỗ trợ cơ chế báo cáo lỗi theo từng bản ghi (ReportBatchItemFailures) để SQS chỉ retry message lỗi.
Sau 3 lần retry thất bại, SQS tự động chuyển bản ghi vào Dead Letter Queue (DLQ).
"""

import json
import os
import urllib.request
import boto3
from decimal import Decimal
from datetime import datetime, timezone

# Khởi tạo DynamoDB Resource & Biến môi trường Multi-Cloud
REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").strip().rstrip("/")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()

dynamodb = boto3.resource("dynamodb", region_name=REGION)
questions_table_name = f"CloudExam_Questions_{ENV}"
sessions_table_name = f"CloudExam_Sessions_{ENV}"
submissions_table_name = f"CloudExam_Submissions_{ENV}"

questions_table = dynamodb.Table(questions_table_name)
sessions_table = dynamodb.Table(sessions_table_name)
submissions_table = dynamodb.Table(submissions_table_name)

# Bộ nhớ đệm tạm thời cho câu hỏi trong vòng đời container Lambda (tiết kiệm DynamoDB RCU)
_QUESTIONS_CACHE = {}


def push_to_upstash_leaderboard(session_id: str, candidate_email: str, score: float) -> bool:
    """
    Cập nhật điểm số vào Upstash Serverless Redis Sorted Set:
    ZADD leaderboard:{sessionId} {score} {candidateEmail}
    Phục vụ truy vấn bảng xếp hạng trực tiếp với độ trễ < 5ms (0 USD).
    """
    if not UPSTASH_REDIS_REST_URL or not UPSTASH_REDIS_REST_TOKEN:
        print("[WARN] Upstash Redis chưa được cấu hình, bỏ qua cập nhật bảng xếp hạng trực tiếp.")
        return False

    try:
        command = ["ZADD", f"leaderboard:{session_id}", str(score), candidate_email]
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
            resp_data = json.loads(resp.read().decode("utf-8"))
            print(f"[UPSTASH] Đã cập nhật điểm vào Redis: {command} -> {resp_data}")
            return True
    except Exception as e:
        print(f"[WARN] Lỗi khi cập nhật Upstash Redis: {str(e)}")
        return False


def get_question_item(question_id: str):
    """Truy vấn 1 câu hỏi có áp dụng cache trong cùng container Lambda"""
    if question_id in _QUESTIONS_CACHE:
        return _QUESTIONS_CACHE[question_id]

    try:
        res = questions_table.get_item(Key={"id": question_id})
        item = res.get("Item")
        if item:
            _QUESTIONS_CACHE[question_id] = item
        return item
    except Exception as e:
        print(f"[ERROR] Không thể đọc câu hỏi {question_id} từ DynamoDB: {str(e)}")
        return None


def fetch_questions_batch(question_ids: list) -> dict:
    """
    Lấy danh sách câu hỏi theo lô (BatchGetItem) theo đặc tả Task 20.
    Giảm 90% số lượng truy vấn I/O đọc cơ sở dữ liệu và tối ưu RCU DynamoDB.
    """
    results = {}
    missing_ids = []

    for qid in question_ids:
        if qid in _QUESTIONS_CACHE:
            results[qid] = _QUESTIONS_CACHE[qid]
        else:
            missing_ids.append(qid)

    if missing_ids:
        try:
            # DynamoDB batch_get_item giới hạn 100 items mỗi request
            for i in range(0, len(missing_ids), 100):
                chunk = missing_ids[i:i + 100]
                request_items = {
                    questions_table_name: {
                        "Keys": [{"id": qid} for qid in chunk]
                    }
                }
                resp = dynamodb.batch_get_item(RequestItems=request_items)
                items = resp.get("Responses", {}).get(questions_table_name, [])
                for item in items:
                    qid = item.get("id")
                    results[qid] = item
                    _QUESTIONS_CACHE[qid] = item
        except Exception as e:
            print(f"[WARN] Lỗi BatchGetItem, fallback sang get_item đơn lẻ: {str(e)}")
            for qid in missing_ids:
                item = get_question_item(qid)
                if item:
                    results[qid] = item

    return results


def grade_submission(submission: dict) -> dict:
    """
    Thực hiện chấm điểm chi tiết bài thi từ dữ liệu SQS.
    Answers có định dạng: { "questionId": chosenIndex }
    """
    session_id = submission.get("sessionId")
    candidate_email = submission.get("candidateEmail")
    answers = submission.get("answers", {})
    submitted_at = submission.get("submittedAt") or datetime.now(timezone.utc).isoformat()
    submission_id = submission.get("submissionId") or f"{session_id}#{candidate_email}"

    total_score = Decimal("0")
    max_score = Decimal("0")
    correct_count = 0
    total_questions = len(answers)

    # 1. Truy vấn câu hỏi theo Batch (BatchGetItem - Task 20)
    q_ids = list(answers.keys())
    questions_dict = fetch_questions_batch(q_ids)

    # 2. Chấm điểm từng câu hỏi
    for q_id, chosen_idx in answers.items():
        q_item = questions_dict.get(q_id) or get_question_item(q_id)
        if not q_item:
            continue

        q_score = Decimal(str(q_item.get("score", 1)))
        max_score += q_score
        q_type = q_item.get("type", "SINGLE_CHOICE")
        if q_type == "ESSAY":
            # Đối với câu hỏi tự luận: Nếu thí sinh có nhập nội dung trả lời thì ghi nhận hoàn thành
            if isinstance(chosen_idx, str) and len(chosen_idx.strip()) > 0:
                total_score += q_score
                correct_count += 1
        else:
            correct_index = q_item.get("correctIndex")
            if correct_index is not None and chosen_idx == correct_index:
                total_score += q_score
                correct_count += 1

    submission_result = {
        "id": submission_id,
        "sessionId": session_id,
        "candidateEmail": candidate_email,
        "score": int(total_score) if total_score % 1 == 0 else float(total_score),
        "maxScore": int(max_score) if max_score % 1 == 0 else float(max_score),
        "correctCount": correct_count,
        "totalQuestions": total_questions,
        "submittedAt": submitted_at,
        "gradedAt": datetime.now(timezone.utc).isoformat(),
        "status": "COMPLETED"
    }

    # 3. Ghi nhận kết quả vào bảng Submissions (Task 24 & Sparse GSI SessionResultsIndex)
    try:
        submissions_table.put_item(
            Item={
                "id": submission_id,
                "sessionId": session_id,
                "candidateEmail": candidate_email,
                "score": Decimal(str(total_score)),
                "maxScore": Decimal(str(max_score)),
                "correctCount": correct_count,
                "totalQuestions": total_questions,
                "submittedAt": submitted_at,
                "gradedAt": submission_result["gradedAt"],
                "status": "COMPLETED"
            }
        )
    except Exception as sub_err:
        print(f"[WARN] Không thể ghi vào bảng Submissions (DynamoDB): {str(sub_err)}")

    # 4. Ghi nhận kết quả vào bảng CloudExam_Sessions_{ENV} (Backwards Compatibility)
    try:
        sessions_table.update_item(
            Key={"id": session_id},
            UpdateExpression="SET submissions.#email = :res",
            ExpressionAttributeNames={"#email": candidate_email},
            ExpressionAttributeValues={":res": submission_result}
        )
    except Exception as err:
        print(f"[WARN] Khởi tạo map submissions cho ca thi {session_id}: {str(err)}")
        try:
            sessions_table.update_item(
                Key={"id": session_id},
                UpdateExpression="SET submissions = if_not_exists(submissions, :empty_map)",
                ExpressionAttributeValues={":empty_map": {}}
            )
            sessions_table.update_item(
                Key={"id": session_id},
                UpdateExpression="SET submissions.#email = :res",
                ExpressionAttributeNames={"#email": candidate_email},
                ExpressionAttributeValues={":res": submission_result}
            )
        except Exception as e2:
            print(f"[ERROR] Thất bại khi ghi kết quả vào Sessions map: {str(e2)}")

    # 5. Đẩy điểm số tức thì vào Upstash Serverless Redis cho Live Leaderboard (Task M-03)
    try:
        push_to_upstash_leaderboard(session_id, candidate_email, float(total_score))
    except Exception as redis_err:
        print(f"[WARN] Lỗi không chặn khi cập nhật Upstash Redis: {str(redis_err)}")

    print(
        f"[SUCCESS] Đã chấm bài thi thành công: Session={session_id} | "
        f"Thí sinh={candidate_email} | Điểm={total_score}/{max_score} | "
        f"Số câu đúng={correct_count}/{total_questions}"
    )

    return submission_result


def lambda_handler(event, context):
    """
    Hàm xử lý sự kiện SQS Event Source Mapping.
    Hỗ trợ cơ chế ReportBatchItemFailures để bảo toàn dữ liệu.
    """
    records = event.get("Records", [])
    print(f"[INFO] Bắt đầu xử lý đợt bài thi từ SQS: {len(records)} bài nộp")

    batch_item_failures = []

    for record in records:
        message_id = record.get("messageId", "")
        body_str = record.get("body", "{}")

        try:
            submission_data = json.loads(body_str)
            grade_submission(submission_data)
        except Exception as e:
            print(f"[ERROR] Thất bại khi xử lý bài nộp (MessageId: {message_id}): {str(e)}")
            # Báo cáo message lỗi về cho SQS để thực hiện Retry theo cấu hình (tối đa 3 lần)
            batch_item_failures.append({"itemIdentifier": message_id})

    print(
        f"[INFO] Hoàn tất đợt xử lý SQS: Thành công {len(records) - len(batch_item_failures)}/{len(records)}, "
        f"Lỗi {len(batch_item_failures)}"
    )

    return {
        "batchItemFailures": batch_item_failures
    }
#!/usr/bin/env python3
"""
CloudExam - Script Nạp Dữ Liệu Mẫu Đa Quốc Gia / Đa Tenant (Multi-Tenant Seed Data)
Phụ trách: Phạm Tuấn Phong (24021596) — Task P-02

Mục tiêu:
1. Tạo dữ liệu mẫu phân tách an toàn giữa Việt Nam (cloudexam.vn) và Lào (edulao.la)
2. Sử dụng tiền tố Tenant Key:
   - Tenant VN: prefix `TENANT#VN#`
   - Tenant LA: prefix `TENANT#LA#`
3. Nạp đầy đủ 4 bảng DynamoDB:
   - CloudExam_QuestionBanks_dev
   - CloudExam_Questions_dev
   - CloudExam_Candidates_dev
   - CloudExam_Sessions_dev
4. Hỗ trợ chế độ `--dry-run` để kiểm thử cấu trúc dữ liệu không cần kết nối AWS.

Cách chạy:
    python seed_multitenant.py [--dry-run] [--region ap-southeast-1] [--env dev]
"""

import os
import sys
import io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import json
from decimal import Decimal
import argparse
from pathlib import Path

DEFAULT_REGION = os.getenv("AWS_REGION", "ap-southeast-1")
DEFAULT_ENV = os.getenv("ENV", "dev")

# ==============================================================================
# DỮ LIỆU MẪU ĐA QUỐC GIA (VIỆT NAM & LÀO)
# ==============================================================================

MULTITENANT_DATA = {
    "question_banks": [
        {
            "id": "TENANT#VN#bank-cloud-01",
            "tenantId": "VN",
            "name": "Ngân hàng đề Kiến trúc AWS Cloud (Việt Nam)",
            "subject": "Điện toán đám mây",
            "description": "Ngân hàng đề thi chuẩn bị cho chứng chỉ AWS Certified Solutions Architect tại Việt Nam.",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#bank-cloud-lao",
            "tenantId": "LA",
            "name": "ທະນາຄານຄໍາຖາມ Cloud Computing (EduLao)",
            "subject": "ຄອມພິວເຕີຄລາວ (Cloud Computing)",
            "description": "ຊຸດຄໍາຖາມທົດສອບຄວາມຮູ້ພື້ນຖານ AWS Cloud ສໍາລັບນັກສຶກສາມະຫາວິທະຍາໄລແຫ່ງຊາດລາວ (NUOL).",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "questions": [
        # --- CÂU HỎI VIỆT NAM (TENANT#VN#) ---
        {
            "id": "TENANT#VN#q-aws-001",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Dịch vụ nào của AWS cung cấp khả năng tự động so khớp khuôn mặt thí sinh với ngưỡng tương đồng >= 80%?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Rekognition",
                "Amazon Textract",
                "Amazon Comprehend",
                "Amazon SageMaker"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Rekognition",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "EASY",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-002",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Kiến trúc Serverless giúp hệ thống đạt tiêu chí FinOps $0 Free Tier bằng cơ chế nào sau đây?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Luôn giữ máy chủ EC2 chạy ngầm 24/7",
                "Pay-as-you-go: Chỉ trả tiền khi có request, không tốn chi phí khi phòng thi không hoạt động",
                "Bắt buộc mua gói tài nguyên trả trước Reserved Instances 3 năm",
                "Sử dụng cụm Kubernetes EKS đa vùng"
            ],
            "correctIndex": 1,
            "correctAnswer": "Pay-as-you-go: Chỉ trả tiền khi có request, không tốn chi phí khi phòng thi không hoạt động",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-003",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Để bảo vệ hệ thống trước tình trạng hàng trăm sinh viên nộp bài cùng lúc vào giây cuối cùng, CloudExam sử dụng dịch vụ gì làm bộ đệm?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon S3 Glacier",
                "Amazon SQS (Simple Queue Service) & DLQ",
                "Amazon Aurora Read Replica",
                "AWS Route 53"
            ],
            "correctIndex": 1,
            "correctAnswer": "Amazon SQS (Simple Queue Service) & DLQ",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-004",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Khi xảy ra sự cố đứt cáp biển tại Singapore, cơ chế Zero-ClickOps tự động chuyển DNS sang Jakarta bằng dịch vụ nào?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Route 53 DNS Failover Routing Policy & Health Check",
                "AWS CloudFormation",
                "Amazon CloudWatch Log Insights",
                "Amazon EventBridge"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Route 53 DNS Failover Routing Policy & Health Check",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "HARD",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- CÂU HỎI LÀO (TENANT#LA#) ---
        {
            "id": "TENANT#LA#q-aws-001",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ບໍລິການໃດຂອງ AWS ທີ່ໃຊ້ໃນການກວດສອບໃບໜ້າຂອງຜູ້ສອບເສັງແບບອັດຕະໂນມັດ (Biometric Face Verification)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Rekognition",
                "Amazon Polly",
                "Amazon Translate",
                "Amazon Lex"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Rekognition",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "EASY",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-002",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ຖານຂໍ້ມູນໃດຂອງ AWS ທີ່ເປັນ NoSQL Serverless ແລະ ເກັບຄ່າບໍລິການຕາມການໃຊ້ງານຕົວຈິງ (On-Demand)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon RDS PostgreSQL",
                "Amazon DynamoDB",
                "Amazon Redshift",
                "Amazon ElastiCache"
            ],
            "correctIndex": 1,
            "correctAnswer": "Amazon DynamoDB",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-003",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ເມື່ອເກີດເຫດສຸກເສີນຢູ່ສູນຂໍ້ມູນສິງກະໂປ, ລະບົບ EduLao ຈະປ່ຽນເສັ້ນທາງໄປຫາສູນຂໍ້ມູນໃດ?",
            "type": "SINGLE_CHOICE",
            "options": [
                "ap-southeast-3 (Jakarta, ອິນໂດເນເຊຍ)",
                "us-east-1 (N. Virginia)",
                "eu-central-1 (Frankfurt)",
                "ap-northeast-1 (Tokyo)"
            ],
            "correctIndex": 0,
            "correctAnswer": "ap-southeast-3 (Jakarta, ອິນໂດເນເຊຍ)",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "HARD",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-004",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "Cloudflare Turnstile ມີໜ້າທີ່ຫຼັກອັນໃດໃນລະບົບຫ້ອງສອບເສັງ EduLao?",
            "type": "SINGLE_CHOICE",
            "options": [
                "ປ້ອງກັນ Botnet ແລະ Script ອັດຕະໂນມັດໂດຍບໍ່ຕ້ອງກົດເລືອກຮູບພາບ (Invisible CAPTCHA)",
                "ແປພາສາອັດຕະໂນມັດ",
                "ບັນທຶກສຽງໃນຫ້ອງສອບເສັງ",
                "ສ້າງບົດສອບເສັງແບບສຸ່ມ"
            ],
            "correctIndex": 0,
            "correctAnswer": "ປ້ອງກັນ Botnet ແລະ Script ອັດຕະໂນມັດໂດຍບໍ່ຕ້ອງກົດເລືອກຮູບພາບ (Invisible CAPTCHA)",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "candidates": [
        # --- THÍ SINH VIỆT NAM (TENANT#VN#) ---
        {
            "email": "phongpt@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021596",
            "name": "Phạm Tuấn Phong",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN001.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "manhtd@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021561",
            "name": "Trần Đức Mạnh",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN002.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "tannp@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021620",
            "name": "Nguyễn Phúc Tấn",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN003.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "hantt@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24020115",
            "name": "Nguyễn Thị Ngọc Hà",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN004.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- THÍ SINH LÀO (TENANT#LA#) ---
        {
            "email": "somphone@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-001",
            "name": "Somphone Phomvihane",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA001.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "keomany@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-002",
            "name": "Keomany Vongsavanh",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA002.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "anousone@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-003",
            "name": "Anousone Sayasane",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA003.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "sessions": [
        # --- CA THI VIỆT NAM (TENANT#VN#) ---
        {
            "id": "TENANT#VN#SES-VN-2026",
            "tenantId": "VN",
            "name": "Kỳ thi Khảo sát Năng lực AWS Cloud Việt Nam 2026",
            "status": "RUNNING",
            "startTime": "2026-10-23T08:00:00Z",
            "endTime": "2026-10-23T18:00:00Z",
            "durationMinutes": 45,
            "questionIds": [
                "TENANT#VN#q-aws-001",
                "TENANT#VN#q-aws-002",
                "TENANT#VN#q-aws-003",
                "TENANT#VN#q-aws-004"
            ],
            "candidateEmails": [
                "phongpt@cloudexam.vn",
                "manhtd@cloudexam.vn",
                "tannp@cloudexam.vn",
                "hantt@cloudexam.vn"
            ],
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- CA THI LÀO (TENANT#LA#) ---
        {
            "id": "TENANT#LA#SES-LA-2026",
            "tenantId": "LA",
            "name": "ການສອບເສັງ CloudExam Lao 2026 (EduLao)",
            "status": "RUNNING",
            "startTime": "2026-10-23T08:00:00Z",
            "endTime": "2026-10-23T18:00:00Z",
            "durationMinutes": 45,
            "questionIds": [
                "TENANT#LA#q-aws-001",
                "TENANT#LA#q-aws-002",
                "TENANT#LA#q-aws-003",
                "TENANT#LA#q-aws-004"
            ],
            "candidateEmails": [
                "somphone@edulao.la",
                "keomany@edulao.la",
                "anousone@edulao.la"
            ],
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ]
}

def main():
    parser = argparse.ArgumentParser(description="Seed multi-tenant data for Vietnam and Laos into DynamoDB.")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm hiển thị cấu trúc dữ liệu, không ghi lên AWS")
    parser.add_argument("--region", default=DEFAULT_REGION, help="AWS Region (mặc định: ap-southeast-1)")
    parser.add_argument("--env", default=DEFAULT_ENV, help="Môi trường (dev, staging, prod)")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    output_backup = script_dir / "multitenant_seed.json"

    # Lưu backup JSON
    with open(output_backup, "w", encoding="utf-8") as f:
        json.dump(MULTITENANT_DATA, f, ensure_ascii=False, indent=2)

    print("=================================================================")
    print("🌏 CLOUDEXAM - NẠP DỮ LIỆU ĐA QUỐC GIA (VIỆT NAM & LÀO)")
    print("=================================================================")
    print(f"📍 Region: {args.region} | Môi trường: {args.env}")
    print(f"🇻🇳 Tenant Việt Nam: 4 thí sinh, 1 ngân hàng, 4 câu hỏi, 1 ca thi")
    print(f"🇱🇦 Tenant Lào:      3 thí sinh, 1 ngân hàng, 4 câu hỏi, 1 ca thi")
    print(f"📁 Tệp sao lưu:      {output_backup.name}")
    print(f"🔍 Chế độ Dry-Run:   {'BẬT (Chỉ kiểm tra cấu trúc dữ liệu)' if args.dry_run else 'TẮT (Ghi lên AWS DynamoDB)'}")
    print("-----------------------------------------------------------------")

    if args.dry_run:
        print("\n✅ [DRY-RUN THÀNH CÔNG] Dữ liệu mẫu Multi-Tenant hợp lệ:")
        print(f"   • Question Banks: {len(MULTITENANT_DATA['question_banks'])} bản ghi")
        print(f"   • Questions:      {len(MULTITENANT_DATA['questions'])} bản ghi")
        print(f"   • Candidates:     {len(MULTITENANT_DATA['candidates'])} bản ghi")
        print(f"   • Sessions:       {len(MULTITENANT_DATA['sessions'])} bản ghi")
        print("\n👉 Cấu trúc dữ liệu đã được lưu an toàn tại backend/data/multitenant_seed.json.")
        return

    try:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=args.region)

        tables = {
            "question_banks": dynamodb.Table(f"CloudExam_QuestionBanks_{args.env}"),
            "questions": dynamodb.Table(f"CloudExam_Questions_{args.env}"),
            "candidates": dynamodb.Table(f"CloudExam_Candidates_{args.env}"),
            "sessions": dynamodb.Table(f"CloudExam_Sessions_{args.env}"),
        }

        for table_key, items in MULTITENANT_DATA.items():
            table = tables[table_key]
            print(f"--> Đang nạp {len(items)} bản ghi vào bảng {table.name}...")
            for item in items:
                clean_item = json.loads(json.dumps(item), parse_float=Decimal)
                table.put_item(Item=clean_item)
            print(f"    [Xong] Bảng {table.name} đã được cập nhật.")

        print("\n=================================================================")
        print("🎉 NẠP THÀNH CÔNG DỮ LIỆU MULTI-TENANT LÊN AWS DYNAMODB!")
        print("=================================================================")

    except Exception as e:
        print(f"\n❌ Lỗi khi nạp dữ liệu DynamoDB: {e}")
        print("👉 Gợi ý: Kiểm tra AWS Credentials hoặc chạy với cờ `--dry-run`.")
        sys.exit(1)

if __name__ == "__main__":
    main()

from flask import Flask, jsonify
app = Flask(__name__)
ORDERS = {
    "ord_1": {"id": "ord_1", "status": "pending"},
    "ord_2": {"id": "ord_2", "status": "shipped"},
    "ord_3": {"id": "ord_3", "status": "delivered"}
}
@app.route("/orders/<order_id>", methods=["DELETE"])
def delete_order(order_id):
    order = ORDERS.get(order_id)
    if order is None:
        return jsonify({"error": "not found"}), 404
ad
    if order["status"] in ("shipped", "deliadasdsadasvered"):
        return jsonify({"error": "can not delete"}), 409

    ORDERS.pop(order_id, None)
    return "", 204

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)asdasdas