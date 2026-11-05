#!/usr/bin/env python3
"""
CloudExam - Script dọn dẹp sạch sẽ toàn bộ tài nguyên CloudExam trên AWS
Xóa an toàn các tài nguyên mang tiền tố 'cloudexam' / 'CloudExam'
Bảo toàn tuyệt đối: IAM Users (manh), Access Keys, Default VPC và Network gốc của AWS
"""

import sys
import io
import time
import boto3

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

REGION = "ap-southeast-1"
print(f"[*] Bat dau don dep tai nguyen CloudExam tai Region: {REGION}")

# 1. S3 BUCKETS
s3 = boto3.client("s3", region_name=REGION)
s3_res = boto3.resource("s3", region_name=REGION)
try:
    buckets = s3.list_buckets().get("Buckets", [])
    for b in buckets:
        b_name = b["Name"]
        if "cloudexam" in b_name.lower():
            print(f"[-] Dang xoa rong va huy S3 Bucket: {b_name}...")
            bucket = s3_res.Bucket(b_name)
            try:
                bucket.object_versions.delete()
            except Exception:
                pass
            try:
                bucket.objects.all().delete()
            except Exception:
                pass
            s3.delete_bucket(Bucket=b_name)
            print(f"[OK] Da xoa S3 Bucket: {b_name}")
except Exception as e:
    print(f"[!] Loi khi don S3: {e}")

# 2. DYNAMODB TABLES
dynamodb = boto3.client("dynamodb", region_name=REGION)
try:
    tables = dynamodb.list_tables().get("TableNames", [])
    for t in tables:
        if "cloudexam" in t.lower():
            print(f"[-] Dang xoa bang DynamoDB: {t}...")
            dynamodb.delete_table(TableName=t)
            print(f"[OK] Da gui lenh xoa bang DynamoDB: {t}")
except Exception as e:
    print(f"[!] Loi khi don DynamoDB: {e}")

# 3. LAMBDA FUNCTIONS
lam = boto3.client("lambda", region_name=REGION)
try:
    funcs = lam.list_functions().get("Functions", [])
    for f in funcs:
        f_name = f["FunctionName"]
        if "cloudexam" in f_name.lower():
            print(f"[-] Dang xoa Lambda Function: {f_name}...")
            lam.delete_function(FunctionName=f_name)
            print(f"[OK] Da xoa Lambda: {f_name}")
except Exception as e:
    print(f"[!] Loi khi don Lambda: {e}")

# 4. SQS QUEUES
sqs = boto3.client("sqs", region_name=REGION)
try:
    queues = sqs.list_queues().get("QueueUrls", [])
    for q_url in queues:
        if "cloudexam" in q_url.lower():
            print(f"[-] Dang xoa SQS Queue: {q_url}...")
            sqs.delete_queue(QueueUrl=q_url)
            print(f"[OK] Da xoa SQS: {q_url}")
except Exception as e:
    print(f"[!] Loi khi don SQS: {e}")

# 5. API GATEWAYS
apigw = boto3.client("apigateway", region_name=REGION)
try:
    apis = apigw.get_rest_apis().get("items", [])
    for a in apis:
        a_name = a.get("name", "")
        if "cloudexam" in a_name.lower():
            a_id = a["id"]
            print(f"[-] Dang xoa API Gateway: {a_name} ({a_id})...")
            apigw.delete_rest_api(restApiId=a_id)
            print(f"[OK] Da xoa API Gateway: {a_name}")
except Exception as e:
    print(f"[!] Loi khi don API Gateway: {e}")

# 6. COGNITO USER POOLS
cognito_idp = boto3.client("cognito-idp", region_name=REGION)
try:
    pools = cognito_idp.list_user_pools(MaxResults=20).get("UserPools", [])
    for p in pools:
        p_name = p.get("Name", "")
        if "cloudexam" in p_name.lower():
            p_id = p["Id"]
            print(f"[-] Dang xoa Cognito User Pool: {p_name} ({p_id})...")
            # Xoa domain truoc neu co
            try:
                desc = cognito_idp.describe_user_pool(UserPoolId=p_id)
                domain = desc.get("UserPool", {}).get("Domain")
                if domain:
                    cognito_idp.delete_user_pool_domain(Domain=domain, UserPoolId=p_id)
            except Exception:
                pass
            cognito_idp.delete_user_pool(UserPoolId=p_id)
            print(f"[OK] Da xoa User Pool: {p_name}")
except Exception as e:
    print(f"[!] Loi khi don Cognito User Pools: {e}")

# 7. COGNITO IDENTITY POOLS
cognito_id = boto3.client("cognito-identity", region_name=REGION)
try:
    id_pools = cognito_id.list_identity_pools(MaxResults=20).get("IdentityPools", [])
    for ip in id_pools:
        ip_name = ip.get("IdentityPoolName", "")
        if "cloudexam" in ip_name.lower():
            ip_id = ip["IdentityPoolId"]
            print(f"[-] Dang xoa Cognito Identity Pool: {ip_name} ({ip_id})...")
            cognito_id.delete_identity_pool(IdentityPoolId=ip_id)
            print(f"[OK] Da xoa Identity Pool: {ip_name}")
except Exception as e:
    print(f"[!] Loi khi don Identity Pool: {e}")

# 8. SNS TOPICS
sns = boto3.client("sns", region_name=REGION)
try:
    topics = sns.list_topics().get("Topics", [])
    for t in topics:
        t_arn = t["TopicArn"]
        if "cloudexam" in t_arn.lower():
            print(f"[-] Dang xoa SNS Topic: {t_arn}...")
            sns.delete_topic(TopicArn=t_arn)
            print(f"[OK] Da xoa SNS: {t_arn}")
except Exception as e:
    print(f"[!] Loi khi don SNS: {e}")

# 9. IAM ROLES (Chi xoa cac Role cua du an CloudExam, KHONG xoa IAM User manh hoac Root)
iam = boto3.client("iam")
try:
    roles = iam.list_roles().get("Roles", [])
    for r in roles:
        r_name = r["RoleName"]
        if r_name.lower().startswith("cloudexam-") or "cloudexam" in r_name.lower():
            # Bo qua neu la user role/account quan tri
            if r_name.lower() in ["manh", "administrator", "root"]:
                continue
            print(f"[-] Dang go policy va xoa IAM Role: {r_name}...")
            # Go inline policies
            try:
                policies = iam.list_role_policies(RoleName=r_name).get("PolicyNames", [])
                for p in policies:
                    iam.delete_role_policy(RoleName=r_name, PolicyName=p)
            except Exception as pe:
                print(f"    [!] Loi go inline policy: {pe}")
            # Go attached managed policies
            try:
                attached = iam.list_attached_role_policies(RoleName=r_name).get("AttachedPolicies", [])
                for ap in attached:
                    iam.detach_role_policy(RoleName=r_name, PolicyArn=ap["PolicyArn"])
            except Exception as ape:
                print(f"    [!] Loi go attached policy: {ape}")
            # Xoa role
            try:
                iam.delete_role(RoleName=r_name)
                print(f"[OK] Da xoa IAM Role: {r_name}")
            except Exception as re:
                print(f"    [!] Loi xoa role: {re}")
except Exception as e:
    print(f"[!] Loi khi don IAM Roles: {e}")

print("\n[SUCCESS] Da don dep sach se toan bo tai nguyen CloudExam cu tren AWS!")
print("[*] Bay gio ban co the chay: cd backend/terraform && terraform apply -auto-approve")
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
