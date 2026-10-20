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
  default     = 100
}
