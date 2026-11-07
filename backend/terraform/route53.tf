# ==============================================================================
# ROUTE 53 & CUSTOM DOMAIN CONFIGURATION FOR CLOUDEXAM.ID.VN
# Tích hợp tên miền cloudexam.id.vn với AWS CloudFront CDN
# ==============================================================================

# 1. Route 53 Hosted Zone cho cloudexam.id.vn
resource "aws_route53_zone" "primary" {
  count         = var.custom_domain_name != "" ? 1 : 0
  name          = var.custom_domain_name
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-hosted-zone"
    Environment = var.environment
    Domain      = var.custom_domain_name
  }
}

# 2. DNS Record A (Alias trỏ trực tiếp Apex Domain cloudexam.id.vn -> CloudFront CDN)
resource "aws_route53_record" "apex_a" {
  count   = var.custom_domain_name != "" ? 1 : 0
  zone_id = aws_route53_zone.primary[0].zone_id
  name    = var.custom_domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.spa_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.spa_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

# 3. DNS Record AAAA (IPv6 Alias trỏ Apex Domain cloudexam.id.vn -> CloudFront CDN)
resource "aws_route53_record" "apex_aaaa" {
  count   = var.custom_domain_name != "" ? 1 : 0
  zone_id = aws_route53_zone.primary[0].zone_id
  name    = var.custom_domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.spa_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.spa_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

# 4. DNS Record CNAME cho Subdomain www.cloudexam.id.vn -> CloudFront CDN
resource "aws_route53_record" "www_cname" {
  count   = var.custom_domain_name != "" ? 1 : 0
  zone_id = aws_route53_zone.primary[0].zone_id
  name    = "www.${var.custom_domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.spa_distribution.domain_name]
}

# 5. DNS Records cho các Subdomain (Tùy chọn - Tắt mặc định để tránh xung đột Route 53 và lỗi SSL Cipher Mismatch)
# resource "aws_route53_record" "regional_subdomains_a" {
#   for_each        = var.custom_domain_name != "" ? toset(["vn", "us", "lao", "de", "*"]) : []
#   zone_id         = aws_route53_zone.primary[0].zone_id
#   name            = "${each.key}.${var.custom_domain_name}"
#   type            = "A"
#   allow_overwrite = true
# 
#   alias {
#     name                   = aws_cloudfront_distribution.spa_distribution.domain_name
#     zone_id                = aws_cloudfront_distribution.spa_distribution.hosted_zone_id
#     evaluate_target_health = false
#   }
# }
# 
# resource "aws_route53_record" "regional_subdomains_aaaa" {
#   for_each        = var.custom_domain_name != "" ? toset(["vn", "us", "lao", "de", "*"]) : []
#   zone_id         = aws_route53_zone.primary[0].zone_id
#   name            = "${each.key}.${var.custom_domain_name}"
#   type            = "AAAA"
#   allow_overwrite = true
# 
#   alias {
#     name                   = aws_cloudfront_distribution.spa_distribution.domain_name
#     zone_id                = aws_cloudfront_distribution.spa_distribution.hosted_zone_id
#     evaluate_target_health = false
#   }
# }

