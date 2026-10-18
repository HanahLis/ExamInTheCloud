# ==============================================================================
# IAM ROLES & POLICIES (NGUYÊN TẮC ĐẶC QUYỀN TỐI THIỂU - LEAST PRIVILEGE)
# ==============================================================================

# Data source lấy AWS Account ID hiện tại
data "aws_caller_identity" "current" {}

# ==============================================================================
# 1. IAM ROLE CHO LAMBDA CORE API (CRUD Questions, Candidates, Sessions, Submissions)
# ==============================================================================
resource "aws_iam_role" "lambda_core_api" {
  name = "${var.project_name}-role-lambda-core-api-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "Lambda-Core-API-Role"
    Environment = var.environment
  }
}

# Policy tối thiểu cho Core API Lambda
resource "aws_iam_role_policy" "lambda_core_api_policy" {
  name = "${var.project_name}-policy-lambda-core-api-${var.environment}"
  role = aws_iam_role.lambda_core_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # 1.1. Quyền ghi log CloudWatch
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-*:*"
      },

      # 1.2. Quyền thao tác DynamoDB (Chỉ cho phép 4 bảng của dự án và các GSI)
      # Tuyệt đối không cấp quyền xoá bảng (DeleteTable) hay sửa cấu trúc (UpdateTable)
      {
        Sid    = "DynamoDBTableCRUD"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          aws_dynamodb_table.questions.arn,
          "${aws_dynamodb_table.questions.arn}/index/*",
          aws_dynamodb_table.candidates.arn,
          "${aws_dynamodb_table.candidates.arn}/index/*",
          aws_dynamodb_table.exam_sessions.arn,
          aws_dynamodb_table.question_banks.arn
        ]
      },

      # 1.3. Quyền S3 Storage (Chỉ được đọc/ghi trong thư mục questions và faces)
      {
        Sid    = "S3ImageReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.image_storage.arn}/questions/*",
          "${aws_s3_bucket.image_storage.arn}/faces/*"
        ]
      },

      # 1.4. Quyền đẩy bài nộp thi vào hàng đợi Amazon SQS (SQS Buffer Pipeline)
      {
        Sid    = "SQSSendSubmissionMessage"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueUrl"
        ]
        Resource = aws_sqs_queue.exam_submission.arn
      }
    ]
  })
}


# ==============================================================================
# 2. IAM ROLE CHO LAMBDA FACE VERIFICATION (Xác thực khuôn mặt với Rekognition)
# ==============================================================================
resource "aws_iam_role" "lambda_face_verify" {
  name = "${var.project_name}-role-lambda-face-verify-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "Lambda-Face-Verify-Role"
    Environment = var.environment
  }
}

# Policy tối thiểu cho Face Verification Lambda
resource "aws_iam_role_policy" "lambda_face_verify_policy" {
  name = "${var.project_name}-policy-lambda-face-verify-${var.environment}"
  role = aws_iam_role.lambda_face_verify.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # 2.1. Quyền ghi log CloudWatch
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-face-verify-*:*"
      },

      # 2.2. Quyền DynamoDB CHỈ ĐỌC (Read-Only) để kiểm tra danh sách thí sinh và ca thi
      {
        Sid    = "DynamoDBReadOnly"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.candidates.arn,
          "${aws_dynamodb_table.candidates.arn}/index/*",
          aws_dynamodb_table.exam_sessions.arn
        ]
      },

      # 2.3. Quyền S3 CHỈ ĐỌC (Read-Only) để tải ảnh chân dung gốc đối sánh
      {
        Sid    = "S3FaceImageReadOnly"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.image_storage.arn}/faces/*"
        ]
      },

      # 2.4. Quyền Amazon Rekognition (Chỉ cấp đúng Action CompareFaces)
      # API CompareFaces của AWS Rekognition xử lý ảnh stateless, không gắn với resource ARN cụ thể
      {
        Sid    = "RekognitionCompareFacesOnly"
        Effect = "Allow"
        Action = [
          "rekognition:CompareFaces"
        ]
        Resource = "*"
      }
    ]
  })
}


# ==============================================================================
# 3. IAM ROLE CHO LAMBDA WORKFLOW / AUTO SUBMIT (Step Functions / EventBridge)
# ==============================================================================
resource "aws_iam_role" "lambda_exam_workflow" {
  name = "${var.project_name}-role-lambda-workflow-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "Lambda-Exam-Workflow-Role"
    Environment = var.environment
  }
}

# Policy tối thiểu cho Exam Workflow Lambda
resource "aws_iam_role_policy" "lambda_exam_workflow_policy" {
  name = "${var.project_name}-policy-lambda-workflow-${var.environment}"
  role = aws_iam_role.lambda_exam_workflow.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-workflow-*:*"
      },
      {
        Sid    = "DynamoDBWorkflowUpdate"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.exam_sessions.arn,
          aws_dynamodb_table.questions.arn
        ]
      }
    ]
  })
}

# ==============================================================================
# 4. IAM ROLE CHO LAMBDA GRADING WORKER (Tiêu thụ SQS chấm điểm trắc nghiệm)
# ==============================================================================
resource "aws_iam_role" "lambda_grading_worker" {
  name = "${var.project_name}-role-lambda-grading-worker-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "Lambda-Grading-Worker-Role"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role_policy" "lambda_grading_worker_policy" {
  name = "${var.project_name}-policy-lambda-grading-worker-${var.environment}"
  role = aws_iam_role.lambda_grading_worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # 4.1. CloudWatch Logs
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-grading-worker-*:*"
      },
      # 4.2. Quyền tiêu thụ tin nhắn từ Amazon SQS ExamSubmission Queue
      {
        Sid    = "SQSConsumeMessages"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.exam_submission.arn
      },
      # 4.3. Quyền đọc câu hỏi từ DynamoDB Questions để đối soát đáp án
      {
        Sid    = "DynamoDBReadQuestions"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          aws_dynamodb_table.questions.arn,
          "${aws_dynamodb_table.questions.arn}/index/*"
        ]
      },
      # 4.4. Quyền cập nhật kết quả thi vào DynamoDB Sessions
      {
        Sid    = "DynamoDBUpdateSessions"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.exam_sessions.arn
      }
    ]
  })
}
