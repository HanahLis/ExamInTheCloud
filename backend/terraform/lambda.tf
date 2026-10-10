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
      AWS_REGION     = var.aws_region
      S3_BUCKET_NAME = var.s3_bucket_name
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
      AWS_REGION     = var.aws_region
      S3_BUCKET_NAME = var.s3_bucket_name
    }
  }

  tags = {
    Name        = "${var.project_name}-face-verify"
    Environment = var.environment
  }
}
