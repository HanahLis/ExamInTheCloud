# ==============================================================================
# AWS LAMBDA FUNCTIONS: CORE REST API & FACE VERIFICATION
# Phụ trách: Mạnh (Authentication, API Gateway, IAM Security)
# ==============================================================================

# 1. Đóng gói mã nguồn Lambda thành file ZIP
data "archive_file" "lambda_payload" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/lambda_payload.zip"
}

# 2. Lambda Core REST API Function
resource "aws_lambda_function" "core_api" {
  function_name    = "${var.project_name}-core-api-${var.environment}"
  role             = aws_iam_role.lambda_core_api.arn
  handler          = "api_handler.lambda_handler"
  runtime          = "python3.11"
  timeout          = 15
  memory_size      = 256
  filename         = data.archive_file.lambda_payload.output_path
  source_code_hash = data.archive_file.lambda_payload.output_base64sha256

  environment {
    variables = {
      ENV            = var.environment
      S3_BUCKET_NAME = var.s3_bucket_name
      SQS_QUEUE_URL  = aws_sqs_queue.exam_submission.url
    }
  }

  tags = {
    Name        = "${var.project_name}-core-api"
    Environment = var.environment
  }
}

# 3. Lambda Face Verification Function
resource "aws_lambda_function" "face_verify" {
  function_name    = "${var.project_name}-face-verify-${var.environment}"
  role             = aws_iam_role.lambda_face_verify.arn
  handler          = "face_verify_handler.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 512
  filename         = data.archive_file.lambda_payload.output_path
  source_code_hash = data.archive_file.lambda_payload.output_base64sha256

  environment {
    variables = {
      ENV            = var.environment
      S3_BUCKET_NAME = var.s3_bucket_name
    }
  }

  tags = {
    Name        = "${var.project_name}-face-verify"
    Environment = var.environment
  }
}

# 4. Lambda Grading Worker Function (Chấm điểm bất đồng bộ từ SQS)
# Phụ trách: Nguyễn Thị Ngọc Hà (24020115) & Trần Đức Mạnh (24021561)
resource "aws_lambda_function" "grading_worker" {
  function_name    = "${var.project_name}-grading-worker-${var.environment}"
  role             = aws_iam_role.lambda_grading_worker.arn
  handler          = "grading_worker.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_payload.output_path
  source_code_hash = data.archive_file.lambda_payload.output_base64sha256

  environment {
    variables = {
      ENV            = var.environment
      S3_BUCKET_NAME = var.s3_bucket_name
    }
  }

  tags = {
    Name        = "${var.project_name}-grading-worker"
    Environment = var.environment
    Role        = "AsyncGradingWorker"
    ManagedBy   = "Terraform"
  }
}

# 5. SQS Event Source Mapping cho Lambda Grading Worker (Batch Size = 10)
# Phụ trách: Nguyễn Thị Ngọc Hà (24020115) — Trưởng nhóm
# Task H-02: Cấu hình Event Source Mapping kết nối SQS với Lambda grading_worker (Batch size = 10)
resource "aws_lambda_event_source_mapping" "sqs_to_grading_worker" {
  event_source_arn                   = aws_sqs_queue.exam_submission.arn
  function_name                      = aws_lambda_function.grading_worker.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  function_response_types            = ["ReportBatchItemFailures"]
  enabled                            = true
}

