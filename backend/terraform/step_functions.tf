# ==============================================================================
# AWS STEP FUNCTIONS: QUẢN LÝ CHU KỲ TỰ ĐỘNG CỦA CA THI (EXAM LIFECYCLE)
# Quy trình: SCHEDULED -> RUNNING -> WAITING (DURATION) -> CLOSED
# ==============================================================================

# 1. IAM Role cho Step Functions State Machine
resource "aws_iam_role" "step_functions_exam_lifecycle" {
  name = "${var.project_name}-role-sfn-lifecycle-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "states.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "StepFunctions-ExamLifecycle-Role"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Policy cấp quyền cho Step Functions tương tác DynamoDB và CloudWatch Logs
resource "aws_iam_role_policy" "step_functions_exam_lifecycle_policy" {
  name = "${var.project_name}-policy-sfn-lifecycle-${var.environment}"
  role = aws_iam_role.step_functions_exam_lifecycle.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Quyền cập nhật trạng thái ca thi trực tiếp vào DynamoDB (Zero-Compute, Không tốn phí Lambda)
      {
        Sid    = "DynamoDBUpdateSessionStatus"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.exam_sessions.arn
      },
      # Quyền ghi log giám sát luồng State Machine
      {
        Sid    = "CloudWatchLogsDelivery"
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# 2. CloudWatch Log Group cho Step Functions
resource "aws_cloudwatch_log_group" "sfn_lifecycle_logs" {
  name              = "/aws/vendedlogs/states/${var.project_name}-exam-lifecycle-${var.environment}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-sfn-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}

# 3. AWS Step Functions State Machine
resource "aws_sfn_state_machine" "exam_lifecycle" {
  name     = "${var.project_name}-exam-lifecycle-${var.environment}"
  role_arn = aws_iam_role.step_functions_exam_lifecycle.arn

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_lifecycle_logs.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  definition = jsonencode({
    Comment = "State Machine điều phối chu kỳ ca thi: SCHEDULED -> RUNNING -> WAITING -> CLOSED"
    StartAt = "CheckWaitBeforeStart"
    States = {
      CheckWaitBeforeStart = {
        Type = "Choice"
        Choices = [
          {
            Variable           = "$.waitBeforeStartSeconds"
            IsPresent          = true
            NumericGreaterThan = 0
            Next               = "WaitUntilStartTime"
          }
        ]
        Default = "StartExamSession"
      }

      WaitUntilStartTime = {
        Type        = "Wait"
        SecondsPath = "$.waitBeforeStartSeconds"
        Next        = "StartExamSession"
      }

      StartExamSession = {
        Type     = "Task"
        Resource = "arn:aws:states:::dynamodb:updateItem"
        Parameters = {
          TableName = aws_dynamodb_table.exam_sessions.name
          Key = {
            id = {
              "S.$" = "$.sessionId"
            }
          }
          UpdateExpression = "SET #st = :running, #actualStart = :now"
          ExpressionAttributeNames = {
            "#st"          = "status"
            "#actualStart" = "actualStartTime"
          }
          ExpressionAttributeValues = {
            ":running" = {
              S = "RUNNING"
            }
            ":now" = {
              "S.$" = "$$.Execution.StartTime"
            }
          }
        }
        ResultPath = "$.startResult"
        Next       = "WaitForExamDuration"
      }

      WaitForExamDuration = {
        Type        = "Wait"
        SecondsPath = "$.examDurationSeconds"
        Next        = "CloseExamSession"
      }

      CloseExamSession = {
        Type     = "Task"
        Resource = "arn:aws:states:::dynamodb:updateItem"
        Parameters = {
          TableName = aws_dynamodb_table.exam_sessions.name
          Key = {
            id = {
              "S.$" = "$.sessionId"
            }
          }
          UpdateExpression = "SET #st = :closed, #actualEnd = :now"
          ExpressionAttributeNames = {
            "#st"        = "status"
            "#actualEnd" = "actualEndTime"
          }
          ExpressionAttributeValues = {
            ":closed" = {
              S = "CLOSED"
            }
            ":now" = {
              "S.$" = "$$.State.EnteredTime"
            }
          }
        }
        ResultPath = "$.closeResult"
        Next       = "ExamCompleted"
      }

      ExamCompleted = {
        Type = "Succeed"
      }
    }
  })

  tags = {
    Name        = "${var.project_name}-exam-lifecycle"
    Environment = var.environment
    Role        = "Orchestration"
    Project     = var.project_name
  }
}
