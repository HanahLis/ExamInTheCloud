# ==============================================================================
# AWS WAFv2: WEB APPLICATION FIREWALL CHO API GATEWAY REST API
# ==============================================================================

# 1. AWS WAFv2 Web ACL (Regional cho API Gateway tại ap-southeast-1)
resource "aws_wafv2_web_acl" "api_waf" {
  count       = var.enable_waf ? 1 : 0
  name        = "${var.project_name}-web-acl-${var.environment}"
  description = "Tường lửa AWS WAFv2 bảo vệ CloudExam REST API trước DDoS, Rate Limit, OWASP Top 10 và SQLi"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # ----------------------------------------------------------------------------
  # Rule 1: Giới hạn tần suất request (Rate Limiting chống brute-force và DDoS)
  # ----------------------------------------------------------------------------
  rule {
    name     = "RateLimitPerIP"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CloudExamRateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  # ----------------------------------------------------------------------------
  # Rule 2: Bộ quy tắc AWS Managed Rules Common Rule Set (OWASP Top 10, XSS, Path Traversal)
  # ----------------------------------------------------------------------------
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # ----------------------------------------------------------------------------
  # Rule 3: Bộ quy tắc AWS Managed Rules SQL Injection (Bảo vệ dữ liệu NoSQL/SQL)
  # ----------------------------------------------------------------------------
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSSQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # ----------------------------------------------------------------------------
  # Rule 4: Bộ quy tắc AWS Managed Rules Known Bad Inputs (Chặn các payload độc hại đã biết)
  # ----------------------------------------------------------------------------
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSKnownBadInputsMetric"
      sampled_requests_enabled   = true
    }
  }

  # ----------------------------------------------------------------------------
  # Rule 5: Giám sát địa lý đa quốc gia (Geo-Match Rule: VN, LA, TH, KH, SG)
  # Sử dụng chế độ COUNT để phân tích và gắn nhãn mà không làm gián đoạn bài thi
  # ----------------------------------------------------------------------------
  rule {
    name     = "GeoMatchRule"
    priority = 5

    action {
      count {}
    }

    statement {
      geo_match_statement {
        country_codes = ["VN", "LA", "TH", "KH", "SG", "US"]
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoMatchRuleMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-web-acl-${var.environment}"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${var.project_name}-web-acl"
    Environment = var.environment
    Role        = "SecurityWAF"
    Project     = var.project_name
  }
}

# 2. Gắn WAFv2 Web ACL vào Stage của API Gateway REST API
resource "aws_wafv2_web_acl_association" "api_gateway" {
  count        = var.enable_waf ? 1 : 0
  resource_arn = aws_api_gateway_stage.dev.arn
  web_acl_arn  = aws_wafv2_web_acl.api_waf[0].arn
}
