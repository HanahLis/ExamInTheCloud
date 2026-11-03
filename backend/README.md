# CloudExam - Backend & Cloud Infrastructure

Hệ thống hạ tầng đám mây, xác thực, điều phối phi máy chủ và lưu trữ cơ sở dữ liệu cho dự án **CloudExam (Nền tảng thi trực tuyến trên AWS & Đa Đám Mây)**.

## 1. Cấu trúc thư mục

```text
backend/
├── terraform/                   # Quản lý tài nguyên AWS bằng Infrastructure as Code (IaC)
│   ├── provider.tf             # Cấu hình AWS & Archive Providers, Remote Backend S3 + DynamoDB Lock
│   ├── variables.tf            # Các biến môi trường, flags, cidr, rate limits
│   ├── s3.tf                   # Cấu hình S3 Media Bucket, CORS, Bucket Policy (Direct-to-Storage)
│   ├── dynamodb.tf             # Cấu hình 5 bảng DynamoDB NoSQL On-Demand & Sparse GSI
│   ├── cognito.tf              # Cognito User Pool, Hosted UI, Groups (RBAC), Identity Pool
│   ├── api_gateway.tf          # API Gateway REST API, Cognito JWT Authorizer, CORS Preflight
│   ├── iam.tf                  # IAM Roles & Least-Privilege Policies (PoLP Zero-Trust)
│   ├── lambda.tf               # Đóng gói và triển khai Lambda Functions (Graviton2 arm64)
│   ├── vpc.tf                  # VPC Mạng cô lập, Private Subnets, VPC Endpoints PrivateLink (Không NAT)
│   ├── cloudfront.tf           # CloudFront CDN Edge Caching, Origin Access Control (OAC)
│   ├── sqs.tf                  # Amazon SQS Submission Queue & Dead Letter Queue (DLQ)
│   ├── step_functions.tf       # Step Functions State Machine điều phối đóng ca thi tự động
│   ├── waf.tf                  # AWS WAFv2 Web ACL (Rate Limiting, SQLi, XSS Protection)
│   ├── budgets.tf              # AWS Budgets $0.50 Alert & SNS Notifications
│   ├── cloudwatch.tf           # CloudWatch Metrics, Alarms & Dashboard giám sát hệ thống
│   ├── outputs.tf              # Toàn bộ outputs dùng cho Frontend .env.local
│   └── terraform.tfvars.example # File mẫu cấu hình biến môi trường
├── lambda/                     # Mã nguồn Serverless Backend (Python 3.12 / arm64)
│   ├── api_handler.py          # Core REST API (CRUD Đề thi, Ca thi, Thí sinh, Presigned S3, AI Gemini)
│   ├── face_verify_handler.py  # Điểm danh thí sinh bằng Amazon Rekognition CompareFaces (>= 80%) & SNS Alert
│   └── grading_worker.py       # SQS Consumer chấm thi trắc nghiệm theo lô (Batch Processing) & Upstash Redis
└── data/                       # Dữ liệu mẫu & script nạp dữ liệu
    ├── questions_seed.json     # Dữ liệu mẫu ngân hàng câu hỏi
    ├── candidates_seed.json    # Dữ liệu mẫu danh sách thí sinh (có ảnh thẻ)
    ├── sessions_seed.json      # Dữ liệu mẫu ca thi trực tuyến
    └── seed_dynamodb.py        # Python script tự động nạp dữ liệu vào DynamoDB
```

## 2. Phân công trách nhiệm thành viên

- **Nguyễn Thị Ngọc Hà (Nhóm trưởng - Hạ tầng Cloud, Mạng VPC, An ninh Zero-Trust & FinOps):**
  - Quản trị hạ tầng mã nguồn mở với Terraform v1.8+ (Remote Backend, S3 State Lock, Graviton2 arm64).
  - Thiết kế kiến trúc mạng cô lập `vpc.tf`: Dual-AZ Private Subnets, VPC Gateway Endpoints (S3, DynamoDB) và Interface Endpoints PrivateLink (không tốn chi phí NAT Gateway).
  - Tích hợp CloudFront CDN với Origin Access Control (OAC) bảo vệ S3 Media Bucket.
  - Cấu hình AWS WAFv2 Web ACL chống DDoS Rate-Limit và bảo vệ chống tấn công SQLi/XSS.
  - Cấu hình AWS Budgets ($0.50) và CloudWatch Alarms bảo vệ nguyên tắc FinOps $0.00 Free Tier.
  - Thực hiện toàn diện rà soát an ninh Zero-Trust xuất bản `SECURITY_AUDIT_REPORT.md`.

