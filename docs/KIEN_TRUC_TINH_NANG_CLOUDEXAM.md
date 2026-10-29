# CHƯƠNG 2: THIẾT KẾ KIẾN TRÚC HỆ THỐNG CLOUDEXAM
## MỤC 2.1: KIẾN TRÚC VỀ TÍNH NĂNG CỦA HỆ THỐNG (FUNCTIONAL ARCHITECTURE)
### Dự án: Nền tảng Khảo thí Trực tuyến Không máy chủ & Trí tuệ Nhân tạo Đa Quốc Gia
### Môn học: Điện toán đám mây (INT3319 1) — Nhóm 14 — Trường Đại học Công nghệ, ĐHQGHN (VNU-UET)

---

## I. TỔNG QUAN TRIẾT LÝ KIẾN TRÚC TÍNH NĂNG

Kiến trúc tính năng của **CloudExam** được thiết kế theo mô hình **Kiến trúc Hướng Dịch vụ Phi Máy chủ (Serverless Service-Oriented Architecture - SOA)** kết hợp **Mô hình Hạt nhân & Vệ tinh Đa Đám Mây (Hub-and-Spoke Multi-Cloud Architecture)**. 

Toàn bộ hệ thống được phân rã thành các phân hệ chức năng tương ứng trực tiếp với **các tính năng cốt lõi** phục vụ 3 nhóm đối tượng người dùng (Thí sinh, Giám thị, Giảng viên):
1. **Lõi hạt nhân AWS (Core Backbone):** Đóng vai trò trung tâm điều phối, đảm bảo tính nhất quán dữ liệu, bảo mật định danh cấp doanh nghiệp, thị giác máy tính nhận diện khuôn mặt và bộ đệm hấp thụ xung tải với độ tin cậy tuyệt đối.
2. **Vệ tinh Đa Đám Mây (0 USD Multi-Cloud Satellites):** Mở rộng năng lực số hóa đề thi bằng AI tạo sinh (Google Gemini 1.5 Flash API) và lá chắn chống Botnet tàng hình tại biên (Cloudflare Turnstile) với chi phí hoàn toàn **0.00 USD**.

### Quy chuẩn thiết kế & Định danh chức năng:
* **Tách bạch cụm Controller/Service chuyên biệt:** Không dồn toàn bộ API vào một hàm Lambda "monolith" mà phân rã thành 3 microservices độc lập:
  * `CloudExam AI Question Parser Server (AWS Lambda · gemini_parser.py)`
  * `CloudExam Media Presign Service (AWS Lambda · s3_presigner.py)`
  * `CloudExam Academic CRUD Controller (AWS Lambda · academic_crud.py)`
* **Điều phối tự động bằng Amazon EventBridge Scheduler:** Cơ chế lên lịch tự động cho ca thi không tự chạy lơ lửng mà được Lambda `Academic CRUD Controller` khởi tạo lịch (`scheduler:CreateSchedule`) kích hoạt `AWS Step Functions` đúng mốc thời gian bắt đầu (`startTime`).
* **Chuẩn hóa định danh theo Dự án (Enterprise Project-Prefixed Naming):** Mỗi cấu kiện đều mang tên chức năng nghiệp vụ cụ thể gắn với tiền tố dự án `CloudExam` và tên dịch vụ hạ tầng trong ngoặc đơn (ví dụ: `CloudExam Submission Buffer (Amazon SQS Standard Queue)`, `CloudExam Question Banks Store (DynamoDB: CloudExam_QuestionBanks_dev)`).
* **Bố cục 3 khối cân đối (Balanced 3-Column Layout):** Mọi sơ đồ phân hệ đều tuân thủ luồng tự nhiên: **Trái (Client, Hardware & Edge) $\rightarrow$ Giữa (AWS Compute & Core Services) $\rightarrow$ Phải (Storage, AI & Satellites)**.
* **Tách bạch CSDL 4 Bảng DynamoDB độc lập:** Phân rã thành đúng 4 bảng thực tế trong Terraform: `CloudExam_Candidates_dev`, `CloudExam_Sessions_dev`, `CloudExam_Questions_dev`, `CloudExam_QuestionBanks_dev`.
* **Giao thức chuẩn tầng Transport & Mã định danh [L-xx]:** Toàn bộ mũi tên trên sơ đồ được chuẩn hóa với giao thức truyền thông chuẩn (`HTTPS / TLS 1.3`, `AWS SDK Boto3 SigV4 Auth`, `S3 OAC`, `REST over HTTPS`) và mã định danh tra cứu `[L-01a]` đến `[L-25]`.

---

## II. BẢNG ĐỐI CHIẾU THAY ĐỔI TÍNH NĂNG SO VỚI PROGRESS REPORT 1

| STT | Nội dung thay đổi (Thêm chức năng) | Progress Report 1 | Progress Report 2 (Sprint 3 Update) | Mục đích kỹ thuật & Giá trị kiến trúc |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Tạo đề thi từ file Word/PDF bằng AI** | Giảng viên phải gõ tay từng câu hỏi và 4 đáp án trên web. | Giảng viên tải file Word/PDF lên, Google Gemini 1.5 Flash AI tự động bóc tách thành câu hỏi trắc nghiệm JSON. | Tiết kiệm 95% thời gian soạn đề; tận dụng hạn mức miễn phí 1.500 req/ngày của Google AI Studio (0 USD). |
| **2** | **Cơ chế nộp bài và chấm điểm tự động** | Nộp bài trực tiếp vào máy chủ (nguy cơ nghẽn mạng khi nghìn thí sinh nộp giây cuối). | Nộp bài qua hàng đợi Amazon SQS, chấm ngầm theo lô (Batch 10) và có hàng đợi lỗi (DLQ) bảo toàn dữ liệu. | Mẫu hình *Queue-Based Load Leveling*: Phản hồi nộp bài < 50ms, chống sập hệ thống và bảo toàn 100% bài thi. |
| **3** | **Quản lý ca thi và gửi điểm tự động** | Giảng viên phải canh giờ bấm nút mở/đóng ca thi thủ công. | AWS Step Functions & EventBridge Scheduler tự động mở/khóa ca thi đúng giờ và phát email bảng điểm qua Amazon SNS. | Tự động hóa 100% chu trình ca thi bằng máy trạng thái Cloud, loại bỏ hoàn toàn sự can thiệp thủ công. |
| **4** | **Giao diện và Đa ngôn ngữ Đa Quốc Gia** | Chỉ có 1 giao diện tiếng Việt cố định. | Hỗ trợ đa ngôn ngữ (VI/LA/EN) và CloudFront Functions tự đổi thương hiệu theo tên miền (`cloudexam.vn` vs `edulao.la`). | Phục vụ thí sinh và các kỳ thi quốc tế theo mô hình *Single-Table Multi-Tenancy* trên cùng hạ tầng dùng chung. |
| **5** | **Quản lý thí sinh & Ảnh thẻ sinh trắc học** | Chưa tách riêng thành phân hệ độc lập. | Bổ sung phân hệ quản lý hồ sơ thí sinh và nạp ảnh thẻ chân dung gốc lên S3 để đối soát khuôn mặt qua AI Rekognition. | Chuẩn bị dữ liệu sinh trắc học chuẩn xác cho bài toán thị giác máy tính 1:1, ngăn chặn triệt để thi hộ. |
| **6** | **Lá chắn chống Bot & Xâm nhập tại Biên** | Không có lớp lọc bot, chỉ xác thực mật khẩu. | Bổ sung Cloudflare Turnstile token vào payload nộp bài, kết hợp AWS WAFv2 bảo vệ cổng API. | Triệt tiêu tấn công DoS/DDoS và công cụ auto-click nộp bài gian lận (0 USD). |

