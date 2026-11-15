# CloudExam — Backend & Cloud Infrastructure

Hệ thống hạ tầng đám mây, xác thực tập trung, điều phối phi máy chủ và lưu trữ cơ sở dữ liệu cho nền tảng **CloudExam (Hệ thống Khảo thí Trực tuyến Không máy chủ & Đa Đám Mây)**.

[![AWS Serverless](https://img.shields.io/badge/AWS-Serverless-orange?logo=amazon-aws)](https://aws.amazon.com/)
[![Terraform v1.8+](https://img.shields.io/badge/IaC-Terraform_v1.8+-purple?logo=terraform)](https://www.terraform.io/)
[![Python 3.11 / arm64](https://img.shields.io/badge/Runtime-Python_3.11_arm64-blue?logo=python)](https://aws.amazon.com/ec2/graviton/)
[![FinOps $0.00](https://img.shields.io/badge/FinOps-$0.00_Free_Tier-success)](../docs/finops_report.md)

---

## 1. CẤU TRÚC THƯ MỤC NGUỒN BACKEND

```text
backend/
├── terraform/                       # Quản lý tài nguyên AWS bằng Infrastructure as Code (IaC)
│   ├── provider.tf                  # Cấu hình AWS & Archive Providers, Remote Backend S3 + DynamoDB Lock
│   ├── variables.tf                 # Khai báo biến môi trường, flags, CIDR, rate limits
│   ├── s3.tf                        # S3 Media Bucket, CORS, Lifecycle 24h xóa ảnh tạm, CloudFront OAC
│   ├── dynamodb.tf                  # 5 bảng DynamoDB On-Demand (PAY_PER_REQUEST) & Sparse GSI
│   ├── cognito.tf                   # Cognito User Pool, Client PKCE, Hosted UI Domain, Groups (RBAC)
│   ├── api_gateway.tf               # REST API Gateway, Cognito JWT Authorizer, Route mappings & CORS
│   ├── iam.tf                       # IAM Execution Roles tuân thủ nghiêm ngặt Least Privilege (PoLP)
│   ├── lambda.tf                    # Đóng gói ZIP và triển khai 3 Lambda Functions (Graviton2 arm64)
│   ├── vpc.tf                       # VPC Mạng cô lập, Dual-AZ Private Subnets, Endpoints PrivateLink (Không NAT)
│   ├── sqs.tf                       # Amazon SQS Submission Queue & Dead Letter Queue (DLQ)
│   ├── step_functions.tf            # Máy trạng thái điều phối chu trình ca thi (Exam Lifecycle v2)
│   ├── waf.tf                       # AWS WAFv2 Web ACL (Rate Limiting, SQLi, XSS Protection, cờ enable_waf)
│   ├── route53.tf                   # Cấu hình Route 53 DNS & ACM SSL cấp chứng chỉ tên miền cloudexam.id.vn
│   ├── outputs.tf                   # Toàn bộ outputs dùng cho Frontend .env
│   ├── terraform.tfvars.example     # File mẫu cấu hình biến môi trường cá nhân
│   └── frontend_env.tf              # Tự động xuất file cấu hình môi trường cho Frontend
├── lambda/                          # Mã nguồn Serverless Compute (Python 3.11 / Graviton2 arm64)
│   ├── api_handler.py               # Core REST API (CRUD Đề thi, Ca thi, RBAC 3 Cổng, Gemini AI & Fallback)
│   ├── face_verify_handler.py       # Điểm danh thí sinh bằng Amazon Rekognition CompareFaces (>= 80%) & Khóa thiết bị
│   └── grading_worker.py            # SQS Consumer chấm thi trắc nghiệm theo lô (Batch 10) & Upstash Redis
└── data/                            # Dữ liệu mẫu (Seed Data) & Scripts quản trị
    ├── questions_seed.json          # Dữ liệu mẫu ngân hàng câu hỏi chuẩn hóa
    ├── candidates_seed.json         # Dữ liệu mẫu thí sinh kèm liên kết ảnh thẻ S3
    ├── sessions_seed.json           # Dữ liệu mẫu ca thi trực tuyến
    ├── sample_exam_ses101.docx      # Đề thi Word mẫu 50 câu SES101 dùng thử nghiệm bóc tách AI
    ├── seed_dynamodb.py             # Script nạp dữ liệu mẫu vào 5 bảng DynamoDB
    ├── seed_cognito.py              # Script tạo tài khoản mẫu và phân nhóm Cognito RBAC
    ├── upload_sample_faces.py       # Script đồng bộ ảnh thẻ chân dung lên S3 Media Bucket
    └── sample_faces/                # Thư mục ảnh thẻ thí sinh kiểm thử điểm danh sinh trắc học
```

---

## 2. PHÂN RÃ CÁC VI DỊCH VỤ TÍNH TOÁN (AWS LAMBDA ARM64)

Hạ tầng tính toán sử dụng kiến trúc vi xử lý **AWS Graviton2 (arm64)** chạy **Python 3.11**, mang lại hiệu năng cao hơn 20% và chi phí thấp hơn 20% so với kiến trúc x86 truyền thống:

### 2.1. Vi dịch vụ Core REST API (`api_handler.py`)
- **Vai trò:** Xử lý toàn bộ logic nghiệp vụ học thuật và quản trị hệ thống.
- **Các nhóm route chính:**
  - `GET /auth/me`, `GET /auth/role`: Xác thực và trích xuất thông tin người dùng từ Cognito JWT Claims.
  - `/question-banks`: CRUD ngân hàng đề thi.
  - `/questions`: CRUD câu hỏi, hỗ trợ lọc theo môn học, độ khó, ngân hàng.
  - `POST /questions/parse-doc`: Bóc tách đề thi Word `.docx` thành danh sách JSON chuẩn hóa. Tự động chuyển đổi giữa **Google Gemini 1.5 Flash AI** và **Local Regex NLP Fallback Parser** khi không có API Key.
  - `POST /questions/image-upload`: Cấp S3 Presigned URL (SigV4 TTL 300s) cho phép tải ảnh minh họa trực tiếp lên S3 (Direct-to-Storage).
  - `/candidates`: Quản lý hồ sơ thí sinh, mã sinh viên và ảnh thẻ sinh trắc học.
  - `/sessions`: Quản lý ca thi (`DRAFT`, `SCHEDULED`, `RUNNING`, `COMPLETED`), danh sách thí sinh, cán bộ giám thị và mật khẩu phòng thi.
  - `GET /sessions/{id}/exam-paper`: Cấp đề thi cho thí sinh — **tự động loại bỏ đáp án đúng (`correctAnswer`) và lời giải thích** để chống gian lận qua F12 DevTools.
  - `POST /exam/submit`: Xác thực token Cloudflare Turnstile chống bot, đóng gói bài thi và đẩy vào hàng đợi **Amazon SQS** trong thời gian **$< 50$ mili-giây**.
  - `POST /exam/sync`: Tiếp nhận bài lưu nháp định kỳ từ phòng thi Local-First.
  - `GET /sessions/{id}/leaderboard`: Trả về bảng xếp hạng trực tiếp nạp từ **Upstash Serverless Redis (< 5ms)** hoặc fallback sang DynamoDB.
  - `POST /sessions/{id}/send-report`: Phát hành email tổng kết điểm số ca thi qua **Amazon SNS Topic** (`cloudexam-exam-reports-dev`).

### 2.2. Vi dịch vụ Điểm danh Sinh trắc học AI (`face_verify_handler.py`)
- **Vai trò:** Thị giác máy tính nhận diện khuôn mặt thí sinh 1:1 trước khi cấp quyền vào phòng thi.
- **Quy trình hoạt động:**
  1. Kiểm tra ca thi đang ở trạng thái `RUNNING` và thí sinh có trong danh sách ca thi.
  2. Nạp ảnh thẻ gốc của thí sinh lưu tại `s3://<BUCKET>/faces/{studentCode}.jpg`.
  3. Giải mã ảnh webcam trực tiếp và gọi API `rekognition.compare_faces` với ngưỡng tin cậy **$\ge 80.0\%$**.
  4. Ghi nhận mã định danh thiết bị (`deviceFingerprint`) vào trường `lockedCandidates` của ca thi trong DynamoDB để khóa quyền làm bài trên thiết bị hiện tại, ngăn chặn thí sinh đăng nhập đồng thời từ máy tính thứ hai hoặc thi hộ.
  5. Đặt trong mạng riêng ảo VPC Private Subnets, kết nối tới Rekognition qua AWS PrivateLink Interface Endpoint khép kín.

### 2.3. Vi dịch vụ Chấm thi Ngầm theo Lô (`grading_worker.py`)
- **Vai trò:** Tiêu thụ bất đồng bộ các bài thi từ hàng đợi Amazon SQS.
- **Quy trình hoạt động:**
  1. Lắng nghe SQS Event Source Mapping với `BatchSize = 10` và `MaximumBatchingWindowInSeconds = 2`.
  2. Gom danh sách câu hỏi và nạp đáp án gốc từ DynamoDB bằng duy nhất một lệnh `BatchGetItem` tối ưu IOPS.
  3. Tự động chấm điểm, so sánh đáp án và ghi kết quả kép (*Dual-Write*):
     - Bản ghi chi tiết bài làm vào bảng `CloudExam_Submissions_dev`.
     - Cập nhật trạng thái và điểm tổng kết vào bảng `CloudExam_Sessions_dev`.
  4. Đẩy điểm số tức thì lên **Upstash Serverless Redis** Sorted Set qua lệnh `ZADD` để cập nhật Live Leaderboard thời gian thực.
  5. Nếu bài thi gặp lỗi xử lý, SQS tự động thử lại 3 lần (`maxReceiveCount = 3`); sau 3 lần thất bại, message được chuyển an toàn sang **Dead-Letter Queue (DLQ)**, đảm bảo tỷ lệ mất bài thi bằng **đúng 0%**.

---

## 3. CƠ SỞ DỮ LIỆU DYNAMODB (5 BẢNG ON-DEMAND)

Toàn bộ CSDL được cấu hình ở chế độ `PAY_PER_REQUEST` (On-Demand), đảm bảo chi phí duy trì là **$0.00 khi không có ca thi**:

| Tên Bảng DynamoDB | Partition Key (PK) | Sort Key (SK) | Global Secondary Index (GSI) |
| :--- | :--- | :--- | :--- |
| `CloudExam_QuestionBanks_dev` | `id` (String) | — | — |
| `CloudExam_Questions_dev` | `id` (String) | — | `BankIdIndex` (`bankId`) |
| `CloudExam_Candidates_dev` | `email` (String) | — | `StudentCodeIndex` (`studentCode`) |
| `CloudExam_Sessions_dev` | `id` (String) | — | — |
| `CloudExam_Submissions_dev` | `id` (String) | — | `SessionResultsIndex` (PK: `sessionId`, SK: `score` DESC) |

---

## 4. ĐIỀU PHỐI VÒNG ĐỜI CA THI BẰNG AWS STEP FUNCTIONS

Máy trạng thái `cloudexam-exam-lifecycle-v2-dev` tự động hóa 100% chu trình tổ chức thi:
1. **Wait Until End Time:** Đưa execution vào trạng thái ngủ cho đến đúng mốc thời gian kết thúc ca thi (`endTime`), hoàn toàn không tiêu tốn tài nguyên CPU.
2. **Auto-Finalize Draft Submissions:** Tự động chuyển ca thi sang trạng thái `COMPLETED`, quét toàn bộ các bài làm nháp còn lưu trong DynamoDB của các thí sinh chưa kịp bấm nộp bài để tự động chấm điểm và bảo vệ quyền lợi sinh viên.
3. **Publish SNS Summary Report:** Tổng hợp phổ điểm ca thi và gửi báo cáo thông báo tức thì tới email của Cán bộ Giám thị và Giảng viên qua **Amazon SNS Topic (`cloudexam-exam-reports-dev`)**.

---

## 5. HƯỚNG DẪN TRIỂN KHAI VÀ VẬN HÀNH

### 5.1. Yêu cầu tiên quyết
- Terraform `v1.8+`
- AWS CLI đã cấu hình quyền (`aws configure`) với Default Region `ap-southeast-1`
- Python `3.11+` và thư viện `boto3`

### 5.2. Khởi tạo và triển khai hạ tầng với Terraform
```bash
cd backend/terraform

# 1. Tạo file cấu hình cá nhân
cp terraform.tfvars.example terraform.tfvars

# 2. Khởi tạo và kiểm tra tính hợp lệ
terraform init
terraform validate

# 3. Triển khai hạ tầng lên AWS
terraform apply -auto-approve
```

### 5.3. Nạp dữ liệu mẫu vào AWS
```bash
# Nạp danh sách câu hỏi, thí sinh và ca thi vào DynamoDB
python backend/data/seed_dynamodb.py

# Nạp tài khoản và phân quyền vào Cognito User Pool
python backend/data/seed_cognito.py

# Đồng bộ ảnh thẻ thí sinh lên S3 Media Bucket
python backend/data/upload_sample_faces.py --bucket <S3_BUCKET_NAME_FROM_TERRAFORM_OUTPUT>
```

---

## 6. TÀI LIỆU KỸ THUẬT THAM KHẢO

- 📄 **[Báo cáo Tổng kết Đồ án Chi tiết (REPORT.md)](../docs/report/REPORT.md)**
- 📁 **[Thư mục Báo cáo & Danh mục Hình ảnh Minh chứng](../docs/report/README.md)**
- 🔒 **[Báo cáo Rà soát An ninh Zero-Trust](../docs/SECURITY_AUDIT_REPORT.md)**
- ⚡ **[Báo cáo Kiểm thử Tải Nộp bài Dồn dập (Submission Stampede)](../docs/SUBMISSION_STAMPEDE_REPORT.md)**
- 💰 **[Báo cáo Quản trị Tài chính Đám mây FinOps (0 USD)](../docs/finops_report.md)**
- 🎬 **[Kịch bản Quay Demo Kỹ thuật Hệ thống](../docs/demo/KICH_BAN_QUAY_DEMO.md)**
- 🗄️ **[Đặc tả Thiết kế Cơ sở Dữ liệu NoSQL DynamoDB](../docs/DATABASE_DESIGN.md)**
- 🪣 **[Đặc tả Kiến trúc Phân vùng Lưu trữ Amazon S3](../docs/S3_STORAGE_DESIGN.md)**
- 🔑 **[Hướng dẫn Cognito, API Gateway & IAM Security](../docs/COGNITO_IAM_APIGATEWAY_GUIDE.md)**

---

*© 2026 CloudExam Team — VNU University of Engineering and Technology (VNU-UET).*
