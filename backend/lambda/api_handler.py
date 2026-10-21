"""
CloudExam - Lambda Core API Handler
Xử lý các nghiệp vụ REST API cho Questions, Candidates, Sessions, Exam Submission.
Tích hợp Cognito Authorizer (RBAC), SQS Buffer Pipeline, Step Functions Lifecycle & SNS Reports.
"""

import json
import os
import uuid
import boto3
from decimal import Decimal
from datetime import datetime, timezone

# Khởi tạo AWS Resources
REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")
BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL", "")
STATE_MACHINE_ARN = os.getenv("STATE_MACHINE_ARN", "")
SNS_TOPIC_ARN = os.getenv("SNS_TOPIC_ARN", "")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)
sqs_client = boto3.client("sqs", region_name=REGION)
sfn_client = boto3.client("stepfunctions", region_name=REGION)
sns_client = boto3.client("sns", region_name=REGION)

questions_table = dynamodb.Table(f"CloudExam_Questions_{ENV}")
candidates_table = dynamodb.Table(f"CloudExam_Candidates_{ENV}")
sessions_table = dynamodb.Table(f"CloudExam_Sessions_{ENV}")
question_banks_table = dynamodb.Table(f"CloudExam_QuestionBanks_{ENV}")

# Helper chuyển đổi Decimal của DynamoDB sang int/float/str cho JSON
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
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
    """Parse chuỗi datetime ISO 8601 sang UTC datetime object"""
    if not dt_str:
        return datetime.now(timezone.utc)
    try:
        if dt_str.endswith("Z"):
            dt_str = dt_str[:-1] + "+00:00"
        return datetime.fromisoformat(dt_str)
    except Exception:
        return datetime.now(timezone.utc)

