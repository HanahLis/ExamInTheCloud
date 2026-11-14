# ==============================================================================
# AMAZON COGNITO: USER POOL, HOSTED UI, APP CLIENT, GROUPS & IDENTITY POOL
# ==============================================================================

# 1. Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # Đăng nhập bằng Email theo đặc tả hệ thống
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Chính sách mật khẩu linh hoạt cho demo và thực tế (Hỗ trợ mật khẩu demo 12345678)
  password_policy {
    minimum_length                   = 8
    require_lowercase                = false
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = false
    temporary_password_validity_days = 7
  }

  # Cho phép người dùng tự đăng ký (Self-registration)
  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  # Cấu hình email xác thực
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "[CloudExam] Mã xác thực tài khoản của bạn"
    email_message        = "Chào mừng bạn đến với CloudExam! Mã xác thực của bạn là {####}. Vui lòng không chia sẻ mã này cho người khác."
  }

  # Khôi phục tài khoản qua email đã xác thực
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Thuộc tính người dùng chuẩn & tùy chỉnh
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  schema {
    name                = "student_code"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  # Custom claim custom:tenant_id phục vụ đa quốc gia (cloudexam.vn vs edulao.la) - Task 5
  schema {
    name                     = "tenant_id"
    attribute_data_type      = "String"
    required                 = false
    mutable                  = true
    developer_only_attribute = false
    string_attribute_constraints {
      min_length = "1"
      max_length = "20"
    }
  }

  tags = {
    Name        = "${var.project_name}-user-pool"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [schema]
  }
}

# 2. Cấu hình Hosted UI Domain
# Domain có định dạng: https://<domain_prefix>.auth.<region>.amazoncognito.com
resource "aws_cognito_user_pool_domain" "hosted_ui" {
  domain       = "${var.project_name}-auth-${data.aws_caller_identity.current.account_id}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# 3. Cấu hình App Client (Single Page Application - SPA)
resource "aws_cognito_user_pool_client" "web_client" {
  name         = "${var.project_name}-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # SPA chạy phía client (React/Vite) nên không tạo Client Secret (Public Client)
  generate_secret = false

  # Cấu hình chuẩn bảo mật cao nhất: Authorization Code Grant kết hợp PKCE
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  # Cấu hình Callback URL & Logout URL (Bao gồm Localhost, AWS CloudFront CDN và Custom Domain)
  callback_urls = distinct(concat(
    var.frontend_callback_urls,
    [
      "http://localhost:5173",
      "http://localhost:5173/callback",
      "http://localhost:3000",
      "http://localhost:3000/callback",
      "https://${aws_cloudfront_distribution.spa_distribution.domain_name}",
      "https://${aws_cloudfront_distribution.spa_distribution.domain_name}/callback"
    ],
    var.custom_domain_name != "" ? concat(
      [
        "https://${var.custom_domain_name}",
        "https://${var.custom_domain_name}/callback",
        "https://www.${var.custom_domain_name}",
        "https://www.${var.custom_domain_name}/callback"
      ],
      flatten([
        for sub in ["vn", "us", "lao", "de"] : [
          "https://${sub}.${var.custom_domain_name}",
          "https://${sub}.${var.custom_domain_name}/callback"
        ]
      ])
    ) : []
  ))
  logout_urls = distinct(concat(
    var.frontend_logout_urls,
    [
      "http://localhost:5173",
      "http://localhost:5173/",
      "http://localhost:3000",
      "http://localhost:3000/",
      "https://${aws_cloudfront_distribution.spa_distribution.domain_name}",
      "https://${aws_cloudfront_distribution.spa_distribution.domain_name}/"
    ],
    var.custom_domain_name != "" ? concat(
      [
        "https://${var.custom_domain_name}",
        "https://${var.custom_domain_name}/",
        "https://www.${var.custom_domain_name}",
        "https://www.${var.custom_domain_name}/"
      ],
      flatten([
        for sub in ["vn", "us", "lao", "de"] : [
          "https://${sub}.${var.custom_domain_name}",
          "https://${sub}.${var.custom_domain_name}/"
        ]
      ])
    ) : []
  ))

  # Luồng xác thực trực tiếp
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Thời hạn Token
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Thu hồi token khi logout và bảo vệ chống dò quét tài khoản
  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"
}

# 4. Phân quyền Người dùng theo Nhóm (Cognito User Groups)
# Group Admin: Quản trị viên toàn quyền hệ thống
resource "aws_cognito_user_group" "admin" {
  name         = "Admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Quản trị viên toàn quyền hệ thống CloudExam"
  precedence   = 1
}

# Group Organizer: Người tổ chức kỳ thi (quản lý câu hỏi, thí sinh, ca thi)
resource "aws_cognito_user_group" "organizer" {
  name         = "Organizer"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Người tổ chức kỳ thi (quản lý câu hỏi, thí sinh, ca thi)"
  precedence   = 2
}

# Group Proctor: Cán bộ coi thi & giám sát phòng thi trực tuyến (Live Proctor)
resource "aws_cognito_user_group" "proctor" {
  name         = "Proctor"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Cán bộ coi thi & giám sát phòng thi trực tuyến (Live Proctor)"
  precedence   = 3
}

# Group Candidate: Thí sinh tham gia thi, điểm danh bằng khuôn mặt
resource "aws_cognito_user_group" "candidate" {
  name         = "Candidate"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Thí sinh tham gia thi trực tuyến"
  precedence   = 4
}

# 4.1. Tài khoản Demo mặc định được tạo sẵn trên Cloud khi terraform apply
# Tài khoản Giảng viên / Ban tổ chức: annv@uet.vnu.edu.vn (MK: 12345678)
resource "aws_cognito_user" "lecturer_an" {
  user_pool_id   = aws_cognito_user_pool.main.id
  username       = "annv@uet.vnu.edu.vn"
  password       = "12345678"
  message_action = "SUPPRESS"

  attributes = {
    email              = "annv@uet.vnu.edu.vn"
    email_verified     = "true"
    name               = "PGS. TS. Nguyễn Văn An"
    student_code       = "GV001"
    "custom:tenant_id" = "vn"
  }
}

resource "aws_cognito_user_in_group" "lecturer_an_group" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.organizer.name
  username     = aws_cognito_user.lecturer_an.username
}

