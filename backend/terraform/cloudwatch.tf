# ==============================================================================
# AMAZON CLOUDWATCH: LOG GROUPS, METRIC FILTERS & METRIC ALARMS
# Phụ trách: Phạm Tuấn Phong (AI Rekognition, Dữ Liệu Ảnh Thẻ & CloudWatch Alarms)
# Đáp ứng tiêu chí FinOps $0 AWS Free Tier: Lưu trữ log 14 ngày, 10 Alarms miễn phí
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. SNS TOPIC NHẬN CẢNH BÁO GIÁM SÁT HỆ THỐNG
# ------------------------------------------------------------------------------
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts-${var.environment}"

  tags = {
    Name        = "${var.project_name}-alerts"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ------------------------------------------------------------------------------
# 2. CLOUDWATCH LOG GROUPS CHO CÁC HÀM LAMBDA (RETENTION: 14 NGÀY)
# ------------------------------------------------------------------------------

# 2.1. Log Group cho Lambda Core REST API
resource "aws_cloudwatch_log_group" "lambda_core_api" {
  name              = "/aws/lambda/${aws_lambda_function.core_api.function_name}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-log-core-api"
    Environment = var.environment
  }
}

# 2.2. Log Group cho Lambda Face Verification (Rekognition)
resource "aws_cloudwatch_log_group" "lambda_face_verify" {
  name              = "/aws/lambda/${aws_lambda_function.face_verify.function_name}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-log-face-verify"
    Environment = var.environment
  }
}

# 2.3. Log Group cho Lambda Grading Worker (Chuẩn bị cho SQS Pipeline Phase 2)
resource "aws_cloudwatch_log_group" "lambda_grading_worker" {
  name              = "/aws/lambda/${var.project_name}-grading-worker-${var.environment}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-log-grading-worker"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 3. CLOUDWATCH METRIC FILTERS (BÓC TÁCH CHỈ SỐ TỪ LOGS JSON CẤU TRÚC)
# ------------------------------------------------------------------------------

# 3.1. Đếm số lượt xác thực khuôn mặt Thất Bại (FAIL)
resource "aws_cloudwatch_log_metric_filter" "face_verify_failures" {
  name           = "${var.project_name}-face-verify-failures-${var.environment}"
  pattern        = "{ $.event = \"FACE_VERIFICATION_ATTEMPT\" && $.status = \"FAIL\" }"
  log_group_name = aws_cloudwatch_log_group.lambda_face_verify.name

  metric_transformation {
    name          = "FaceVerificationFailures"
    namespace     = "CloudExam/FaceVerify"
    value         = "1"
    default_value = 0
  }
}

# 3.2. Đếm số lượt xác thực khuôn mặt Thành Công (PASS)
resource "aws_cloudwatch_log_metric_filter" "face_verify_success" {
  name           = "${var.project_name}-face-verify-success-${var.environment}"
  pattern        = "{ $.event = \"FACE_VERIFICATION_ATTEMPT\" && $.status = \"PASS\" }"
  log_group_name = aws_cloudwatch_log_group.lambda_face_verify.name

  metric_transformation {
    name          = "FaceVerificationSuccess"
    namespace     = "CloudExam/FaceVerify"
    value         = "1"
    default_value = 0
  }
}

# ------------------------------------------------------------------------------
# 4. CLOUDWATCH METRIC ALARMS (CẢNH BÁO TỰ ĐỘNG)
# ------------------------------------------------------------------------------

# 4.1. Cảnh báo lỗi 5XX trên API Gateway (CRITICAL)
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${var.project_name}-api-5xx-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300 # 5 phút
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Cảnh báo khẩn cấp: API Gateway phát sinh mã lỗi 5XX nội bộ."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ApiName = aws_api_gateway_rest_api.main.name
  }

  tags = {
    Severity    = "CRITICAL"
    Environment = var.environment
  }
}

# 4.2. Cảnh báo lỗi Lambda Face Verification (Rekognition Errors)
resource "aws_cloudwatch_metric_alarm" "lambda_face_verify_errors" {
  alarm_name          = "${var.project_name}-face-verify-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Cảnh báo: Lambda Face Verify gặp >= 3 lỗi trong vòng 5 phút."
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.face_verify.function_name
  }

  tags = {
    Severity    = "HIGH"
    Environment = var.environment
  }
}

# 4.3. Cảnh báo lỗi Lambda Core API
resource "aws_cloudwatch_metric_alarm" "lambda_core_api_errors" {
  alarm_name          = "${var.project_name}-core-api-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Cảnh báo: Lambda Core API gặp >= 3 lỗi trong vòng 5 phút."
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.core_api.function_name
  }

  tags = {
    Severity    = "HIGH"
    Environment = var.environment
  }
}

# 4.4. Cảnh báo có Message trong Hàng Đợi Lỗi Dead Letter Queue (DLQ)
# Kích hoạt khi có bài thi nộp thất bại sau 3 lần retry chấm điểm tự động
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  alarm_name          = "${var.project_name}-sqs-dlq-messages-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0 # Bất kỳ message nào vào DLQ đều phải kích hoạt cảnh báo
  alarm_description   = "Cảnh báo nghiêm trọng: Có bài thi nộp vào Dead Letter Queue (DLQ) do xử lý lỗi!"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = "${var.project_name}-exam-submission-dlq-${var.environment}"
  }

  tags = {
    Severity    = "CRITICAL"
    Environment = var.environment
  }
}

