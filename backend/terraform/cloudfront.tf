# ==============================================================================
# AWS CLOUDFRONT CDN DISTRIBUTION & MULTI-TENANT EDGE FUNCTION (TASK 1.2)
# Phụ trách: Nguyễn Thị Ngọc Hà (24020115) — Trưởng nhóm
# ==============================================================================

# 1. S3 Bucket lưu trữ mã nguồn tĩnh Frontend (React SPA)
resource "aws_s3_bucket" "frontend_hosting" {
  bucket        = "${var.project_name}-frontend-${var.environment}"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-frontend-hosting"
    Environment = var.environment
    Project     = var.project_name
    Role        = "FrontendHosting"
  }
}

# Chặn hoàn toàn Public Access trực tiếp vào S3 Bucket (Chỉ cho phép qua CloudFront OAC)
resource "aws_s3_bucket_public_access_block" "frontend_hosting_block" {
  bucket = aws_s3_bucket.frontend_hosting.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2. Origin Access Control (OAC) chuẩn SigV4 bảo vệ S3 Origin
resource "aws_cloudfront_origin_access_control" "spa_oac" {
  name                              = "${var.project_name}-spa-oac-${var.environment}"
  description                       = "Origin Access Control cho phep CloudFront truy cap an toan vao S3 Frontend Bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 3. CloudFront Edge Function: Tu dong phat hien quoc gia va tiem header x-tenant-id
resource "aws_cloudfront_function" "tenant_resolver" {
  name    = "${var.project_name}-tenant-resolver-${var.environment}"
  runtime = "cloudfront-js-1.0"
  comment = "Tu dong inject x-tenant-id: la hoac vn dua tren Host domain tai Edge"
  publish = true
  code    = <<-EOT
function handler(event) {
    var request = event.request;
    var host = request.headers.host ? request.headers.host.value : '';
    if (host.indexOf('edulao.la') !== -1) {
        request.headers['x-tenant-id'] = { value: 'la' };
    } else {
        request.headers['x-tenant-id'] = { value: 'vn' };
    }
    return request;
}
EOT
}

# 4. CloudFront Distribution cho React SPA
resource "aws_cloudfront_distribution" "spa_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudExam Multi-Country React SPA Distribution with OAC & Tenant Resolver"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # Phục vụ châu Á / Bắc Mỹ / Châu Âu tối ưu chi phí ($0)

  origin {
    domain_name              = aws_s3_bucket.frontend_hosting.bucket_regional_domain_name
    origin_id                = "S3-Frontend-Hosting"
    origin_access_control_id = aws_cloudfront_origin_access_control.spa_oac.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Frontend-Hosting"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true

    # Gắn Hook CloudFront Function vào sự kiện Viewer Request
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.tenant_resolver.arn
    }
  }

  # Cấu hình Custom Error Response phục vụ HTML5 Client-Side Routing (React Router)
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${var.project_name}-spa-cdn"
    Environment = var.environment
    Role        = "EdgeCDN"
  }
}

# 5. S3 Bucket Policy cho phép CloudFront OAC truy xuất
resource "aws_s3_bucket_policy" "frontend_hosting_oac_policy" {
  bucket = aws_s3_bucket.frontend_hosting.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_hosting.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.spa_distribution.arn
          }
        }
      }
    ]
  })
}

# 6. Outputs cho CloudFront Distribution
output "cloudfront_distribution_domain_name" {
  description = "Domain name của CloudFront CDN phục vụ Frontend SPA"
  value       = aws_cloudfront_distribution.spa_distribution.domain_name
}

output "cloudfront_distribution_id" {
  description = "ID của CloudFront Distribution (dùng cho Invalidation CI/CD)"
  value       = aws_cloudfront_distribution.spa_distribution.id
}

# 7. Tu dong nap du lieu mau Cloud (Cognito, DynamoDB, S3) & Deploy Frontend khi terraform apply
# Dam bao file .env luon duoc cap nhat truoc khi deploy_frontend.py build Vite
resource "terraform_data" "frontend_build_deploy" {
  triggers_replace = [
    aws_cloudfront_distribution.spa_distribution.id,
    aws_s3_bucket.frontend_hosting.id,
    local_file.frontend_env.content_sha256,
    aws_dynamodb_table.questions.id,
    aws_dynamodb_table.exam_sessions.id,
    aws_s3_bucket.image_storage.id,
    aws_cognito_user_pool.main.id
  ]

  provisioner "local-exec" {
    command = "python ${path.module}/../../scripts/seed_cloud_data.py && python ${path.module}/../../scripts/deploy_frontend.py"
  }

  depends_on = [
    local_file.frontend_env,
    aws_s3_bucket.frontend_hosting,
    aws_s3_bucket.image_storage,
    aws_s3_bucket_policy.frontend_hosting_oac_policy,
    aws_cloudfront_distribution.spa_distribution,
    aws_dynamodb_table.question_banks,
    aws_dynamodb_table.questions,
    aws_dynamodb_table.candidates,
    aws_dynamodb_table.exam_sessions,
    aws_cognito_user_pool.main,
    aws_cognito_user_pool_client.web_client,
    aws_cognito_user.lecturer_an,
    aws_cognito_user.candidate_duc
  ]
}