# Tài khoản Thí sinh mẫu: 24020001@vnu.edu.vn (MK: 12345678)
resource "aws_cognito_user" "candidate_duc" {
  user_pool_id   = aws_cognito_user_pool.main.id
  username       = "24020001@vnu.edu.vn"
  password       = "12345678"
  message_action = "SUPPRESS"

  attributes = {
    email              = "24020001@vnu.edu.vn"
    email_verified     = "true"
    name               = "Trần Minh Đức"
    student_code       = "24020001"
    "custom:tenant_id" = "vn"
  }
}

resource "aws_cognito_user_in_group" "candidate_duc_group" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.candidate.name
  username     = aws_cognito_user.candidate_duc.username
}

# Tài khoản Giám thị: laladoraema@gmail.com (MK: 12345678)
resource "aws_cognito_user" "organizer_laladoraema" {
  user_pool_id   = aws_cognito_user_pool.main.id
  username       = "laladoraema@gmail.com"
  password       = "12345678"
  message_action = "SUPPRESS"

  attributes = {
    email              = "laladoraema@gmail.com"
    email_verified     = "true"
    name               = "Giám thị Laladoraema"
    student_code       = "GT002"
    "custom:tenant_id" = "vn"
  }
}

resource "aws_cognito_user_in_group" "proctor_laladoraema_group" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.proctor.name
  username     = aws_cognito_user.organizer_laladoraema.username
}

# 5. Cognito Identity Pool (Federated Identities)
# Dùng để cấp AWS Credentials tạm thời cho Frontend upload trực tiếp lên S3
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}_idpool_${var.environment}"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web_client.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  tags = {
    Name        = "${var.project_name}-identity-pool"
    Environment = var.environment
  }
}

# 6. IAM Role & Policy cho Identity Pool Authenticated Users
resource "aws_iam_role" "cognito_authenticated" {
  name = "${var.project_name}-cognito-auth-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "Cognito-Authenticated-Role"
    Environment = var.environment
  }
}

# Least Privilege Policy: Chỉ cho phép authenticated user tải ảnh vào questions/* và faces/*
resource "aws_iam_role_policy" "cognito_authenticated_s3_policy" {
  name = "${var.project_name}-cognito-auth-s3-policy"
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPutImages"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.image_storage.arn}/questions/*",
          "${aws_s3_bucket.image_storage.arn}/faces/*"
        ]
      },
      {
        Sid    = "AllowGetImages"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.image_storage.arn}/*"
        ]
      }
    ]
  })
}

# Gắn Role vào Identity Pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated" = aws_iam_role.cognito_authenticated.arn
  }
}
