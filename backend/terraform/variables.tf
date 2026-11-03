# ==============================================================================
# TERRAFORM VARIABLES CHO HỆ THỐNG CLOUDEXAM
# ==============================================================================

variable "aws_region" {
  description = "AWS Region deploy tài nguyên (ví dụ: ap-southeast-1, us-east-1)"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Môi trường triển khai (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Tên dự án"
  type        = string
  default     = "cloudexam"
}

variable "s3_bucket_name" {
  description = "Tên S3 Bucket lưu trữ ảnh (duy nhất toàn cầu)"
  type        = string
  default     = "cloudexam-storage-409289618109-dev"
}

# ==============================================================================
# CẤU HÌNH COGNITO & AUTHENTICATION
# ==============================================================================

variable "cognito_domain_prefix" {
  description = "Domain prefix cho Cognito Hosted UI (duy nhất trong AWS Region)"
  type        = string
  default     = "cloudexam-auth-645123576198-dev"
}

variable "frontend_callback_urls" {
  description = "Danh sách Callback URLs cho Cognito App Client sau khi đăng nhập"
  type        = list(string)
  default = [
    "http://localhost:5173/callback",
    "http://localhost:3000/callback"
  ]
}

variable "frontend_logout_urls" {
  description = "Danh sách Logout URLs cho Cognito App Client sau khi đăng xuất"
  type        = list(string)
  default = [
    "http://localhost:5173/",
    "http://localhost:3000/"
  ]
}

# ==============================================================================
# CẤU HÌNH AWS WAFv2 & SECURITY
# ==============================================================================

variable "enable_waf" {
  description = "Bật/Tắt AWS WAFv2 Web ACL (FinOps: có thể tắt khi không thi để giữ chi phí $0)"
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "Ngưỡng số lượng request tối đa trong 5 phút từ một IP trước khi bị WAF chặn"
  type        = number
  default     = 2000
}

# ==============================================================================
# CẤU HÌNH ĐA ĐÁM MÂY (MULTI-CLOUD): GOOGLE GEMINI, UPSTASH REDIS & CLOUDFLARE
# ==============================================================================

variable "gemini_api_key" {
  description = "Google Gemini API Key từ Google AI Studio"
  type        = string
  default     = ""
  sensitive   = true
}

variable "gemini_model" {
  description = "Tên mô hình Google Gemini AI được sử dụng (ví dụ: gemini-4-argon, gemini-2.5-flash, gemini-2.0-flash)"
  type        = string
  default     = "gemini-3.8-flash"
}

variable "upstash_redis_rest_url" {
  description = "Upstash Serverless Redis REST URL cho Live Leaderboard"
  type        = string
  default     = ""
}

variable "upstash_redis_rest_token" {
  description = "Upstash Serverless Redis REST Token cho Live Leaderboard"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudflare_turnstile_secret_key" {
  description = "Cloudflare Turnstile Secret Key để xác thực chống bot tại Lambda"
  type        = string
  default     = ""
  sensitive   = true
}

# ==============================================================================
# CẤU HÌNH FINOPS & AWS BUDGETS (0 USD CLOUD)
# ==============================================================================

variable "budget_limit_amount" {
  description = "Hạn mức ngân sách AWS Budget cảnh báo (USD)"
  type        = string
  default     = "0.50"
}

variable "budget_alert_emails" {
  description = "Danh sách email nhận thông báo cảnh báo ngân sách AWS Budget"
  type        = list(string)
  default     = ["admin@cloudexam.vn", "cloudexam-alerts@example.com"]
}

# ==============================================================================
# CẤU HÌNH CI/CD GITHUB ACTIONS OIDC
# ==============================================================================

variable "github_repo" {
  description = "GitHub Repository cho OIDC trust policy (ví dụ: org/repo hoặc *)"
  type        = string
  default     = "*"
}

