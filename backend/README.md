# CloudExam - Backend & Cloud Infrastructure

Hệ thống hạ tầng đám mây, xác thực và lưu trữ cơ sở dữ liệu cho dự án **CloudExam (Nền tảng thi trực tuyến trên AWS)**.

## 1. Cấu trúc thư mục

```text
backend/
├── terraform/                   # Quản lý tài nguyên AWS bằng Infrastructure as Code (IaC)
│   ├── provider.tf             # Cấu hình AWS & Archive Providers
│   ├── variables.tf            # Các biến môi trường
│   ├── s3.tf                   # Cấu hình S3 Bucket, CORS, Bucket Policy (Phong)
│   ├── dynamodb.tf             # Cấu hình các bảng DynamoDB NoSQL (Phong)
│   ├── cognito.tf              # Cognito User Pool, Hosted UI, Groups, Identity Pool (Mạnh)
│   ├── api_gateway.tf          # API Gateway REST API, Cognito Authorizer, CORS (Mạnh)
│   ├── iam.tf                  # IAM Roles & Least-Privilege Policies (Mạnh)
│   ├── lambda.tf               # Đóng gói và triển khai Lambda Functions (Mạnh)
│   ├── outputs.tf              # Toàn bộ outputs dùng cho Frontend .env.local
│   └── terraform.tfvars.example # File mẫu cấu hình biến
├── lambda/                     # Mã nguồn serverless backend
│   ├── api_handler.py          # REST API Handler (Questions, Candidates, Sessions, Submit)
│   └── face_verify_handler.py  # Điểm danh thí sinh bằng Amazon Rekognition CompareFaces
└── data/                       # Dữ liệu mẫu & script nạp dữ liệu (Phong)
    ├── questions_seed.json     # Dữ liệu mẫu ngân hàng câu hỏi
    ├── candidates_seed.json    # Dữ liệu mẫu danh sách thí sinh
    ├── sessions_seed.json      # Dữ liệu mẫu ca thi trực tuyến
    └── seed_dynamodb.py        # Python script tự động nạp dữ liệu vào DynamoDB
```

## 2. Phân công trách nhiệm

- **Mạnh (Authentication, API Gateway, IAM Security & Lambda Backend):**
  - Thiết lập Amazon Cognito User Pool (đăng nhập email, mật khẩu chuẩn, email verification).
  - Cấu hình Cognito Hosted UI (Domain branding) và luồng Authorization Code + PKCE.
  - Cấu hình Callback URL (`/callback`) và Logout URL cho App Client SPA.
  - Thiết lập các nhóm người dùng: `Admin`, `Organizer`, `Candidate` (RBAC).
  - Cấu hình Cognito Identity Pool và IAM Role cho S3 upload trực tiếp từ Frontend.
  - Thiết lập API Gateway REST API với Cognito Authorizer bảo vệ toàn bộ endpoints.
  - Xử lý CORS chuẩn cho cả Preflight OPTIONS và Gateway Responses (4XX/5XX).
  - Thiết kế IAM Roles & Policies tuân thủ nghiêm ngặt **Principle of Least Privilege**.
  - Triển khai Lambda Core API và Lambda Face Verification (Rekognition CompareFaces >= 80%).

- **Phạm Tuấn Phong (DynamoDB + S3):**
  - Thiết kế cấu trúc các bảng DynamoDB NoSQL.
  - Thiết lập S3 Bucket lưu trữ ảnh câu hỏi (`questions/`) và ảnh khuôn mặt (`faces/`).
  - Cấu hình S3 CORS và quyền truy cập.
  - Viết mã nguồn Terraform quản lý S3 + DynamoDB.
  - Chuẩn bị dữ liệu mẫu (Seed Data) cho nhóm.

## 3. Tài liệu tham khảo dự án

- Tài liệu hướng dẫn Cognito, API Gateway & IAM Security: `docs/COGNITO_IAM_APIGATEWAY_GUIDE.md`
- Tài liệu thiết kế cơ sở dữ liệu DynamoDB: `docs/DATABASE_DESIGN.md`
- Tài liệu cấu hình lưu trữ S3: `docs/S3_STORAGE_DESIGN.md`
- Hướng dẫn cài đặt và chạy Terraform: `docs/TERRAFORM_GUIDE.md`
