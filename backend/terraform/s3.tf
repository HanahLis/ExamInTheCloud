# ==============================================================================
# S3 BUCKET CHO LƯU TRỮ HÌNH ẢNH (ẢNH CÂU HỎI VÀ KHUÔN MẶT THÍ SINH)
# Phụ trách: Phong (DynamoDB + S3)
# ==============================================================================

# 1. Khởi tạo S3 Bucket
resource "aws_s3_bucket" "image_storage" {
  bucket        = var.s3_bucket_name
  force_destroy = true # Cho phép dọn dẹp sạch bucket khi hủy môi trường dev

  tags = {
    Name        = "${var.project_name}-storage-${var.environment}"
    Environment = var.environment
  }
}

# 2. Cấu hình Ownership Controls
resource "aws_s3_bucket_ownership_controls" "image_storage_ownership" {
  bucket = aws_s3_bucket.image_storage.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# 3. Cấu hình mở quyền đọc công khai phục vụ hiển thị ảnh trên Web
resource "aws_s3_bucket_public_access_block" "image_storage_public_access" {
  bucket = aws_s3_bucket.image_storage.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# 4. Cấu hình CORS để Frontend (React/Amplify/localhost) có thể upload ảnh trực tiếp
resource "aws_s3_bucket_cors_configuration" "image_storage_cors" {
  bucket = aws_s3_bucket.image_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://*.amplifyapp.com"
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# 5. Bucket Policy cho phép người dùng đọc (GET) các ảnh đã tải lên
resource "aws_s3_bucket_policy" "image_storage_read_policy" {
  bucket     = aws_s3_bucket.image_storage.id
  depends_on = [aws_s3_bucket_public_access_block.image_storage_public_access]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.image_storage.arn}/*"
      }
    ]
  })
}