---

## III. HỆ THỐNG 5 SƠ ĐỒ KIẾN TRÚC TÍNH NĂNG (MULTI-DIAGRAM SYSTEM)

Kiến trúc tính năng của CloudExam được tinh gọn và phân rã thành **1 sơ đồ tổng thể toàn cảnh** và **4 sơ đồ phân hệ chuyên sâu**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   HỆ THỐNG 5 SƠ ĐỒ KIẾN TRÚC TÍNH NĂNG CLOUDEXAM (DIAGRAM-AS-CODE)                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. HÌNH 2.1: SƠ ĐỒ KIẾN TRÚC TÍNH NĂNG TỔNG THỂ (MASTER FUNCTIONAL ARCHITECTURE)                       │
│    -> Bao quát toàn diện 9 tính năng, bổ sung EventBridge Scheduler, 3 cột chuẩn Enterprise.           │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. HÌNH 2.2: PHÂN HỆ CỔNG BIÊN, ĐA QUỐC GIA & ĐỊNH DANH TẬP TRUNG (TÍNH NĂNG 1 & 9)                     │
│    -> Route 53 Anycast, CloudFront Functions (Tenant Injection), S3 OAC, Cognito PKCE & WAFv2.          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. HÌNH 2.3: PHÂN HỆ QUẢN TRỊ ĐỀ THI & SỐ HÓA BẰNG AI (TÍNH NĂNG 2 & 3)                                │
│    -> Tách 3 Lambda Server chuyên biệt, EventBridge Scheduler, 4 Bảng DynamoDB, Gemini AI & S3 Presign. │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. HÌNH 2.4: PHÂN HỆ ĐIỂM DANH SINH TRẮC HỌC & AI REKOGNITION (TÍNH NĂNG 4 & 5)                        │
│    -> HTML5 Webcam Base64, S3 Face Photos Vault, Rekognition CompareFaces (>= 80%) & SNS Alert.       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. HÌNH 2.5: PHÂN HỆ PHÒNG THI, ĐỒNG BỘ TRẠNG THÁI & NỘP BÀI SQS (TÍNH NĂNG 6 & 7)                    │
│    -> Bao trọn Quy trình C (Atomic Sync draftAnswers) & Quy trình D (Nộp SQS, Batch 10 & DLQ).         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. HÌNH 2.1: SƠ ĐỒ KIẾN TRÚC TÍNH NĂNG TỔNG THỂ (MASTER FUNCTIONAL ARCHITECTURE)

