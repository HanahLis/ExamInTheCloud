# ==============================================================================
# ROUTE 53 & CUSTOM DOMAIN CONFIGURATION FOR CLOUDEXAM.ID.VN
# Tích hợp tên miền cloudexam.id.vn với AWS CloudFront CDN
# ==============================================================================

# 1. Route 53 Hosted Zone cho cloudexam.id.vn
resource "aws_route53_zone" "primary" {
  count = var.custom_domain_name != "" ? 1 : 0
  name  = var.custom_domain_name

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
