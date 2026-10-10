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
# Phụ trách: Mạnh (Authentication, API Gateway, IAM Security)
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