- **Phạm Tuấn Phong (Cơ sở dữ liệu NoSQL, Điểm danh AI & Vệ tinh Đa Đám Mây):**
  - Thiết kế cấu trúc 5 bảng DynamoDB On-Demand (`Questions`, `QuestionBanks`, `Candidates`, `Sessions`, `Submissions`) cùng Sparse GSI.
  - Cấu hình S3 Media Bucket lưu trữ ảnh câu hỏi (`questions/`) và ảnh thẻ sinh viên (`faces/`, `temp-faces/`).
  - Phát triển Lambda Điểm danh Sinh trắc học AI Amazon Rekognition CompareFaces (ngưỡng tương đồng $\ge 80\%$) kèm cảnh báo qua Amazon SNS.
  - Tích hợp các vệ tinh Đa Đám Mây (Multi-Cloud): Google Gemini AI bóc tách đề Word & gia sư ảo, Cloudflare Turnstile chống bot, Upstash Serverless Redis live leaderboard.
  - Xây dựng bộ kịch bản kiểm thử Multi-Cloud Resiliency (`tests/multi_cloud_test.py` - 18/18 Tests PASS).

- **Trần Đức Mạnh (Authentication, API Gateway, SQS Queue & Điều phối Step Functions):**
  - Thiết lập Amazon Cognito User Pool (đăng nhập email, mật khẩu chuẩn, email verification) và RBAC 3 nhóm (`Admin`, `Organizer`, `Candidate`).
  - Cấu hình Cognito Hosted UI (Domain branding) và luồng Authorization Code + PKCE cho Frontend SPA.
  - Thiết lập API Gateway REST API với Cognito Authorizer bảo vệ toàn bộ endpoints, xử lý CORS Preflight chuẩn.
  - Thiết kế IAM Roles & Policies tuân thủ nghiêm ngặt **Principle of Least Privilege (PoLP)**.
  - Phát triển Core API Handler (`api_handler.py`), kiến trúc chống xung tải nộp bài với Amazon SQS Standard Queue & DLQ, và Lambda Grading Worker chấm bài theo lô.
  - Tự động hóa vòng đời ca thi bằng AWS Step Functions State Machine (`step_functions.tf`) quét bài nháp và phát báo cáo kết quả qua Amazon SNS.

- **Nguyễn Phúc Tấn (Frontend Lead, Local-First Exam Room, UI/UX & Quốc tế hóa):**
  - Khởi tạo và phát triển ứng dụng Frontend SPA với React 19, TypeScript, Vite và Tailwind CSS v4.
  - Hiện thực phòng thi Local-First (0ms lag, an toàn khi mất kết nối mạng) kết hợp Throttled Cloud Sync (60 giây hoặc 10 thay đổi).
  - Tích hợp luồng xác thực Cognito Hosted UI PKCE, điểm danh Webcam trực tiếp qua S3 Presigned URL (Direct-to-Storage).
  - Xây dựng giao diện Đa Quốc Gia & Đa Thuê Bạ (Single-Table Multi-Tenancy Việt Nam - Lào).
  - Soạn thảo kịch bản trình diễn kỹ thuật (`DEMO_SCRIPT.md`) và đề cương slide báo cáo (`SLIDE_OUTLINE.md`).

## 3. Tài liệu tham khảo dự án

- Báo cáo Đánh giá An ninh Zero-Trust: `docs/SECURITY_AUDIT_REPORT.md`
- Báo cáo Thử nghiệm Tải Nộp bài Cuối giờ: `docs/SUBMISSION_STAMPEDE_REPORT.md`
- Kịch bản Trình diễn Kỹ thuật: `docs/DEMO_SCRIPT.md`
- Đề cương Slide Báo cáo: `docs/SLIDE_OUTLINE.md`
- Hướng dẫn Cognito, API Gateway & IAM Security: `docs/COGNITO_IAM_APIGATEWAY_GUIDE.md`
- Thiết kế cơ sở dữ liệu DynamoDB: `docs/DATABASE_DESIGN.md`
- Cấu hình lưu trữ S3: `docs/S3_STORAGE_DESIGN.md`
- Hướng dẫn cài đặt và chạy Terraform: `docs/TERRAFORM_GUIDE.md`
- Báo cáo Quản trị Chi phí FinOps: `docs/finops_report.md`
