"""
CloudExam - Lambda Grading Worker
Tiêu thụ các message nộp bài thi bất đồng bộ từ Amazon SQS (Batch Size = 10).
Thực hiện chấm điểm trắc nghiệm tự động, ghi nhận kết quả vào DynamoDB Sessions.
Hỗ trợ cơ chế báo cáo lỗi theo từng bản ghi (ReportBatchItemFailures) để SQS chỉ retry message lỗi.
Sau 3 lần retry thất bại, SQS tự động chuyển bản ghi vào Dead Letter Queue (DLQ).
"""

import json
import os
import boto3
from decimal import Decimal
from datetime import datetime, timezone

# Khởi tạo DynamoDB Resource
REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
questions_table = dynamodb.Table(f"CloudExam_Questions_{ENV}")
sessions_table = dynamodb.Table(f"CloudExam_Sessions_{ENV}")

# Bộ nhớ đệm tạm thời cho câu hỏi trong vòng đời container Lambda (tiết kiệm DynamoDB RCU)
_QUESTIONS_CACHE = {}


def get_question_item(question_id: str):
    """Truy vấn câu hỏi có áp dụng cache trong cùng container Lambda"""
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

    # Chấm điểm từng câu hỏi
    for q_id, chosen_idx in answers.items():
        q_item = get_question_item(q_id)
        if not q_item:
            continue

        q_score = Decimal(str(q_item.get("score", 1)))
        max_score += q_score
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

    # Ghi nhận kết quả vào bảng CloudExam_Sessions_{ENV}
    try:
        # Cố gắng ghi vào map submissions
        sessions_table.update_item(
            Key={"id": session_id},
            UpdateExpression="SET submissions.#email = :res",
            ExpressionAttributeNames={"#email": candidate_email},
            ExpressionAttributeValues={":res": submission_result}
        )
    except Exception as err:
        # Nếu thuộc tính submissions chưa từng tồn tại trên record Session, khởi tạo map rỗng trước
        print(f"[WARN] Khởi tạo map submissions cho ca thi {session_id}: {str(err)}")
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
