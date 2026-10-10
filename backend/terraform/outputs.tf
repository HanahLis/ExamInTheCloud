# ==============================================================================
# OUTPUTS CHO HỆ THỐNG CLOUDEXAM
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. S3 & DynamoDB Outputs (Phong phụ trách)
# ------------------------------------------------------------------------------
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

# ------------------------------------------------------------------------------
# 2. Cognito Outputs (Mạnh phụ trách)
# Dùng để điền vào file frontend/.env.local
# ------------------------------------------------------------------------------
output "cognito_user_pool_id" {
  description = "ID của Cognito User Pool (VITE_COGNITO_USER_POOL_ID)"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "ARN của Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_app_client_id" {
  description = "Client ID của Cognito App Client SPA (VITE_COGNITO_CLIENT_ID)"
  value       = aws_cognito_user_pool_client.web_client.id
}

output "cognito_domain" {
  description = "Domain đầy đủ của Cognito Hosted UI (VITE_COGNITO_DOMAIN)"
  value       = "https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_identity_pool_id" {
  description = "ID của Cognito Identity Pool cho upload S3 (VITE_IDENTITY_POOL_ID)"
  value       = aws_cognito_identity_pool.main.id
}

# ------------------------------------------------------------------------------
# 3. API Gateway Outputs (Mạnh phụ trách)
# ------------------------------------------------------------------------------
output "api_gateway_id" {
  description = "ID của API Gateway REST API"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_gateway_base_url" {
  description = "URL gốc của API Gateway (VITE_API_BASE_URL)"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "api_gateway_authorizer_id" {
  description = "ID của Cognito Authorizer trên API Gateway"
  value       = aws_api_gateway_authorizer.cognito_authorizer.id
}

# ------------------------------------------------------------------------------
# 4. IAM Roles Outputs (Mạnh phụ trách)
# ------------------------------------------------------------------------------
output "iam_role_lambda_core_api_arn" {
  description = "ARN của IAM Role cho Lambda Core API"
  value       = aws_iam_role.lambda_core_api.arn
}

output "iam_role_lambda_face_verify_arn" {
  description = "ARN của IAM Role cho Lambda Face Verification"
  value       = aws_iam_role.lambda_face_verify.arn
}

output "iam_role_cognito_authenticated_arn" {
  description = "ARN của IAM Role cho Cognito Authenticated User"
  value       = aws_iam_role.cognito_authenticated.arn
}
