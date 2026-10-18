# ==============================================================================
# AMAZON SQS: EXAM SUBMISSION QUEUE & DEAD LETTER QUEUE (DLQ)
# ==============================================================================

# 1. Hàng đợi Dead Letter Queue (DLQ) lưu bài nộp thi gặp lỗi xử lý
resource "aws_sqs_queue" "exam_submission_dlq" {
  name                      = "${var.project_name}-exam-submission-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 ngày lưu trữ tối đa để giám thị kiểm tra thủ công
  sqs_managed_sse_enabled   = true    # Mã hóa SSE phía server miễn phí

  tags = {
    Name        = "${var.project_name}-exam-submission-dlq"
    Environment = var.environment
    Role        = "DeadLetterQueue"
    Project     = var.project_name
  }
}

# 2. Cấu hình Redrive Allow Policy cho DLQ
resource "aws_sqs_queue_redrive_allow_policy" "exam_submission_dlq_redrive" {
  queue_url = aws_sqs_queue.exam_submission_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.exam_submission.arn]
  })
}

# 3. Hàng đợi chính tiếp nhận bài nộp thi (Amazon SQS ExamSubmission Queue)
resource "aws_sqs_queue" "exam_submission" {
  name                       = "${var.project_name}-exam-submission-queue-${var.environment}"
  visibility_timeout_seconds = 60    # Gấp đôi thời gian timeout của Lambda Grading Worker (30s)
  message_retention_seconds  = 86400 # Lưu trữ 1 ngày
  receive_wait_time_seconds  = 5     # Long Polling 5s giảm chi phí API calls
  sqs_managed_sse_enabled    = true

  # Sau 3 lần Lambda Worker xử lý thất bại sẽ tự động đẩy sang DLQ
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.exam_submission_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project_name}-exam-submission-queue"
    Environment = var.environment
    Role        = "ExamSubmissionBuffer"
    Project     = var.project_name
  }
}
