# ==============================================================================
# AUTO-GENERATE FRONTEND .ENV FILE
# Tu dong dong bo cac thong so moi nhat cua AWS (Cognito, API Gateway, S3)
# vao file frontend/.env moi khi chay terraform apply.
# ==============================================================================

resource "local_file" "frontend_env" {
  filename = "${path.module}/../../frontend/.env"
  content  = <<-EOT
VITE_USE_MOCK=false
VITE_AWS_REGION=${var.aws_region}
VITE_API_BASE_URL=https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}
VITE_COGNITO_DOMAIN=https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.${var.aws_region}.amazoncognito.com
VITE_COGNITO_USER_POOL_ID=${aws_cognito_user_pool.main.id}
VITE_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.web_client.id}
VITE_COGNITO_REDIRECT_URI=${var.custom_domain_name != "" ? "https://${var.custom_domain_name}/callback" : "https://${aws_cloudfront_distribution.spa_distribution.domain_name}/callback"}
VITE_IDENTITY_POOL_ID=${aws_cognito_identity_pool.main.id}
VITE_S3_BUCKET_NAME=${aws_s3_bucket.image_storage.id}
VITE_CLOUDFRONT_URL=${var.custom_domain_name != "" ? "https://${var.custom_domain_name}" : "https://${aws_cloudfront_distribution.spa_distribution.domain_name}"}
VITE_GEMINI_MODEL=gemini-3.6-flash
VITE_GEMINI_API_KEY=${var.gemini_api_key}
VITE_TURNSTILE_SITE_KEY=${var.turnstile_site_key}
EOT

  file_permission = "0644"
}