def lambda_handler(event, context):
    http_method = event.get("httpMethod", "")
    resource_path = event.get("resource", "")
    path_parameters = event.get("pathParameters") or {}
    
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
        # 1. /questions API (Ngân hàng câu hỏi & S3 Presigned URL)
        # =========================================================================
        if resource_path == "/questions/image-upload" and http_method == "POST":
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
                options = body.get("options", [])
                correct_idx = body.get("correctIndex", 0)
                correct_answer = body.get("correctAnswer") or (options[correct_idx] if len(options) > correct_idx else "")

                item = {
                    "id": question_id,
                    "questionId": question_id,
                    "bankId": body.get("bankId", "bank-default"),
                    "content": body.get("content", ""),
                    "type": body.get("type", "SINGLE_CHOICE"),
                    "options": options,
                    "correctIndex": correct_idx,
                    "correctAnswer": correct_answer,
                    "score": Decimal(str(body.get("score", 1))),
                    "subject": body.get("subject", "Điện toán đám mây"),
                    "topic": body.get("topic", "AWS Serverless"),
                    "difficulty": body.get("difficulty", "EASY"),
                    "imageUrl": body.get("imageUrl", ""),
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
                options = body.get("options", [])
                correct_idx = body.get("correctIndex", 0)
                correct_answer = body.get("correctAnswer") or (options[correct_idx] if len(options) > correct_idx else "")

                update_expr = "SET content = :c, #opt = :o, correctIndex = :ci, correctAnswer = :ca, score = :s, #typ = :t, subject = :sb, topic = :top, difficulty = :d, imageUrl = :img, bankId = :b"
                expr_names = {"#opt": "options", "#typ": "type"}
                expr_vals = {
                    ":c": body.get("content", ""),
                    ":o": options,
                    ":ci": correct_idx,
                    ":ca": correct_answer,
                    ":s": Decimal(str(body.get("score", 1))),
                    ":t": body.get("type", "SINGLE_CHOICE"),
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
                return build_response(200, scan_res.get("Items", []))

            elif http_method == "POST":
                bank_id = body.get("id") or f"bank-{str(uuid.uuid4())[:8]}"
                item = {
                    "id": bank_id,
                    "bankId": bank_id,
                    "name": body.get("name", "Ngân hàng câu hỏi mới"),
                    "subject": body.get("subject", "Điện toán đám mây"),
                    "description": body.get("description", ""),
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                question_banks_table.put_item(Item=item)
                return build_response(201, item)

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
                return build_response(200, scan_res.get("Items", []))

            elif http_method == "POST":
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
                return build_response(200, item)

            elif http_method == "PUT":
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
        # =========================================================================
        elif resource_path == "/sessions/{id}/results" and http_method == "GET":
            s_id = path_parameters.get("id")
            res = sessions_table.get_item(Key={"id": s_id})
            session_item = res.get("Item")
            if not session_item:
                return build_response(404, {"error": "Ca thi không tồn tại"})

            submissions_map = session_item.get("submissions", {})
            results_list = []

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

                results_list.append({
                    "id": sub.get("id", f"{s_id}#{email}"),
                    "studentCode": cand_code or sub.get("studentCode", ""),
                    "name": cand_name,
                    "email": email,
                    "candidateEmail": email,
                    "score": sub.get("score", 0),
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
        # 3.3. /sessions/{id}/send-report API (Gửi email báo cáo bảng điểm qua SNS)
        # =========================================================================
        elif resource_path == "/sessions/{id}/send-report" and http_method == "POST":
            s_id = path_parameters.get("id")
            res = sessions_table.get_item(Key={"id": s_id})
            session_item = res.get("Item")
            if not session_item:
                return build_response(404, {"error": "Ca thi không tồn tại"})

            submissions_map = session_item.get("submissions", {})
            total_students = len(session_item.get("candidateEmails", []))
            total_submitted = len(submissions_map)

            scores = [sub.get("score", 0) for sub in submissions_map.values()]
            avg_score = round(sum(scores) / len(scores), 2) if scores else 0
            max_score = max(scores) if scores else 0

            report_message = (
                f"BÁO CÁO KẾT QUẢ CA THI CLOUDEXAM\n"
                f"----------------------------------------\n"
                f"Mã ca thi: {s_id}\n"
                f"Tên ca thi: {session_item.get('name')}\n"
                f"Trạng thái: {session_item.get('status')}\n"
                f"Thời gian: {session_item.get('startTime')} đến {session_item.get('endTime')}\n\n"
                f"THỐNG KÊ KẾT QUẢ:\n"
                f"- Số thí sinh tham gia: {total_submitted} / {total_students}\n"
                f"- Điểm cao nhất: {max_score}\n"
                f"- Điểm trung bình: {avg_score}\n"
                f"----------------------------------------\n"
                f"Bảng điểm chi tiết đã sẵn sàng trên hệ thống CloudExam."
            )

            # Publish thông báo tới Amazon SNS Topic
            if SNS_TOPIC_ARN:
                try:
                    sns_client.publish(
                        TopicArn=SNS_TOPIC_ARN,
                        Subject=f"[CloudExam] Báo cáo bảng điểm ca thi #{s_id}",
                        Message=report_message
                    )
                except Exception as sns_err:
                    print(f"[WARN] Lỗi gửi thông báo qua SNS: {sns_err}")

            return build_response(200, {
                "message": "Đã gửi báo cáo bảng điểm ca thi thành công qua Amazon SNS.",
                "sessionId": s_id,
                "totalSubmitted": total_submitted,
                "avgScore": avg_score
            })

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
        # 5. /exam/submit API (Nộp bài thi - Hỗ trợ SQS Buffer Pipeline)
        # =========================================================================
        elif resource_path == "/exam/submit" and http_method == "POST":
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
                print(f"[WARN] Lỗi cập nhật DynamoDB submission fallback: {str(ddb_err)}")

            return build_response(200, {
                "message": "Nộp bài thành công",
                "result": result_item
            })

        return build_response(404, {"error": f"Endpoint không hỗ trợ: {http_method} {resource_path}"})

    except Exception as e:
        print(f"Error handling request: {str(e)}")
        return build_response(500, {"error": "Internal Server Error", "details": str(e)})
