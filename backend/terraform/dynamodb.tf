# ==============================================================================
# DYNAMODB TABLES CHO DỰ ÁN CLOUDEXAM
# Phụ trách: Phong (DynamoDB + S3)
# ==============================================================================

# 1. Bảng Ngân hàng câu hỏi (Question Banks)
resource "aws_dynamodb_table" "question_banks" {
  name         = "CloudExam_QuestionBanks_${var.environment}"
  billing_mode = "PAY_PER_REQUEST" # Tiết kiệm chi phí, dùng bao nhiêu trả bấy nhiêu (Free Tier)
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name        = "CloudExam-QuestionBanks"
    Environment = var.environment
  }
}

# 2. Bảng Câu hỏi (Questions)
resource "aws_dynamodb_table" "questions" {
  name         = "CloudExam_Questions_${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "bankId"
    type = "S"
  }

  # Index để truy vấn tất cả các câu hỏi thuộc về một ngân hàng câu hỏi
  global_secondary_index {
    name            = "BankIdIndex"
    hash_key        = "bankId"
    projection_type = "ALL"
  }

  tags = {
    Name        = "CloudExam-Questions"
    Environment = var.environment
  }
}

# 3. Bảng Thí sinh (Candidates)
resource "aws_dynamodb_table" "candidates" {
  name         = "CloudExam_Candidates_${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "studentCode"
    type = "S"
  }

  # Index để tìm kiếm nhanh thí sinh theo mã sinh viên
  global_secondary_index {
    name            = "StudentCodeIndex"
    hash_key        = "studentCode"
    projection_type = "ALL"
  }

  tags = {
    Name        = "CloudExam-Candidates"
    Environment = var.environment
  }
}

# 4. Bảng Ca thi (Exam Sessions)
resource "aws_dynamodb_table" "exam_sessions" {
  name         = "CloudExam_Sessions_${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name        = "CloudExam-ExamSessions"
    Environment = var.environment
  }
}

