# ==============================================================================
# AMAZON API GATEWAY: REST API, COGNITO AUTHORIZER & CORS
# Phụ trách: Mạnh (Authentication, API Gateway, IAM Security)
# ==============================================================================

# 1. Khởi tạo REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "REST API cho hệ thống CloudExam với Cognito Authorizer và Lambda backend"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name        = "${var.project_name}-api"
    Environment = var.environment
  }
}

# 2. Cấu hình Cognito User Pool Authorizer
resource "aws_api_gateway_authorizer" "cognito_authorizer" {
  name          = "CognitoUserPoolAuthorizer"
  rest_api_id   = aws_api_gateway_rest_api.main.id
  type          = "COGNITO_USER_POOLS"
  provider_arns = [aws_cognito_user_pool.main.arn]

  # Header chứa JWT Token: Authorization: Bearer <id_token>
  identity_source = "method.request.header.Authorization"
}

# 3. Gateway Responses (Cấu hình CORS cho 4XX và 5XX)
# Giúp Frontend nhận được mã lỗi 401 Unauthorized thay vì bị lỗi CORS khi token hết hạn/không hợp lệ
resource "aws_api_gateway_gateway_response" "response_4xx" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  response_type = "DEFAULT_4XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'*'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
  }
}

resource "aws_api_gateway_gateway_response" "response_5xx" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  response_type = "DEFAULT_5XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'*'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
  }
}

# ==============================================================================
# 4. ĐỊNH NGHĨA CÁC TÀI NGUYÊN (RESOURCES)
# ==============================================================================

# /questions
resource "aws_api_gateway_resource" "questions" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "questions"
}

# /questions/{id}
resource "aws_api_gateway_resource" "question_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.questions.id
  path_part   = "{id}"
}

# /candidates
resource "aws_api_gateway_resource" "candidates" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "candidates"
}

# /candidates/{email}
resource "aws_api_gateway_resource" "candidate_email" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.candidates.id
  path_part   = "{email}"
}

# /sessions
resource "aws_api_gateway_resource" "sessions" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "sessions"
}

# /sessions/{id}
resource "aws_api_gateway_resource" "session_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.sessions.id
  path_part   = "{id}"
}

# /auth
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "auth"
}

# /auth/face-verify
resource "aws_api_gateway_resource" "face_verify" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "face-verify"
}

# /exam
resource "aws_api_gateway_resource" "exam" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "exam"
}

# /exam/submit
resource "aws_api_gateway_resource" "exam_submit" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.exam.id
  path_part   = "submit"
}

# ==============================================================================
# 5. CẤU HÌNH TỰ ĐỘNG CORS OPTIONS CHO TẤT CẢ CÁC RESOURCES
# ==============================================================================
locals {
  all_resources = {
    "questions"       = aws_api_gateway_resource.questions.id
    "question_id"     = aws_api_gateway_resource.question_id.id
    "candidates"      = aws_api_gateway_resource.candidates.id
    "candidate_email" = aws_api_gateway_resource.candidate_email.id
    "sessions"        = aws_api_gateway_resource.sessions.id
    "session_id"      = aws_api_gateway_resource.session_id.id
    "auth"            = aws_api_gateway_resource.auth.id
    "face_verify"     = aws_api_gateway_resource.face_verify.id
    "exam"            = aws_api_gateway_resource.exam.id
    "exam_submit"     = aws_api_gateway_resource.exam_submit.id
  }
}

resource "aws_api_gateway_method" "options" {
  for_each      = local.all_resources
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = each.value
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  for_each    = local.all_resources
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value
  http_method = aws_api_gateway_method.options[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  for_each    = local.all_resources
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_200" {
  for_each    = local.all_resources
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = aws_api_gateway_method_response.options_200[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options]
}

# ==============================================================================
# 6. ĐỊNH NGHĨA CÁC METHODS KÈM COGNITO AUTHORIZER & LAMBDA INTEGRATION
# ==============================================================================

# Danh sách các endpoints kết nối vào Core API Lambda
locals {
  core_api_methods = [
    { key = "q_get", resource_id = aws_api_gateway_resource.questions.id, http_method = "GET" },
    { key = "q_post", resource_id = aws_api_gateway_resource.questions.id, http_method = "POST" },
    { key = "qid_get", resource_id = aws_api_gateway_resource.question_id.id, http_method = "GET" },
    { key = "qid_put", resource_id = aws_api_gateway_resource.question_id.id, http_method = "PUT" },
    { key = "qid_del", resource_id = aws_api_gateway_resource.question_id.id, http_method = "DELETE" },
    { key = "c_get", resource_id = aws_api_gateway_resource.candidates.id, http_method = "GET" },
    { key = "c_post", resource_id = aws_api_gateway_resource.candidates.id, http_method = "POST" },
    { key = "cm_get", resource_id = aws_api_gateway_resource.candidate_email.id, http_method = "GET" },
    { key = "cm_del", resource_id = aws_api_gateway_resource.candidate_email.id, http_method = "DELETE" },
    { key = "s_get", resource_id = aws_api_gateway_resource.sessions.id, http_method = "GET" },
    { key = "s_post", resource_id = aws_api_gateway_resource.sessions.id, http_method = "POST" },
    { key = "sid_get", resource_id = aws_api_gateway_resource.session_id.id, http_method = "GET" },
    { key = "sid_put", resource_id = aws_api_gateway_resource.session_id.id, http_method = "PUT" },
    { key = "sub_post", resource_id = aws_api_gateway_resource.exam_submit.id, http_method = "POST" }
  ]
}

# 6.1. Methods cho Core API
resource "aws_api_gateway_method" "core_methods" {
  for_each      = { for m in local.core_api_methods : m.key => m }
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = each.value.resource_id
  http_method   = each.value.http_method
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "core_integrations" {
  for_each                = { for m in local.core_api_methods : m.key => m }
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = each.value.resource_id
  http_method             = aws_api_gateway_method.core_methods[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.core_api.invoke_arn
}

# 6.2. Method cho Face Verify API (/auth/face-verify)
resource "aws_api_gateway_method" "face_verify_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.face_verify.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "face_verify_integration" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.face_verify.id
  http_method             = aws_api_gateway_method.face_verify_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.face_verify.invoke_arn
}

# ==============================================================================
# 7. PHÂN QUYỀN GỌI LAMBDA (RESOURCE-BASED POLICY CHO LAMBDA)
# ==============================================================================
resource "aws_lambda_permission" "apigw_invoke_core_api" {
  statement_id  = "AllowAPIGatewayInvokeCoreAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.core_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_invoke_face_verify" {
  statement_id  = "AllowAPIGatewayInvokeFaceVerify"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.face_verify.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# ==============================================================================
# 8. DEPLOYMENT & STAGE CHO API GATEWAY
# ==============================================================================
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.questions.id,
      aws_api_gateway_resource.candidates.id,
      aws_api_gateway_resource.sessions.id,
      aws_api_gateway_resource.face_verify.id,
      aws_api_gateway_resource.exam_submit.id,
      aws_api_gateway_authorizer.cognito_authorizer.id,
      local.core_api_methods
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.core_integrations,
    aws_api_gateway_integration.face_verify_integration,
    aws_api_gateway_integration.options
  ]
}

resource "aws_api_gateway_stage" "dev" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  tags = {
    Name        = "${var.project_name}-stage-${var.environment}"
    Environment = var.environment
  }
}
