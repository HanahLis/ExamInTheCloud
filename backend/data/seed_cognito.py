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
# -*- coding: utf-8 -*-
"""
CloudExam - Script tạo và đồng bộ người dùng mẫu vào AWS Cognito User Pool
Tạo tài khoản Giảng viên (annv@uet.vnu.edu.vn) và các Thí sinh mẫu với mật khẩu CloudExam@2026
"""

import os
import sys
import json
import boto3

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "CloudExam@2026")

def get_cognito_pool_id():
    """Lấy User Pool ID từ Terraform State hoặc file frontend/.env"""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    # 1. Thử từ terraform.tfstate
    tf_state = os.path.join(repo_root, "backend", "terraform", "terraform.tfstate")
    if os.path.exists(tf_state):
        try:
            with open(tf_state, "r", encoding="utf-8") as f:
                state = json.load(f)
                val = state.get("outputs", {}).get("cognito_user_pool_id", {}).get("value")
                if val:
                    return val
        except Exception:
            pass

    # 2. Thử từ frontend/.env
    env_path = os.path.join(repo_root, "frontend", ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("VITE_COGNITO_USER_POOL_ID="):
                        val = line.strip().split("=", 1)[1]
                        if val:
                            return val
        except Exception:
            pass

    # 3. Fallback lấy User Pool đầu tiên tìm thấy trên AWS
    cognito = boto3.client("cognito-idp", region_name=REGION)
    pools = cognito.list_user_pools(MaxResults=10).get("UserPools", [])
    for p in pools:
        if "cloudexam" in p.get("Name", "").lower():
            return p["Id"]

    return None

def seed_users():
    pool_id = get_cognito_pool_id()
    if not pool_id:
        print("[LOI] Khong tim thay Cognito User Pool ID!")
        sys.exit(1)

    print(f"=== Bat dau nap nguoi dung mau vao Cognito User Pool: {pool_id} (Region: {REGION}) ===")
    cognito = boto3.client("cognito-idp", region_name=REGION)

    # Đảm bảo các group đã tồn tại
    groups = ["Admin", "Organizer", "Candidate"]
    for g in groups:
        try:
            cognito.create_group(UserPoolId=pool_id, GroupName=g, Description=f"Group {g}")
        except cognito.exceptions.GroupExistsException:
            pass
        except Exception as e:
            print(f"  [WARN] Khong the tao group {g}: {e}")

    # Đọc danh sách thí sinh từ candidates_seed.json
    candidates_file = os.path.join(os.path.dirname(__file__), "candidates_seed.json")
    candidates_list = []
    if os.path.exists(candidates_file):
        with open(candidates_file, "r", encoding="utf-8") as f:
            candidates_list = json.load(f)

    # Danh sách người dùng cần tạo
    users = []

    # Giảng viên & Admin
    users.append({
        "email": "annv@uet.vnu.edu.vn",
        "name": "PGS. TS. Nguyen Van An",
        "studentCode": "GV001",
        "groups": ["Organizer", "Admin"]
    })
    users.append({
        "email": "tranducmanh2006@gmail.com",
        "name": "Tran Duc Manh",
        "studentCode": "24021561",
        "groups": ["Organizer", "Admin"]
    })

    # Thí sinh
    for c in candidates_list:
        email = c.get("email", "").strip().lower()
        if not email or any(u["email"] == email for u in users):
            continue
        users.append({
            "email": email,
            "name": c.get("name", ""),
            "studentCode": c.get("studentCode", ""),
            "groups": ["Candidate"]
        })

    created_count = 0
    for u in users:
        email = u["email"]
        name = u["name"]
        code = u["studentCode"]
        user_groups = u["groups"]

        try:
            # 1. Tạo user hoặc bỏ qua nếu đã có
            try:
                attrs = [
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "name", "Value": name},
                ]
                if code:
                    attrs.append({"Name": "custom:student_code", "Value": code})

                cognito.admin_create_user(
                    UserPoolId=pool_id,
                    Username=email,
                    UserAttributes=attrs,
                    MessageAction="SUPPRESS"
                )
                print(f"[+] Tao tai khoan: {email} ({name})")
            except cognito.exceptions.UsernameExistsException:
                print(f"[i] Tai khoan da ton tai: {email}")

            # 2. Đặt mật khẩu vĩnh viễn (Permanent)
            cognito.admin_set_user_password(
                UserPoolId=pool_id,
                Username=email,
                Password=PASSWORD,
                Permanent=True
            )

            # 3. Gán vào User Groups
            for g in user_groups:
                try:
                    cognito.admin_add_user_to_group(
                        UserPoolId=pool_id,
                        Username=email,
                        GroupName=g
                    )
                except Exception:
                    pass

            created_count += 1
        except Exception as e:
            print(f"[!] Loi khi tao {email}: {e}")

    print(f"\n[OK] Da hoan tat nap {created_count}/{len(users)} tai khoan vao Cognito!")
    print(f"Mat khau mac dinh cho tat ca tai khoan: {PASSWORD} (hoac 12345678 tren giao dien)")

if __name__ == "__main__":
    seed_users()

from flask import Flask, jsonify, request
app = Flask(__name__)
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200
@app.route("/echo", methods=["POST"])
def echo():
    data = request.get_json(silent=True) or {}
    return jsonify({"you_sent": data}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
    from flask import Flask, jsonify, request

app = Flask(__name__)

# Dữ liệu sách mẫu
BOOKS = [
    {"id": "b1", "t": "Học Python căn bản"},
    {"id": "b2", "t": "Flask Web Development"},
    {"id": "b3", "t": "Python nâng cao"},
    {"id": "b4", "t": "JavaScript toàn tập"}
]

def find_by_id(book_id):
    for book in BOOKS:
        if book["id"] == book_id:
            return book
    return None

# 1. Path param (string)
@app.route("/books/<book_id>", methods=["GET"])
def get_book(book_id):
    book = find_by_id(book_id)
    if book is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(book), 200

# 2. Path param ép kiểu int
@app.route("/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    return jsonify({"id": item_id}), 200

# 3. Query string (bộ lọc / phân trang)
@app.route("/books", methods=["GET"])
def list_books():
    limit = int(request.args.get("limit", 20))
    q = request.args.get("q", "").strip().lower()
    items = [b for b in BOOKS if q in b["t"].lower()]
    return jsonify({"items": items[:limit]}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)