* **Tệp mã nguồn Eraser:** [`docs/architecture_diagram_master.eraser`](file:///C:/Users/ADMIN/Downloads/demo/ExamInTheCloud/docs/architecture_diagram_master.eraser)

```eraser
// ==============================================================================
// CLOUDEXAM — HÌNH 2.1: SƠ ĐỒ KIẾN TRÚC TÍNH NĂNG TỔNG THỂ (MASTER FUNCTIONAL ARCHITECTURE)
// Phiên bản chuẩn hóa v4.0 · Bổ sung EventBridge Scheduler · Đầy đủ mã luồng [L-xx]
// Cú pháp: Eraser.io Diagram-as-Code (https://app.eraser.io)
// ==============================================================================

direction right

// ------------------------------------------------------------------------------
// CỘT 1: LỚP GIAO DIỆN, THIẾT BỊ NGOẠI VI & BIÊN (CLIENT & EDGE ZONE)
// ------------------------------------------------------------------------------
"1. TRUY CẬP, THIẾT BỊ & BIÊN" [color: blue] {
  Users [icon: users, label: "CloudExam Multi-Country Users\n(Thí sinh · Giảng viên · Giám thị)"]
  WebcamDevice [icon: camera, label: "CloudExam Hardware Webcam\n(HTML5 MediaDevices Peripheral)"]
  AntiBotShield [icon: shield, label: "CloudExam Anti-Bot Shield\n(Cloudflare Turnstile)"]
  EdgeRouter [icon: aws-cloudfront, label: "CloudExam Edge Tenant Router\n(CloudFront Functions)"]
  ReactApp [icon: react, label: "CloudExam Portal Web Client\n(React 18 SPA · Đa ngôn ngữ)"]
  AuthServer [icon: aws-cognito, label: "CloudExam Auth Server\n(Amazon Cognito · PKCE Flow)"]
  APIGateway [icon: aws-api-gateway, label: "CloudExam Central API Gateway\n(Amazon API Gateway REST API)"]
}

// ------------------------------------------------------------------------------
// CỘT 2: AWS CLOUD — DỮ LIỆU, XỬ LÝ NỀN VÀ AI (SERVERLESS BACKBONE)
// ------------------------------------------------------------------------------
"2. AWS CLOUD — DỮ LIỆU & XỬ LÝ NỀN" [color: amber] {
  "Lưu trữ & Cơ sở dữ liệu dùng chung" {
    AcademicDB [icon: aws-dynamodb, label: "CloudExam Academic Datastore\n(DynamoDB 4 Bảng On-Demand)"]
    MediaBucket [icon: aws-s3, label: "CloudExam Media Storage Bucket\n(Amazon S3 Bucket: questions/)"]
  }

  "Điểm danh sinh trắc học AI" {
    FaceVault [icon: aws-s3, label: "CloudExam Face Photos Vault\n(Amazon S3 Bucket: faces/)"]
    BiometricHandler [icon: aws-lambda, label: "CloudExam Biometric Verify Server\n(AWS Lambda · face_verify_handler)"]
    RekognitionAI [icon: aws-rekognition, label: "CloudExam Face Match Engine\n(Amazon Rekognition SaaS)"]
  }

  "Đệm tải SQS & Chấm tự động" {
    AppProducer [icon: aws-lambda, label: "CloudExam Ingestion & Core API Server\n(AWS Lambda · Producer & Controller)"]
    SubmissionQueue [icon: aws-sqs, label: "CloudExam Submission Buffer\n(Amazon SQS Standard Queue)"]
    GradingWorker [icon: aws-lambda, label: "CloudExam Grading Worker Server\n(AWS Lambda · Batch 10)"]
    DeadLetterQueue [icon: aws-sqs, label: "CloudExam Submission DLQ\n(Amazon SQS Dead-Letter Queue)"]
  }

  "Vòng đời ca thi & Báo cáo" {
    SchedulerService [icon: aws-eventbridge, label: "CloudExam EventBridge Scheduler\n(Amazon EventBridge Schedule)"]
    ExamStateMachine [icon: aws-step-functions, label: "CloudExam Exam State Machine\n(AWS Step Functions)"]
    NotificationTopic [icon: aws-sns, label: "CloudExam Notification Topic\n(Amazon SNS Topic)"]
  }

  "Vận hành & Giám sát FinOps" {
    SecretsVault [icon: aws-systems-manager, label: "CloudExam Secrets Store\n(AWS SSM Parameter Store)"]
    TelemetryEngine [icon: aws-cloudwatch, label: "CloudExam Observability Engine\n(Amazon CloudWatch & Budgets)"]
  }
}

// ------------------------------------------------------------------------------
// CỘT 3: DỊCH VỤ NGOÀI MULTI-CLOUD (0 USD SATELLITES)
// ------------------------------------------------------------------------------
"3. DỊCH VỤ NGOÀI MULTI-CLOUD" [color: purple] {
  GenAIEngine [icon: google-cloud, label: "CloudExam AI Document Parser\n(Google Gemini 1.5 Flash API)"]
}

// ==============================================================================
// GIAO THỨC TRUYỀN THÔNG & ĐIỀU HƯỚNG TỰ NHIÊN (LEFT -> CENTER -> RIGHT)
// ==============================================================================

// 1. Phân giải tên miền & Truy cập đa quốc gia (Tính năng 9)
Users > EdgeRouter: "[L-01a] HTTPS DNS: cloudexam.vn / edulao.la"
EdgeRouter > ReactApp: "[L-02b] Edge Inject: x-tenant-id"

// 2. Định danh & Cổng API trung tâm (Tính năng 1)
ReactApp <> AuthServer: "[L-03] HTTPS POST (OAuth 2.0 PKCE / Bearer JWT)"
ReactApp > APIGateway: "[L-04] HTTPS REST (Port 443 + Bearer Token)"
APIGateway > AppProducer: "[L-05] AWS Lambda Proxy Integration (SigV4)"

// 3. Quản trị đề thi & Số hóa AI (Tính năng 2 & 3)
AppProducer > MediaBucket: "[L-06] AWS SDK Boto3 (SigV4) - Action: s3:generate_presigned_url"
ReactApp > MediaBucket: "[L-07] Direct HTTPS PUT (Content-Type: image/*)"
AppProducer > SecretsVault: "[L-08] AWS SDK Boto3 (SigV4) - Action: ssm:GetParameter"
AppProducer > GenAIEngine: "[L-09] REST over HTTPS (POST /v1beta/models/gemini-1.5-flash:generateContent)"
GenAIEngine > AppProducer: "[L-10] HTTPS Response 200 (Structured JSON MCQs)"
AppProducer > AcademicDB: "[L-11b] AWS SDK Boto3 (SigV4) - Action: dynamodb:BatchWriteItem"

// Kích hoạt Vòng đời ca thi (Tính năng 8)
AppProducer > SchedulerService: "[L-11e] AWS SDK Boto3 (SigV4) - Action: scheduler:CreateSchedule"
SchedulerService > ExamStateMachine: "[L-11f] EventBridge Target Invocation - StartExecution"

// 4. Điểm danh sinh trắc học AI có Webcam (Tính năng 4 & 5)
Users > WebcamDevice: "Căn chỉnh mặt trước camera"
WebcamDevice > ReactApp: "[L-12] HTML5 navigator.mediaDevices (Base64 Frame)"
ReactApp > APIGateway: "[L-13] HTTPS POST (application/json - Base64 < 10MB) /auth/face-verify"
APIGateway > BiometricHandler: "[L-05d] AWS Lambda Proxy Integration"
FaceVault > BiometricHandler: "[L-14] AWS SDK Boto3 (SigV4) - Action: s3:GetObject"
BiometricHandler > RekognitionAI: "[L-15] AWS SDK Boto3 (SigV4) - Action: rekognition:CompareFaces"
BiometricHandler > AcademicDB: "[L-16] AWS SDK Boto3 (SigV4) - Action: dynamodb:UpdateItem (CHECKED_IN)"
BiometricHandler > NotificationTopic: "[L-17] AWS SDK Boto3 (SigV4) - Action: sns:Publish (Cảnh báo)"

// 5. Nộp bài đệm tải SQS & Chấm theo lô (Tính năng 6 & 7)
ReactApp > AntiBotShield: "HTTPS GET (Request Turnstile Token < 0.1s)"
AntiBotShield > ReactApp: "cf-turnstile-response String"
ReactApp > APIGateway: "[L-18c] HTTPS POST (application/json) /exam/submit"
AppProducer > SubmissionQueue: "[L-19] AWS SDK Boto3 (SigV4) - Action: sqs:SendMessage"
SubmissionQueue > GradingWorker: "[L-20] AWS SQS-to-Lambda Event Source Mapping (Batch 10)"
GradingWorker > AcademicDB: "[L-21b] AWS SDK Boto3 (SigV4) - Action: dynamodb:UpdateItem (COMPLETED)"
GradingWorker > DeadLetterQueue: "[L-22] SQS Redrive Policy (maxReceiveCount = 3)"

// 6. Điều phối vòng đời ca thi & Giám sát (Tính năng 8)
ExamStateMachine > AcademicDB: "[L-23] AWS SDK Task - Action: dynamodb:updateItem (RUNNING/CLOSED)"
ExamStateMachine > NotificationTopic: "[L-24] AWS SDK Task - Action: sns:publish (Email bảng điểm)"
DeadLetterQueue > TelemetryEngine: "[L-25] CloudWatch Metric Alarm (MessagesVisible > 0)"
```

---

### 2. CÁC SƠ ĐỒ PHÂN HỆ CHUYÊN SÂU (BỐ CỤC 3 KHỐI CÂN ĐỐI)

#### Hình 2.2: Phân hệ Cổng Biên, Đa Quốc Gia & Định danh Tập trung (Tính năng 1 & 9)
* **Tệp mã nguồn:** [`docs/architecture_diagram_ingress_auth.eraser`](file:///C:/Users/ADMIN/Downloads/demo/ExamInTheCloud/docs/architecture_diagram_ingress_auth.eraser)

```eraser
// ==============================================================================
// CLOUDEXAM — HÌNH 2.2: PHÂN HỆ CỔNG BIÊN, ĐA QUỐC GIA & ĐỊNH DANH TẬP TRUNG (TÍNH NĂNG 1 & 9)
// Phiên bản chuẩn hóa v4.0 · Bổ sung toàn diện mã luồng [L-xx] & Giao thức bảo mật OAC/WAFv2
// Cú pháp: Eraser.io Diagram-as-Code (https://app.eraser.io)
// ==============================================================================

direction right

// ------------------------------------------------------------------------------
// CỘT 1: TRUY CẬP ĐA QUỐC GIA & ĐỊNH TUYẾN TOÀN CẦU (GLOBAL INGRESS)
// ------------------------------------------------------------------------------
"1. TRUY CẬP & ĐỊNH TUYẾN TOÀN CẦU" [color: blue] {
  VNCandidate [icon: users, label: "CloudExam VN Candidates\n(Domain: cloudexam.vn)"]
  LACandidate [icon: users, label: "CloudExam LA Candidates\n(Domain: edulao.la)"]
  GlobalDNS [icon: aws-route-53, label: "CloudExam Global DNS\n(Amazon Route 53 Anycast)"]
}

// ------------------------------------------------------------------------------
// CỘT 2: PHÂN PHỐI NỘI DUNG TẠI BIÊN & ĐA THUÊ BAO (EDGE MULTI-TENANCY)
// ------------------------------------------------------------------------------
"2. PHÂN PHỐI BIÊN & ĐA THUÊ BAO" [color: amber] {
  EdgeCDN [icon: aws-cloudfront, label: "CloudExam Edge Distribution\n(Amazon CloudFront Global)"]
  EdgeFunction [icon: aws-lambda, label: "CloudExam Edge Tenant Resolver\n(CloudFront Functions)"]
  SPAStorage [icon: aws-s3, label: "CloudExam Static Web Hosting Bucket\n(Amazon S3 Static Bucket)"]
  ThemedClient [icon: react, label: "CloudExam Multi-Tenant Web Client\n(React 18 · VI / LA Themes)"]
}

// ------------------------------------------------------------------------------
// CỘT 3: BẢO VỆ TƯỜNG LỬA, ĐỊNH DANH & CỔNG API (SECURITY & ACCESS CONTROL)
// ------------------------------------------------------------------------------
"3. AN NINH, ĐỊNH DANH & CỔNG API" [color: green] {
  CognitoPool [icon: aws-cognito, label: "CloudExam Auth Server\n(Amazon Cognito · PKCE Flow)"]
  WAFShield [icon: aws-waf, label: "CloudExam Application Firewall\n(AWS WAFv2 · Anti-DDoS)"]
  APIGateway [icon: aws-api-gateway, label: "CloudExam Central API Gateway\n(Cognito JWT Authorizer)"]
  CoreAPIHandler [icon: aws-lambda, label: "CloudExam Core API Server\n(AWS Lambda · api_handler.py)"]
}

// ==============================================================================
// LUỒNG TƯƠNG TÁC TÍNH NĂNG ĐẦY ĐỦ MÃ ĐỊNH DANH [L-xx] & GIAO THỨC CHUẨN
// ==============================================================================

// 1. Phân giải DNS và định tuyến Edge
VNCandidate > GlobalDNS: "[L-01a] DNS Query (UDP/TCP 53) - cloudexam.vn"
LACandidate > GlobalDNS: "[L-01b] DNS Query (UDP/TCP 53) - edulao.la"
GlobalDNS > EdgeCDN: "[L-01c] Anycast Edge Ingress (HTTPS / TLS 1.3 - Port 443)"

// 2. Multi-tenant Header Injection & Cung cấp Web tĩnh qua OAC
EdgeCDN > EdgeFunction: "[L-02a] CloudFront Viewer Request Hook (Edge Event)"
EdgeFunction > EdgeCDN: "[L-02b] Inject Header: x-tenant-id (vn / la)"
EdgeCDN > SPAStorage: "[L-02c] S3 Origin Access Control (OAC) over HTTPS (SigV4)"
EdgeCDN > ThemedClient: "[L-02d] Phục vụ React SPA (HTML/JS/CSS Assets)"

// 3. Đăng nhập phân quyền OAuth 2.0 PKCE
ThemedClient <> CognitoPool: "[L-03] HTTPS POST (OAuth 2.0 PKCE / Authorization Code Flow)"

// 4. Kiểm soát an ninh và truy cập API Gateway
ThemedClient > WAFShield: "[L-04a] HTTPS REST Requests (Port 443 + Bearer JWT)"
WAFShield > APIGateway: "[L-04b] AWS WAFv2 Web ACL Inspection & Rate Limit"
APIGateway > APIGateway: "[L-04c] Cognito Authorizer (Verify JWT Signature & Claims)"
APIGateway > CoreAPIHandler: "[L-05] AWS Lambda Proxy Integration (SigV4)"
```

---

#### Hình 2.3: Phân hệ Quản trị Đề thi & Số hóa bằng AI (Tính năng 2 & 3)
* **Tệp mã nguồn:** [`docs/architecture_diagram_academic.eraser`](file:///C:/Users/ADMIN/Downloads/demo/ExamInTheCloud/docs/architecture_diagram_academic.eraser)

```eraser
// ==============================================================================
// CLOUDEXAM — HÌNH 2.3: PHÂN HỆ QUẢN TRỊ ĐỀ THI & SỐ HÓA BẰNG AI (TÍNH NĂNG 2 & 3)
// Phiên bản chuẩn hóa v4.0 · Tách 3 Lambda Server · Đầy đủ 4 Bảng CSDL & EventBridge
// Cú pháp: Eraser.io Diagram-as-Code (https://app.eraser.io)
// ==============================================================================

direction right

// ------------------------------------------------------------------------------
// CỘT 1: GIAO DIỆN & XÁC THỰC NGƯỜI DÙNG (INSTRUCTOR PORTAL)
// ------------------------------------------------------------------------------
"1. GIAO DIỆN & XÁC THỰC" [color: blue] {
  Instructor [icon: users, label: "CloudExam Instructors / Admins\n(Biên soạn đề & Quản lý kỳ thi)"]
  OrganizerPortal [icon: react, label: "CloudExam Organizer Portal\n(React 18 SPA · Vite Client)"]
  AuthServer [icon: aws-cognito, label: "CloudExam Auth Server\n(Amazon Cognito User Pool PKCE)"]
}

// ------------------------------------------------------------------------------
// CỘT 2: CỔNG API & 3 CỤM CONTROLLER/SERVICE CHUYÊN BIỆT (LAMBDA MICROSERVICES)
// ------------------------------------------------------------------------------
"2. CỔNG API & 3 CỤM LAMBDA SERVER" [color: amber] {
  APIGateway [icon: aws-api-gateway, label: "CloudExam Central API Gateway\n(Amazon API Gateway REST API)"]
  
  "Cụm 3 Dịch vụ Lambda Serverless" {
    MediaPresignService [icon: aws-lambda, label: "CloudExam Media Presign Service\n(AWS Lambda · s3_presigner.py)"]
    AIQuestionParser [icon: aws-lambda, label: "CloudExam AI Question Parser Server\n(AWS Lambda · gemini_parser.py)"]
    AcademicCRUDController [icon: aws-lambda, label: "CloudExam Academic CRUD Controller\n(AWS Lambda · academic_crud.py)"]
  }

  SecretsVault [icon: aws-systems-manager, label: "CloudExam Secrets Store\n(AWS SSM Parameter Store)"]
}

// ------------------------------------------------------------------------------
// CỘT 3: LƯU TRỮ ĐA PHƯƠNG TIỆN, CSDL 4 BẢNG & LẬP LỊCH TỰ ĐỘNG
// ------------------------------------------------------------------------------
"3. LƯU TRỮ, 4 BẢNG DYNAMODB & TỰ ĐỘNG HÓA" [color: green] {
  MediaBucket [icon: aws-s3, label: "CloudExam Media Storage Bucket\n(Amazon S3 · questions/*)"]
  
  "Phân vùng 4 Bảng CSDL Amazon DynamoDB" {
    QuestionBanksTable [icon: aws-dynamodb, label: "CloudExam Question Banks Store\n(DynamoDB: CloudExam_QuestionBanks_dev)"]
    QuestionsTable [icon: aws-dynamodb, label: "CloudExam Questions Store\n(DynamoDB: CloudExam_Questions_dev)"]
    CandidatesTable [icon: aws-dynamodb, label: "CloudExam Candidates Store\n(DynamoDB: CloudExam_Candidates_dev)"]
    SessionsTable [icon: aws-dynamodb, label: "CloudExam Sessions Store\n(DynamoDB: CloudExam_Sessions_dev)"]
  }

  GenAIEngine [icon: google-cloud, label: "CloudExam AI Document Parser\n(Google Gemini 1.5 Flash API)"]
  EventBridgeScheduler [icon: aws-eventbridge, label: "CloudExam EventBridge Scheduler\n(Amazon EventBridge Schedule)"]
  ExamStateMachine [icon: aws-step-functions, label: "CloudExam Exam State Machine\n(AWS Step Functions)"]
}

// ==============================================================================
// LUỒNG TƯƠNG TÁC TÍNH NĂNG VỚI PROTOCOL CHUẨN XÁC & MÃ [L-xx] ĐẦY ĐỦ
// ==============================================================================

// 1. Xác thực và điều hướng API
Instructor > OrganizerPortal: "Biên soạn câu hỏi / Tải file Word/PDF / Tạo ca thi"
OrganizerPortal <> AuthServer: "[L-03] HTTPS POST (OAuth 2.0 PKCE / Bearer JWT)"
OrganizerPortal > APIGateway: "[L-04] HTTPS REST (Port 443 + Bearer JWT)"

// 2. Tải ảnh đề thi trực tiếp (Presign Pattern)
APIGateway > MediaPresignService: "[L-05a] AWS Lambda Proxy Integration (POST /questions/presign)"
MediaPresignService > MediaBucket: "[L-06] HTTPS / AWS SDK Boto3 (SigV4) - Action: s3:generate_presigned_url (TTL 300s)"
OrganizerPortal > MediaBucket: "[L-07] Direct HTTPS PUT (Content-Type: image/* / Presigned URL)"

// 3. Số hóa đề thi tự động bằng GenAI Gemini
APIGateway > AIQuestionParser: "[L-05b] AWS Lambda Proxy Integration (POST /questions/parse-doc)"
AIQuestionParser > SecretsVault: "[L-08] HTTPS / AWS SDK Boto3 (SigV4) - Action: ssm:GetParameter (/cloudexam/gemini/api_key)"
AIQuestionParser > GenAIEngine: "[L-09] REST over HTTPS (POST /v1beta/models/gemini-1.5-flash:generateContent)"
GenAIEngine > AIQuestionParser: "[L-10] HTTPS Response 200 (Structured JSON MCQs [A,B,C,D])"
AIQuestionParser > QuestionsTable: "[L-11b] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:BatchWriteItem (Questions)"

// 4. CRUD Ngân hàng đề, Thí sinh & Tạo ca thi tự động
APIGateway > AcademicCRUDController: "[L-05c] AWS Lambda Proxy Integration (/banks, /candidates, /sessions)"
AcademicCRUDController > QuestionBanksTable: "[L-11a] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:PutItem (QuestionBanks)"
AcademicCRUDController > CandidatesTable: "[L-11c] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:BatchWriteItem (Candidates)"
AcademicCRUDController > SessionsTable: "[L-11d] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:PutItem (Sessions: SCHEDULED)"

// 5. Lập lịch tự động mở ca thi qua EventBridge Scheduler
AcademicCRUDController > EventBridgeScheduler: "[L-11e] HTTPS / AWS SDK Boto3 (SigV4) - Action: scheduler:CreateSchedule (startTime)"
EventBridgeScheduler > ExamStateMachine: "[L-11f] EventBridge Target Invocation - Action: states:StartExecution (startTime)"
AcademicCRUDController > OrganizerPortal: "HTTP 200 OK (Số hóa đề & lập lịch ca thi thành công 100%)"
```

---

#### Hình 2.4: Phân hệ Điểm danh Sinh trắc học & AI Rekognition (Tính năng 4 & 5)
* **Tệp mã nguồn:** [`docs/architecture_diagram_biometric.eraser`](file:///C:/Users/ADMIN/Downloads/demo/ExamInTheCloud/docs/architecture_diagram_biometric.eraser)

```eraser
// ==============================================================================
// CLOUDEXAM — HÌNH 2.4: PHÂN HỆ ĐIỂM DANH SINH TRẮC HỌC & AI REKOGNITION (TÍNH NĂNG 4 & 5)
// Phiên bản chuẩn hóa v4.0 · Bổ sung mã luồng [L-13a], [L-13b] & Protocol SigV4 chuẩn xác
// Cú pháp: Eraser.io Diagram-as-Code (https://app.eraser.io)
// ==============================================================================

direction right

// ------------------------------------------------------------------------------
// CỘT 1: THIẾT BỊ NGOẠI VI & THU NHẬN HÌNH ẢNH (EDGE CAPTURE)
// ------------------------------------------------------------------------------
"1. THIẾT BỊ NGOẠI VI & THU NHẬN ẢNH" [color: blue] {
  Candidate [icon: users, label: "CloudExam Candidates\n(Thí sinh vào thi: /?exam={sessionId})"]
  WebcamHardware [icon: camera, label: "CloudExam Hardware Webcam\n(HTML5 MediaDevices Peripheral)"]
  ExamRoomClient [icon: react, label: "CloudExam Exam Room Client\n(React 18 · Canvas Capture)"]
}

// ------------------------------------------------------------------------------
// CỘT 2: CỔNG API, LÕI XÁC THỰC & THỊ GIÁC AI (SERVERLESS AI VISION)
// ------------------------------------------------------------------------------
"2. CỔNG API & THỊ GIÁC AI" [color: amber] {
  APIGateway [icon: aws-api-gateway, label: "CloudExam Central API Gateway\n(Amazon API Gateway REST API)"]
  BiometricHandler [icon: aws-lambda, label: "CloudExam Biometric Verify Server\n(AWS Lambda · face_verify_handler.py)"]
  RekognitionAI [icon: aws-rekognition, label: "CloudExam Face Match Engine\n(Amazon Rekognition SaaS)"]
}

// ------------------------------------------------------------------------------
// CỘT 3: KHO ẢNH THẺ GỐC, CSDL & HỆ THỐNG CẢNH BÁO (STORAGE & ALERTS)
// ------------------------------------------------------------------------------
"3. ĐỐI SOÁT, CSDL & CẢNH BÁO" [color: green] {
  FaceVault [icon: aws-s3, label: "CloudExam Face Photos Vault\n(Amazon S3 Bucket: faces/)"]
  
  "CSDL Đối soát Hồ sơ & Ca thi" {
    CandidatesTable [icon: aws-dynamodb, label: "CloudExam Candidates Store\n(DynamoDB: CloudExam_Candidates_dev)"]
    SessionsTable [icon: aws-dynamodb, label: "CloudExam Sessions Store\n(DynamoDB: CloudExam_Sessions_dev)"]
  }

  AlertTopic [icon: aws-sns, label: "CloudExam Proctor Security Alert\n(Amazon SNS Topic)"]
}

// ==============================================================================
// LUỒNG TƯƠNG TÁC TÍNH NĂNG VỚI PROTOCOL CHUẨN XÁC & ĐẦY ĐỦ MÃ [L-xx]
// ==============================================================================

// 1. Thao tác thí sinh và chụp webcam
Candidate > ExamRoomClient: "Đăng nhập ca thi (Email + Passcode)"
Candidate > WebcamHardware: "Căn chỉnh mặt trước camera webcam"
WebcamHardware > ExamRoomClient: "[L-12] HTML5 navigator.mediaDevices.getUserMedia (Base64 JPEG Frame)"
ExamRoomClient > APIGateway: "[L-13] HTTPS POST (application/json - Base64 Payload < 10MB) /auth/face-verify"
APIGateway > BiometricHandler: "[L-05d] AWS Lambda Proxy Integration (SigV4)"

// 2. Kiểm tra điều kiện ca thi & Tải ảnh thẻ gốc
BiometricHandler > SessionsTable: "[L-13a] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:GetItem (Check RUNNING)"
BiometricHandler > CandidatesTable: "[L-13b] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:GetItem (Query GSI: StudentCodeIndex)"
FaceVault > BiometricHandler: "[L-14] HTTPS / AWS SDK Boto3 (SigV4) - Action: s3:GetObject (faces/{MSSV}.jpg)"

// 3. Thực thi đối soát AI Rekognition 1:1
BiometricHandler > RekognitionAI: "[L-15] HTTPS / AWS SDK Boto3 (SigV4) - Action: rekognition:CompareFaces (Similarity >= 80%)"
RekognitionAI > BiometricHandler: "HTTPS Response 200 (SimilarityScore %)"

// 4. Phân nhánh kết quả và cấp quyền
BiometricHandler > SessionsTable: "[L-16] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:UpdateItem (CHECKED_IN)"
BiometricHandler > ExamRoomClient: "HTTP 200 OK (Cấp quyền bước vào làm bài)"
BiometricHandler > AlertTopic: "[L-17] HTTPS / AWS SDK Boto3 (SigV4) - Action: sns:Publish (Cảnh báo gian lận)"
BiometricHandler > ExamRoomClient: "HTTP 403 Forbidden (Từ chối truy cập phòng thi)"
```

---

#### Hình 2.5: Phân hệ Phòng thi, Đồng bộ Trạng thái & Nộp bài SQS (Tính năng 6 & 7)
* **Tệp mã nguồn:** [`docs/architecture_diagram_grading.eraser`](file:///C:/Users/ADMIN/Downloads/demo/ExamInTheCloud/docs/architecture_diagram_grading.eraser)

```eraser
// ==============================================================================
// CLOUDEXAM — HÌNH 2.5: PHÂN HỆ PHÒNG THI, ĐỒNG BỘ TRẠNG THÁI & NỘP BÀI SQS
// Phiên bản chuẩn hóa v4.0 · Bổ sung Transport Protocol chuẩn SigV4 & Toàn diện mã [L-xx]
// Cú pháp: Eraser.io Diagram-as-Code (https://app.eraser.io)
// ==============================================================================

direction right

// ------------------------------------------------------------------------------
// CỘT 1: THÍ SINH & PHÒNG THI TRỰC TUYẾN (EXAM ROOM ENGINE)
// ------------------------------------------------------------------------------
"1. THÍ SINH & PHÒNG THI TRỰC TUYẾN" [color: blue] {
  Candidate [icon: users, label: "CloudExam Candidates\n(Thí sinh làm bài thi trực tuyến)"]
  ExamRoomClient [icon: react, label: "CloudExam Exam Room Engine\n(React 18 SPA · LocalStorage Backup)"]
  AntiBotShield [icon: shield, label: "CloudExam Anti-Bot Shield\n(Cloudflare Turnstile)"]
  APIGateway [icon: aws-api-gateway, label: "CloudExam Central API Gateway\n(Amazon API Gateway REST API)"]
}

// ------------------------------------------------------------------------------
// CỘT 2: XỬ LÝ SERVERLESS, ĐỆM TẢI SQS & CHẤM LÔ (COMPUTE & QUEUE)
// ------------------------------------------------------------------------------
"2. ĐỒNG BỘ NGẦM, HÀNG ĐỢI SQS & CHẤM LÔ" [color: orange] {
  ExamIngestionHandler [icon: aws-lambda, label: "CloudExam Ingestion Server\n(AWS Lambda · Producer & State Sync)"]
  SubmissionQueue [icon: aws-sqs, label: "CloudExam Submission Buffer\n(Amazon SQS Standard Queue)"]
  GradingWorker [icon: aws-lambda, label: "CloudExam Grading Worker Server\n(AWS Lambda · Batch 10)"]
  DeadLetterQueue [icon: aws-sqs, label: "CloudExam Submission DLQ\n(Amazon SQS Dead-Letter Queue)"]
  DLQAlarm [icon: aws-cloudwatch, label: "CloudExam DLQ Error Monitor\n(Amazon CloudWatch Alarm)"]
}

// ------------------------------------------------------------------------------
// CỘT 3: CSDL ĐÁP ÁN & LƯU TRỮ BỀN VỮNG (DATABASE PERSISTENCE)
// ------------------------------------------------------------------------------
"3. CSDL KẾT QUẢ & LƯU TRỮ BỀN VỮNG" [color: green] {
  "CSDL Đáp án & Lưu trữ Trạng thái" {
    SessionsTable [icon: aws-dynamodb, label: "CloudExam Sessions Store\n(DynamoDB: CloudExam_Sessions_dev)"]
    QuestionsTable [icon: aws-dynamodb, label: "CloudExam Questions Store\n(DynamoDB: CloudExam_Questions_dev)"]
  }
}

// ==============================================================================
// LUỒNG TƯƠNG TÁC TÍNH NĂNG VỚI PROTOCOL CHUẨN XÁC & MÃ [L-xx] ĐẦY ĐỦ
// ==============================================================================

// --- NHÁNH 1: QUY TRÌNH C (ĐỒNG BỘ BÀI LÀM THỜI GIAN THỰC) ---
Candidate > ExamRoomClient: "[Quy trình C] Chọn đáp án trắc nghiệm trên giao diện"
ExamRoomClient > ExamRoomClient: "Local Cache: window.localStorage.setItem"
ExamRoomClient > APIGateway: "[L-18a] HTTPS PATCH (Port 443 + Bearer JWT) /sessions/{id}/draft"
APIGateway > ExamIngestionHandler: "[L-05e] AWS Lambda Proxy Integration (SigV4)"
ExamIngestionHandler > SessionsTable: "[L-18b] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:UpdateItem (Atomic Sync)"

// --- NHÁNH 2: QUY TRÌNH D (HẾT GIỜ / BẤM NỘP BÀI QUA SQS) ---
Candidate > ExamRoomClient: "[Quy trình D] Hết giờ đếm ngược / Bấm Nộp bài"
ExamRoomClient > AntiBotShield: "HTTPS GET (Request Turnstile Token < 0.1s)"
AntiBotShield > ExamRoomClient: "cf-turnstile-response Token String"
ExamRoomClient > APIGateway: "[L-18c] HTTPS POST (application/json) /exam/submit"
APIGateway > ExamIngestionHandler: "[L-05f] AWS Lambda Proxy Integration (SigV4)"

// Đệm tải SQS & Chấm điểm tự động
ExamIngestionHandler > SubmissionQueue: "[L-19] HTTPS / AWS SDK Boto3 (SigV4) - Action: sqs:SendMessage (<50ms ACK)"
ExamIngestionHandler > ExamRoomClient: "HTTP 200 OK (Đã thu bài an toàn, chống sập mạng)"

SubmissionQueue > GradingWorker: "[L-20] AWS SQS-to-Lambda Event Source Mapping (BatchSize = 10)"
GradingWorker > QuestionsTable: "[L-21a] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:BatchGetItem (Correct Answers)"
GradingWorker > SessionsTable: "[L-21b] HTTPS / AWS SDK Boto3 (SigV4) - Action: dynamodb:UpdateItem (Score, COMPLETED)"

GradingWorker > DeadLetterQueue: "[L-22] SQS Redrive Policy (maxReceiveCount = 3 lỗi)"
DeadLetterQueue > DLQAlarm: "[L-25] CloudWatch Metric Alarm (ApproximateNumberOfMessagesVisible > 0)"
```

---

## IV. BẢNG ĐẶC TẢ LUỒNG GIAO TIẾP KIẾN TRÚC & GIAO THỨC CHUẨN (ARCHITECTURE INTERFACE & PROTOCOL REFERENCE TABLE)

Bảng này đối soát 1-1 toàn bộ các mã luồng `[L-01a]` đến `[L-25]` xuất hiện trên sơ đồ kiến trúc với thông số cổng, phương thức, cơ chế bảo mật và tài liệu kỹ thuật chính thức:

| Mã luồng | Thành phần Nguồn $\rightarrow$ Đích | Giao thức & Cổng (Protocol/Port) | Phương thức / API Action | Cơ chế Bảo mật / Xác thực | Tài liệu tham khảo chính thức |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **`[L-01a]`** | Users $\rightarrow$ Route 53 | DNS over UDP/TCP (Port 53) | Query DNS A/AAAA: `cloudexam.vn` | DNSSEC Validation | [AWS Route 53 Developer Guide](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/) |
| **`[L-01b]`** | Users $\rightarrow$ Route 53 | DNS over UDP/TCP (Port 53) | Query DNS A/AAAA: `edulao.la` | DNSSEC Validation | [AWS Route 53 Latency Routing](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-latency.html) |
| **`[L-01c]`** | Route 53 $\rightarrow$ CloudFront | HTTPS / TLS 1.3 (Port 443) | Anycast Edge Ingress | SSL/TLS ACM Certificate | [Amazon CloudFront Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/) |
| **`[L-02a]`** | CloudFront $\rightarrow$ CloudFront Functions | Internal AWS Edge Event | Viewer Request Event Hook | JavaScript Sub-millisecond Execution | [CloudFront Functions Concepts](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html) |
| **`[L-02b]`** | CloudFront Functions $\rightarrow$ CloudFront | Internal Edge Header Rewrite | `request.headers['x-tenant-id'] = {value: tenant}` | Edge Isolation | [CloudFront Header Manipulation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example-function-redirect-url.html) |
| **`[L-02c]`** | CloudFront $\rightarrow$ S3 Static Bucket | HTTPS / TLS 1.3 (Port 443) | S3 GetObject (Static Assets) | **Origin Access Control (OAC) / SigV4** | [Amazon S3 OAC Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) |
| **`[L-02d]`** | CloudFront $\rightarrow$ ThemedClient | HTTPS / TLS 1.3 (Port 443) | Phục vụ React SPA (HTML/JS/CSS) | Edge Caching & Gzip/Brotli Compression | [CloudFront Optimizing Content](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html) |
| **`[L-03]`** | Web Client $\leftrightarrow$ Cognito User Pool | HTTPS POST (Port 443) | OAuth 2.0 PKCE / Exchange Auth Code | Code Challenge (SHA-256) & Bearer JWT | [Cognito PKCE Flow Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-idp.html) |
| **`[L-04a]`** | Web Client $\rightarrow$ AWS WAFv2 | HTTPS REST (Port 443) | All API HTTP Requests | Bearer Access Token in Authorization Header | [AWS WAF Developer Guide](https://docs.aws.amazon.com/waf/latest/developerguide/) |
| **`[L-04b]`** | AWS WAFv2 $\rightarrow$ API Gateway | Internal Gateway Binding | Web ACL Evaluation & Rate Limiting | IP Rate Limiting (1,000 req/5min) & Anti-SQLi | [Associate WAF with API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access-aws-waf.html) |
| **`[L-04c]`** | API Gateway Authorizer | Internal Token Validation | Verify JWT Signature (RS256) & Claims | Amazon Cognito User Pool Authorizer | [API Gateway Cognito Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html) |
| **`[L-05]`** | API Gateway $\rightarrow$ Core Lambda | Internal AWS Service Bus | Lambda Proxy Integration | IAM Execution Role & AWS SigV4 | [API Gateway Lambda Proxy](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html) |
| **`[L-05a]`** | API Gateway $\rightarrow$ Presign Service | Internal AWS Service Bus | POST `/questions/presign` | Lambda Proxy Integration (SigV4) | [API Gateway Routing Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-settings-execution.html) |
| **`[L-05b]`** | API Gateway $\rightarrow$ AI Parser Lambda | Internal AWS Service Bus | POST `/questions/parse-doc` | Lambda Proxy Integration (SigV4) | [Lambda Execution Context](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html) |
| **`[L-05c]`** | API Gateway $\rightarrow$ Academic CRUD | Internal AWS Service Bus | REST CRUD (`/banks`, `/candidates`, `/sessions`)| Lambda Proxy Integration (SigV4) | [Lambda REST API Pattern](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html) |
| **`[L-05d]`** | API Gateway $\rightarrow$ Biometric Lambda | Internal AWS Service Bus | POST `/auth/face-verify` | Lambda Proxy Integration (SigV4) | [Lambda Asynchronous Invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html) |
| **`[L-05e]`** | API Gateway $\rightarrow$ Ingestion Lambda | Internal AWS Service Bus | PATCH `/sessions/{id}/draft` | Lambda Proxy Integration (SigV4) | [API Gateway Payload Handling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings.html) |
| **`[L-05f]`** | API Gateway $\rightarrow$ Ingestion Lambda | Internal AWS Service Bus | POST `/exam/submit` | Lambda Proxy Integration (SigV4) | [API Gateway Throttling Settings](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html) |
| **`[L-06]`** | Presign Service $\rightarrow$ S3 Bucket | HTTPS / AWS SDK Boto3 (Port 443) | Action: `s3:generate_presigned_url` | HMAC-SHA256 Presigned Signature (TTL: 300s) | [S3 Presigned URLs Upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html) |
| **`[L-07]`** | Web Client $\rightarrow$ S3 Bucket | Direct HTTPS PUT (Port 443) | Image Binary (Content-Type: image/jpeg, png) | Direct-to-Storage via S3 Presigned URL | [Direct S3 Upload Pattern](https://aws.amazon.com/blogs/compute/uploading-to-amazon-s3-directly-from-a-web-application/) |
| **`[L-08]`** | AI Parser Lambda $\rightarrow$ SSM Store | HTTPS / AWS SDK Boto3 (Port 443) | Action: `ssm:get_parameter` (`WithDecryption=True`)| AWS KMS Managed Key (`aws/ssm`) & IAM Role | [SSM Parameter Store Docs](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) |
| **`[L-09]`** | AI Parser Lambda $\rightarrow$ Google Gemini | REST over HTTPS (Port 443) | POST `/v1beta/models/gemini-1.5-flash:generateContent`| Header: `x-goog-api-key: <API_KEY>` | [Google Gemini REST API Reference](https://ai.google.dev/api/rest) |
| **`[L-10]`** | Google Gemini $\rightarrow$ AI Parser Lambda | HTTPS Response (Port 443) | HTTP 200 OK + JSON Array (MCQs) | JSON Schema Strict Enforcement | [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output) |
| **`[L-11a]`** | Academic CRUD $\rightarrow$ QuestionBanks | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:PutItem` | AWS SigV4 Auth over TLS 1.3 | [DynamoDB PutItem API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html) |
| **`[L-11b]`** | AI Parser Lambda $\rightarrow$ Questions | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:BatchWriteItem` | AWS SigV4 Auth over TLS 1.3 | [DynamoDB BatchWriteItem API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html) |
| **`[L-11c]`** | Academic CRUD $\rightarrow$ Candidates | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:BatchWriteItem` | AWS SigV4 Auth over TLS 1.3 | [DynamoDB Batch Operations](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.SDKs.Interfaces.Document-BatchWrite.html) |
| **`[L-11d]`** | Academic CRUD $\rightarrow$ Sessions | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:PutItem` (status: `SCHEDULED`)| AWS SigV4 Auth over TLS 1.3 | [DynamoDB Data Types & Items](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html) |
| **`[L-11e]`** | Academic CRUD $\rightarrow$ EventBridge | HTTPS / AWS SDK Boto3 (Port 443) | Action: `scheduler:CreateSchedule` | One-time schedule at `startTime` (SigV4) | [EventBridge Scheduler Guide](https://docs.aws.amazon.com/scheduler/latest/UserGuide/what-is-scheduler.html) |
| **`[L-11f]`** | EventBridge $\rightarrow$ Step Functions | Internal AWS Event Invocation | Action: `states:StartExecution` | IAM Execution Role (`scheduler.amazonaws.com`) | [EventBridge Scheduler Target](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-targets-step-functions.html) |
| **`[L-12]`** | Hardware Camera $\rightarrow$ Web Client | HTML5 Browser API | Video Stream $\rightarrow$ Canvas Base64 Frame | Client-side Sandboxed W3C MediaDevices | [W3C Media Capture Streams](https://www.w3.org/TR/mediacapture-streams/) |
| **`[L-13]`** | Web Client $\rightarrow$ API Gateway | HTTPS POST (Port 443) | Body: `{ sessionId, email, imageBase64 }` | Payload Size Limit < 10MB (API Gateway) | [API Gateway Limits & Quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html) |
| **`[L-13a]`** | Biometric Lambda $\rightarrow$ Sessions | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:GetItem` (Check `RUNNING`) | AWS SigV4 Auth over TLS 1.3 | [DynamoDB GetItem API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html) |
| **`[L-13b]`** | Biometric Lambda $\rightarrow$ Candidates | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:GetItem` (Query `StudentCodeIndex`)| AWS SigV4 Auth over TLS 1.3 | [DynamoDB Global Secondary Indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html) |
| **`[L-14]`** | Biometric Lambda $\rightarrow$ S3 Face Vault | HTTPS / AWS SDK Boto3 (Port 443) | Action: `s3:GetObject` (`faces/{MSSV}.jpg`) | IAM Least-Privilege Read Role & SigV4 | [Amazon S3 GetObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html) |
| **`[L-15]`** | Biometric Lambda $\rightarrow$ Rekognition | HTTPS / AWS SDK Boto3 (Port 443) | Action: `rekognition:CompareFaces` | `SimilarityThreshold = 80.0%`, SigV4 | [Amazon Rekognition CompareFaces](https://docs.aws.amazon.com/rekognition/latest/dg/faces-comparefaces.html) |
| **`[L-16]`** | Biometric Lambda $\rightarrow$ Sessions | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:UpdateItem` (`CHECKED_IN`) | Atomic Attribute Updates & SigV4 | [DynamoDB UpdateItem API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) |
| **`[L-17]`** | Biometric Lambda $\rightarrow$ SNS Topic | HTTPS / AWS SDK Boto3 (Port 443) | Action: `sns:Publish` (Proctor Security Alert) | IAM SNS Publish Policy & SigV4 | [Amazon SNS Publish API](https://docs.aws.amazon.com/sns/latest/api/API_Publish.html) |
| **`[L-18a]`** | Web Client $\rightarrow$ API Gateway | HTTPS PATCH (Port 443) | Path: `/sessions/{id}/draft`, Body: answers | Bearer JWT Token in Authorization Header | [HTTP PATCH Method RFC 5789](https://datatracker.ietf.org/doc/html/rfc5789) |
| **`[L-18b]`** | Ingestion Lambda $\rightarrow$ Sessions | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:UpdateItem` (Atomic Sync) | Atomic Attribute Set (`draftAnswers`) | [DynamoDB Atomic Counters & Sets](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html#WorkingWithItems.AtomicCounters) |
| **`[L-18c]`** | Web Client $\rightarrow$ API Gateway | HTTPS POST (Port 443) | Path: `/exam/submit`, Body: answers + turnstile | Cloudflare Turnstile Verification Token | [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/) |
| **`[L-19]`** | Ingestion Lambda $\rightarrow$ SQS Buffer | HTTPS / AWS SDK Boto3 (Port 443) | Action: `sqs:SendMessage` (ACK < 50ms) | Server-Side Encryption (SSE-SQS) & SigV4 | [Amazon SQS SendMessage API](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html) |
| **`[L-20]`** | SQS Buffer $\rightarrow$ Grading Worker | AWS Event Source Mapping | Polling Batch Messages from Standard Queue | BatchSize: 10, Concurrency Limit: 5 | [Lambda with SQS Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html) |
| **`[L-21a]`** | Grading Worker $\rightarrow$ Questions | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:BatchGetItem` (Keys list) | Internal AWS Backbone & SigV4 Auth | [DynamoDB BatchGetItem API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) |
| **`[L-21b]`** | Grading Worker $\rightarrow$ Sessions | HTTPS / AWS SDK Boto3 (Port 443) | Action: `dynamodb:UpdateItem` (`COMPLETED`) | Atomic Write & Optimistic Locking | [DynamoDB Conditional Writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html#WorkingWithItems.ConditionalUpdate) |
| **`[L-22]`** | SQS Buffer $\rightarrow$ Dead-Letter Queue | SQS Redrive Policy | Automatic Message Redrive after 3 retries | `maxReceiveCount = 3` DLQ Target ARN | [Amazon SQS Dead-Letter Queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) |
| **`[L-23]`** | Step Functions $\rightarrow$ Sessions | Internal AWS SDK Task | Action: `dynamodb:updateItem` | State Machine IAM Execution Role | [AWS Step Functions DynamoDB Task](https://docs.aws.amazon.com/step-functions/latest/dg/connect-dynamodb.html) |
| **`[L-24]`** | Step Functions $\rightarrow$ SNS Topic | Internal AWS SDK Task | Action: `sns:publish` (Email Report) | State Machine IAM Execution Role | [AWS Step Functions SNS Task](https://docs.aws.amazon.com/step-functions/latest/dg/connect-sns.html) |
| **`[L-25]`** | Dead-Letter Queue $\rightarrow$ CloudWatch | Internal CloudWatch Metric Monitor | Metric: `ApproximateNumberOfMessagesVisible > 0` | Metric Alarm Evaluation: 1 Minute Period | [CloudWatch Alarms for SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/monitoring-using-cloudwatch.html) |
