variable "aws_region" {
  description = "AWS Region deploy tài nguyên"
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

