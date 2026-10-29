# ==============================================================================
# DYNAMODB TABLES CHO DỰ ÁN CLOUDEXAM
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

# 5. Bảng Bài nộp & Kết quả thi (Submissions)
# Phục vụ Kiến trúc Tối ưu NoSQL & Sparse GSI SessionResultsIndex (Task 24)
# Triệt tiêu Hot Partition và giới hạn kích thước 400KB khi lưu dồn vào Sessions
resource "aws_dynamodb_table" "submissions" {
  name         = "CloudExam_Submissions_${var.environment}"
  billing_mode = "PAY_PER_REQUEST" # $0 idle cost
  hash_key     = "id"              # Định dạng: {sessionId}#{candidateEmail}

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "score"
    type = "N"
  }

  # Sparse GSI SessionResultsIndex: Query theo sessionId và sắp xếp giảm dần theo điểm số
  # Đảm bảo độ trễ truy vấn < 10ms (No Table Scan)
  global_secondary_index {
    name            = "SessionResultsIndex"
    hash_key        = "sessionId"
    range_key       = "score"
    projection_type = "ALL"
  }

  tags = {
    Name        = "CloudExam-Submissions"
    Environment = var.environment
  }
}
