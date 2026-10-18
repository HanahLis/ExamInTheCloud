# ==============================================================================
# OUTPUTS CHO HỆ THỐNG CLOUDEXAM
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. S3 & DynamoDB Outputs
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
# 2. Cognito Outputs
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
# 3. API Gateway Outputs
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
# 4. IAM Roles Outputs
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

output "iam_role_lambda_grading_worker_arn" {
  description = "ARN của IAM Role cho Lambda Grading Worker"
  value       = aws_iam_role.lambda_grading_worker.arn
}

# ------------------------------------------------------------------------------
# 5. SQS & Async Pipeline Outputs
# ------------------------------------------------------------------------------
output "sqs_exam_submission_queue_url" {
  description = "URL của hàng đợi SQS ExamSubmission Queue"
  value       = aws_sqs_queue.exam_submission.url
}

output "sqs_exam_submission_queue_arn" {
  description = "ARN của hàng đợi SQS ExamSubmission Queue"
  value       = aws_sqs_queue.exam_submission.arn
}

output "sqs_exam_submission_dlq_url" {
  description = "URL của hàng đợi SQS Dead Letter Queue (DLQ)"
  value       = aws_sqs_queue.exam_submission_dlq.url
}

output "sqs_exam_submission_dlq_arn" {
  description = "ARN của hàng đợi SQS Dead Letter Queue (DLQ)"
  value       = aws_sqs_queue.exam_submission_dlq.arn
}

# ------------------------------------------------------------------------------
# 6. WAF & Step Functions Outputs
# ------------------------------------------------------------------------------
output "waf_web_acl_arn" {
  description = "ARN của AWS WAFv2 Web ACL (nếu bật WAF)"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_waf[0].arn : null
}

output "waf_web_acl_id" {
  description = "ID của AWS WAFv2 Web ACL (nếu bật WAF)"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_waf[0].id : null
}

output "step_functions_state_machine_arn" {
  description = "ARN của AWS Step Functions State Machine quản lý ca thi"
  value       = aws_sfn_state_machine.exam_lifecycle.arn
}
