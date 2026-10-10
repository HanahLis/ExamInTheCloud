output "s3_bucket_name" {
  description = "Tên S3 Bucket đã tạo"
  value       = aws_s3_bucket.image_storage.id
}

output "s3_bucket_arn" {
  description = "ARN của S3 Bucket"
  value       = aws_s3_bucket.image_storage.arn
}

output "dynamodb_questions_table" {
  description = "Tên bảng DynamoDB Questions"
  value       = aws_dynamodb_table.questions.name
}

output "dynamodb_candidates_table" {
  description = "Tên bảng DynamoDB Candidates"
  value       = aws_dynamodb_table.candidates.name
}

output "dynamodb_sessions_table" {
  description = "Tên bảng DynamoDB Sessions"
  value       = aws_dynamodb_table.exam_sessions.name
}

output "dynamodb_question_banks_table" {
  description = "Tên bảng DynamoDB QuestionBanks"
  value       = aws_dynamodb_table.question_banks.name
}

