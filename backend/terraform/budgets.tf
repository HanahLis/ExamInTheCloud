# ==============================================================================
# FINOPS ARCHITECTURE: AWS BUDGETS & COST CONTROL (0 USD CLOUD)
# Phụ trách: Phạm Tuấn Phong (24021596) — Task P-03
# Tự động giám sát chi phí đám mây, cảnh báo ngưỡng 0.50 USD bảo vệ ngân sách sinh viên
# ==============================================================================

resource "aws_budgets_budget" "cloudexam_monthly_zero_dollar" {
  name              = "${var.project_name}-monthly-budget-${var.environment}"
  budget_type       = "COST"
  limit_amount      = var.budget_limit_amount
  limit_unit        = "USD"
  time_period_start = "2026-01-01_00:00"
  time_unit         = "MONTHLY"

  # Cảnh báo 1: Chi phí thực tế vượt 80% hạn mức (0.40 USD)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
  }

  # Cảnh báo 2: Chi phí thực tế chạm ngưỡng 100% (0.50 USD)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
  }

  # Cảnh báo 3: Dự báo chi phí tháng (Forecasted) có nguy cơ vượt 100%
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
  }

  cost_types {
    include_credit             = false
    include_discount           = true
    include_other_subscription = true
    include_recurring          = true
    include_refund             = false
    include_subscription       = true
    include_support            = true
    include_tax                = true
    include_upfront            = true
    use_blended                = false
  }
}

