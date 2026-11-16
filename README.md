# CloudExam — Nền tảng Khảo thí Trực tuyến Serverless, AI & Multi-Cloud

[![Live Production](https://img.shields.io/badge/Production-https%3A%2F%2Fcloudexam.id.vn-success?logo=google-chrome)](https://cloudexam.id.vn)
[![AWS Serverless](https://img.shields.io/badge/AWS-Serverless_Architecture-orange?logo=amazon-aws)](https://aws.amazon.com/)
[![Terraform v1.8+](https://img.shields.io/badge/IaC-Terraform_v1.8+-purple?logo=terraform)](https://www.terraform.io/)
[![Python 3.12 / arm64](https://img.shields.io/badge/Runtime-Python_3.12_arm64-blue?logo=python)](https://aws.amazon.com/ec2/graviton/)
[![React 19 + Vite](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB?logo=react)](https://vitejs.dev/)
[![Multi-Cloud](https://img.shields.io/badge/Multi--Cloud-Gemini_%7C_Turnstile_%7C_Upstash-green)](https://cloud.google.com/)
[![FinOps 0 USD](https://img.shields.io/badge/FinOps-$0.00_Free_Tier-success)](docs/finops_report.md)

> **Dự án môn học:** Điện toán đám mây (Cloud Computing — INT3319 1), lớp 2627I_INT3319_1, học kỳ I năm học 2026–2027
> **Đơn vị:** Nhóm 14 — Khoa Công nghệ Thông tin, Trường Đại học Công nghệ, ĐHQGHN (VNU-UET)
> **Giảng viên hướng dẫn:** TS. Hoàng Xuân Tùng
> **Tên miền hệ thống:** [https://cloudexam.id.vn](https://cloudexam.id.vn)
> **Khu vực triển khai:** AWS Asia Pacific (Singapore) `ap-southeast-1`

**Liên kết nhanh:**
[Ứng dụng trực tiếp](https://cloudexam.id.vn) ·
[Slide thuyết trình (Canva)](https://www.canva.com/design/DAHa6Jyltt8/KM0Zizd_0s8KiLjZhV7I8A/edit) ·
[Video thuyết minh slide](https://www.youtube.com/watch?v=bIGDnOnkjZc) ·
[Video demo vận hành toàn trình](https://www.youtube.com/watch?v=UMXmyUHUJRo) ·
[Báo cáo tổng kết](docs/report/REPORT.md)

---

## MỤC LỤC

1. [Giới thiệu dự án](#1-giới-thiệu-dự-án)
2. [Kiến trúc hệ thống & đặc tả kỹ thuật](#2-kiến-trúc-hệ-thống--đặc-tả-kỹ-thuật)
   - [2.1. Mô hình Hạt nhân & Vệ tinh đa đám mây](#21-mô-hình-hạt-nhân--vệ-tinh-đa-đám-mây)
   - [2.2. Phân quyền 3 cổng độc lập (RBAC)](#22-phân-quyền-3-cổng-độc-lập-rbac)
   - [2.3. Cụm vi dịch vụ AWS Lambda (Graviton2 arm64)](#23-cụm-vi-dịch-vụ-aws-lambda-graviton2-arm64)
   - [2.4. Tầng lưu trữ DynamoDB (5 bảng On-Demand)](#24-tầng-lưu-trữ-dynamodb-5-bảng-on-demand)
   - [2.5. Vòng đời ca thi tự động (Step Functions & SNS)](#25-vòng-đời-ca-thi-tự-động-step-functions--sns)
   - [2.6. Sơ đồ tuần tự các quy trình nghiệp vụ cốt lõi](#26-sơ-đồ-tuần-tự-các-quy-trình-nghiệp-vụ-cốt-lõi)
   - [2.7. Đa quốc gia & đa thuê bao (i18n 4 ngôn ngữ)](#27-đa-quốc-gia--đa-thuê-bao-i18n-4-ngôn-ngữ)
3. [Cấu trúc thư mục dự án](#3-cấu-trúc-thư-mục-dự-án)
4. [Hướng dẫn cài đặt & triển khai](#4-hướng-dẫn-cài-đặt--triển-khai)
5. [Kiểm thử & kết quả thực nghiệm](#5-kiểm-thử--kết-quả-thực-nghiệm)
6. [Quản trị chi phí (FinOps)](#6-quản-trị-chi-phí-finops)
7. [Thành viên nhóm & phân công nhiệm vụ](#7-thành-viên-nhóm--phân-công-nhiệm-vụ)
8. [Tài liệu kỹ thuật tham khảo](#8-tài-liệu-kỹ-thuật-tham-khảo)

---

## 1. GIỚI THIỆU DỰ ÁN

**CloudExam** là nền tảng khảo thí trực tuyến thế hệ mới theo triết lý **Serverless hướng sự kiện (Event-Driven Architecture)** và **Điện toán đa đám mây (Multi-Cloud)**, giải quyết 5 thách thức lớn nhất của hệ thống thi cử truyền thống:

1. **Chống sập do bão nộp bài giây cuối (Submission Stampede):** hàng trăm thí sinh đồng loạt nộp bài vào giây cuối ca thi. CloudExam dùng mẫu **Queue-Based Load Leveling** với **Amazon SQS + Dead Letter Queue**: API xác nhận tức thì (< 50 ms, đo thực tế P99 = 35.96 ms với 500 thí sinh đồng thời), ghi nhận trạng thái `QUEUED` ngay lập tức để thí sinh không thể nộp lại hay làm lại bài, rồi chấm điểm ngầm theo lô (Batch 10).
2. **Chống thi hộ bằng sinh trắc học AI & khóa thiết bị:** **Amazon Rekognition CompareFaces** đối soát khuôn mặt chụp từ webcam với ảnh thẻ gốc trên **S3** (ngưỡng tương đồng ≥ 80%, đo thực tế FAR = 0%, FRR = 0%), kèm `deviceFingerprint` khóa cứng thiết bị để chặn đăng nhập máy thứ hai.
3. **Số hóa đề thi bằng AI tạo sinh & dự phòng cục bộ:** **Google Gemini Flash** bóc tách đề Word `.docx` hoặc văn bản thô thành câu hỏi JSON chuẩn hóa; khi AI lỗi/hết hạn ngạch, **bộ phân tích Regex NLP chạy cục bộ** đảm bảo không gián đoạn. Hỗ trợ cả trắc nghiệm và tự luận.
4. **Phòng thi Local-First & bảng xếp hạng thời gian thực:** đáp án ghi tức thì vào `localStorage` (0 ms), đồng bộ nền điều tiết **60 giây hoặc 10 thay đổi** giúp giảm ~90% tải ghi DynamoDB và bảo toàn bài làm khi rớt mạng/F5. Điểm số cập nhật lên **Upstash Serverless Redis** (ZADD/ZREVRANGE, < 5 ms).
5. **Chi phí $0.00 giai đoạn phát triển (Zero-Cost FinOps):** vận hành trong **AWS Free Tier** và các gói miễn phí của vệ tinh đa đám mây, kiểm soát bằng **AWS Budgets** (ngưỡng $0.50) và CloudWatch Alarms; đối soát thực tế **$0.00 trên AWS Cost Explorer (tháng 11/2026)**. Ước tính quy mô production 5.000 thí sinh chỉ ~$17.58/tháng (~88 VNĐ/thí sinh).

---

## 2. KIẾN TRÚC HỆ THỐNG & ĐẶC TẢ KỸ THUẬT

### 2.1. Mô hình Hạt nhân & Vệ tinh đa đám mây

**AWS Core Backbone** đảm nhiệm lưu trữ, định danh và tính toán; các **Multi-Cloud Satellites** cung cấp AI tạo sinh, bộ đệm siêu tốc và khiên chống bot miễn phí:

```
                              [ CLIENT & MULTI-CLOUD INGRESS ]
                     Thí sinh · Giám thị · Giảng viên (React 19 SPA)
                     Local-First Engine · S3 Direct Upload · Turnstile
                                          │
                          Route 53 → CloudFront (OAC + Edge Function
                          phân giải tenant theo tên miền quốc gia)
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 ▼                        ▼                        ▼
      [ CLOUDFLARE SATELLITE ]   [ AWS CORE GATEWAY ]    [ GOOGLE AI SATELLITE ]
      Cloudflare Turnstile       API Gateway REST        Google Gemini Flash
      (chống bot nộp bài,        + Cognito JWT (RS256)   (bóc tách đề DOCX,
       miễn phí không giới hạn)  + WAFv2 (tùy chọn)       trợ lý giải thích đáp án)
                 │                        │                        │
                 └────────────────────────┼────────────────────────┘
                                          ▼
                            [ SERVERLESS COMPUTE — Python 3.12 arm64 ]
                     ┌──────────────────────────────────────────────────┐
                     │ api_handler.py        — Core API, RBAC, submit   │
                     │ face_verify_handler.py— Điểm danh Rekognition 1:1│
                     │ grading_worker.py     — Chấm bài theo lô từ SQS  │
                     └──────────────────────────┬───────────────────────┘
                                                │
             ┌──────────────────────┬───────────┴──────────┬─────────────────────┐
             ▼                      ▼                      ▼                     ▼
     [ SQS + DLQ ]          [ DYNAMODB ]           [ UPSTASH REDIS ]     [ STEP FUNCTIONS ]
     Batch 10 / 2s          5 bảng On-Demand       Leaderboard < 5ms     Wait → Auto-Finalize
     maxReceiveCount 3      Sparse GSI             ZADD/ZREVRANGE        → SNS báo cáo điểm
```

### 2.2. Phân quyền 3 cổng độc lập (RBAC)

| Cổng | Nhóm Cognito | Giao diện | Nghiệp vụ chính |
| :--- | :--- | :--- | :--- |
| **Giảng viên** | `Organizer` (kèm `Admin`) | Bàn giảng viên & quản trị | CRUD ngân hàng đề, nạp đề Word bằng AI; quản lý hồ sơ thí sinh + ảnh thẻ S3; tạo ca thi, đặt mật khẩu phòng, phân công giám thị (`proctorEmails`), gán thí sinh (`candidateEmails`); xem bảng điểm, phổ điểm, xuất CSV; xem trước đề thi. |
| **Giám thị** | `Proctor` | `LiveProctorDashboard.tsx` | Giám sát trạng thái thí sinh ca thi phụ trách; mở khóa thiết bị (`lockedCandidates`); cập nhật mật khẩu phòng khi có sự cố; gửi báo cáo kết quả qua SNS. |
| **Thí sinh** | `Candidate` | `CandidateRoomLogin.tsx` + `ExamRoom.tsx` | Vào phòng tại `https://cloudexam.id.vn/?exam=<sessionId>` bằng email + mật khẩu phòng thi; điểm danh khuôn mặt qua webcam; làm bài Local-First; nộp bài qua Turnstile + SQS; sau khi nộp chỉ xem kết quả, không làm lại được. |

Xác thực người dùng quản trị/giám thị qua **Cognito OAuth 2.0 PKCE / Hosted UI** (JWT RS256 kiểm tra tại API Gateway). Thí sinh vào phòng bằng mật khẩu ca thi do giảng viên cấp, kèm kiểm tra danh sách `candidateEmails` và khóa thiết bị.

### 2.3. Cụm vi dịch vụ AWS Lambda (Graviton2 arm64)

Runtime **Python 3.12** trên kiến trúc **arm64 (Graviton2)** — hiệu năng/chi phí tốt hơn ~20% so với x86:

| Vi dịch vụ | Hàm Lambda | Mã nguồn | Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **Core API** | `cloudexam-core-api-dev` | [`backend/lambda/api_handler.py`](backend/lambda/api_handler.py) | CRUD ngân hàng câu hỏi, câu hỏi, thí sinh, ca thi; cấp S3 Presigned URL (SigV4); bóc tách DOCX bằng Gemini Flash (chuỗi dự phòng đa phiên bản model) hoặc Regex NLP cục bộ; cấp đề thi (`GET /sessions/{id}/exam-paper`) **đã loại bỏ đáp án đúng chống F12**; lưu nháp throttled; xác thực Turnstile + nộp bài qua SQS (`POST /exam/submit`); leaderboard Redis; trợ lý AI giải thích đáp án (`POST /exam/explain-answers`); gửi báo cáo qua SNS `cloudexam-alerts-dev`. |
| **Face Verifier** | `cloudexam-face-verify-dev` | [`backend/lambda/face_verify_handler.py`](backend/lambda/face_verify_handler.py) | Kiểm tra ca thi `RUNNING` + thí sinh hợp lệ; nhận ảnh webcam qua S3 presigned (`temp-faces/`, xóa tự động); tải ảnh thẻ gốc `faces/{studentCode}.jpg`; Rekognition `compare_faces` ngưỡng ≥ 80%; ghi `deviceFingerprint` vào `lockedCandidates`; trả thông tin thí sinh kèm ảnh hồ sơ đối chiếu. |
| **Grading Worker** | `cloudexam-grading-worker-dev` | [`backend/lambda/grading_worker.py`](backend/lambda/grading_worker.py) | Tiêu thụ SQS (BatchSize 10, BatchingWindow 2s); lấy đáp án gốc bằng `BatchGetItem`; chấm điểm và ghi kép vào `CloudExam_Submissions_dev` + `CloudExam_Sessions_dev` (trạng thái `COMPLETED`); đẩy điểm lên Upstash Redis (ZADD); message lỗi chuyển DLQ sau 3 lần thử (`maxReceiveCount = 3`). |

**Cơ chế nộp bài chống mất bài & chống làm lại:**

- `POST /exam/submit` xác thực Turnstile, **ghi ngay bản ghi `QUEUED` vào `session.submissions`** rồi đẩy vào SQS — thí sinh nhận phản hồi < 50 ms và được ghi nhận là đã nộp kể cả khi worker chưa chấm xong.
- Nháp của thí sinh (cloud `draftSubmissions` + `localStorage`) bị xóa ngay sau khi nộp; mọi lần nộp lại trả về `alreadySubmitted: true`.
- F5 hoặc vào lại phòng sau khi nộp → vào thẳng màn kết quả; nếu còn `QUEUED`, giao diện hiển thị "đang chấm" và tự cập nhật điểm khi worker hoàn tất (poll 2 giây/lần).
- Thí sinh rớt mạng không kịp nộp: Step Functions tự chấm bù bài nháp khi đóng ca (trạng thái `AUTO_FINALIZED`).

### 2.4. Tầng lưu trữ DynamoDB (5 bảng On-Demand)

Chế độ **PAY_PER_REQUEST** ($0 khi nhàn rỗi), tự mở rộng theo tải:

| Bảng (env `dev`) | Partition Key | GSI |
| :--- | :--- | :--- |
| `CloudExam_QuestionBanks_dev` | `id` | — |
| `CloudExam_Questions_dev` | `id` | `BankIdIndex` (bankId) |
| `CloudExam_Candidates_dev` | `email` | `StudentCodeIndex` (studentCode) |
| `CloudExam_Sessions_dev` | `id` | — |
| `CloudExam_Submissions_dev` | `id` | `SessionResultsIndex` (PK sessionId, SK score) — sparse GSI |

Các thuộc tính nghiệp vụ trên `CloudExam_Sessions_dev`:

- `status`: `SCHEDULED` → `RUNNING` → `CLOSED` (Step Functions tự chuyển theo giờ).
- `roomPassword`, `candidateEmails`, `proctorEmails`: mật khẩu phòng, danh sách thí sinh và giám thị.
- `lockedCandidates`: map `{ email: { deviceFingerprint/deviceToken, lockedAt } }` khóa thiết bị.
- `draftSubmissions`: map bài nháp theo email (đồng bộ throttled, dùng cho Auto-Finalize).
- `submissions`: map kết quả theo email — `QUEUED` ngay khi nộp, `COMPLETED` khi chấm xong, `AUTO_FINALIZED` khi chấm bù.

Thiết kế khóa phân vùng sharded và sparse GSI chi tiết: [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md).

### 2.5. Vòng đời ca thi tự động (Step Functions & SNS)

Máy trạng thái `cloudexam-exam-lifecycle-v2-dev` tự động hóa toàn bộ chu trình ca thi:

1. **Chờ theo lịch (`Wait` state):** ngủ đến mốc mở/đóng ca, không tốn compute ($0).
2. **Mở ca:** đến giờ bắt đầu chuyển `SCHEDULED` → `RUNNING`.
3. **Đóng ca & chấm bù (`AutoFinalizeTask`):** đến `endTime` chuyển sang `CLOSED`, quét `draftSubmissions` của thí sinh chưa nộp để chấm bù (`AUTO_FINALIZED`), bảo toàn bài làm trước sự cố rớt mạng phút chót.
4. **Báo cáo (`PublishReportTask`):** tổng hợp phổ điểm (cao nhất, trung bình, số bài) và gửi email qua **SNS topic `cloudexam-alerts-dev`** tới giảng viên/giám thị (subscription `report_email`, cần xác nhận qua email). Topic này đồng thời nhận cảnh báo CloudWatch Alarms và AWS Budgets.

### 2.6. Sơ đồ tuần tự các quy trình nghiệp vụ cốt lõi

```mermaid
sequenceDiagram
    autonumber
    actor C as Thí sinh / Giảng viên / Giám thị
    participant FE as CloudExam SPA
    participant APIGW as API Gateway REST
    participant Core as Lambda api_handler
    participant Face as Lambda face_verify_handler
    participant S3 as S3 Media Bucket
    participant SQS as SQS + DLQ
    participant Worker as Lambda grading_worker
    participant DDB as DynamoDB (5 bảng)
    participant Redis as Upstash Redis
    participant SFN as Step Functions lifecycle v2
    participant SNS as SNS cloudexam-alerts-dev

    Note over C,SNS: A. SỐ HÓA ĐỀ THI BẰNG AI / REGEX FALLBACK
    C->>FE: Tải đề Word (.docx) hoặc dán văn bản
    FE->>APIGW: POST /questions/parse-doc
    APIGW->>Core: Gemini Flash (dự phòng đa model) hoặc Regex NLP cục bộ
    Core-->>FE: Danh sách câu hỏi JSON chuẩn hóa
    FE->>S3: PUT ảnh minh họa qua Presigned URL (Direct-to-Storage)

    Note over C,SNS: B. ĐIỂM DANH SINH TRẮC HỌC & KHÓA THIẾT BỊ
    C->>FE: Bật webcam chụp khuôn mặt
    FE->>S3: Upload ảnh chụp lên temp-faces/ (presigned)
    FE->>APIGW: POST /auth/face-verify (capturedS3Key + deviceFingerprint)
    APIGW->>Face: Kiểm tra ca RUNNING + thí sinh hợp lệ
    Face->>S3: Tải ảnh thẻ gốc faces/{studentCode}.jpg
    Face->>Face: Rekognition CompareFaces (>= 80%)
    Face->>DDB: Ghi deviceFingerprint vào lockedCandidates
    Face-->>FE: Vào phòng thi + ảnh hồ sơ đối chiếu

    Note over C,SNS: C. PHÒNG THI LOCAL-FIRST & NỘP BÀI SQS
    loop Làm bài (0ms lag)
        C->>FE: Chọn đáp án
        FE->>FE: Ghi tức thì localStorage (F5/offline khôi phục nguyên vẹn)
        FE->>APIGW: Đồng bộ nháp throttled (60s hoặc 10 thay đổi)
    end
    C->>FE: Nhấn Nộp bài (kèm Turnstile token)
    FE->>APIGW: POST /exam/submit
    APIGW->>Core: Xác thực Turnstile
    Core->>DDB: Ghi ngay submissions[email] = QUEUED + xóa nháp
    Core->>SQS: SendMessage
    Core-->>FE: 200 OK (< 50ms) — nộp lại bị chặn (alreadySubmitted)
    FE->>FE: Màn kết quả "đang chấm", poll 2s/lần
    SQS->>Worker: Batch 10 (window 2s)
    Worker->>DDB: BatchGetItem đáp án gốc, chấm điểm
    Worker->>DDB: Ghi COMPLETED vào Submissions + Sessions
    Worker->>Redis: ZADD leaderboard
    FE->>APIGW: GET /sessions/{id}/leaderboard
    Core-->>FE: Bảng xếp hạng thời gian thực (< 5ms)

    Note over C,SNS: D. VÒNG ĐỜI CA THI TỰ ĐỘNG
    SFN->>SFN: Wait đến giờ mở/đóng ca ($0 compute)
    SFN->>DDB: RUNNING khi mở; CLOSED + chấm bù nháp (AUTO_FINALIZED) khi đóng
    SFN->>SNS: Báo cáo phổ điểm (PublishReportTask)
    SNS-->>C: Email kết quả tới Giảng viên & Giám thị
```

### 2.7. Đa quốc gia & đa thuê bao (i18n 4 ngôn ngữ)

- **Tên miền quốc gia** (Route 53 + CloudFront, cùng một hạ tầng): `cloudexam.id.vn` (mặc định), `vn.cloudexam.id.vn`, `lao.cloudexam.id.vn`, `de.cloudexam.id.vn`, `en.cloudexam.id.vn`.
- **Phân giải tenant tại biên:** CloudFront Function `cloudexam-tenant-resolver-dev` đọc Host và tiêm header `x-tenant-id` (`vn`/`la`/`de`/`default`); frontend [`domainService.ts`](frontend/src/services/domainService.ts) nhận diện tên miền để chọn ngôn ngữ + thương hiệu.
- **4 ngôn ngữ:** Việt (`vi`), Anh (`en`), Lào (`la`), Đức (`de`) — bộ từ điển tại `frontend/src/locales/`.
- **Theme theo quốc gia:** [`vn.ts`](frontend/src/themes/vn.ts) (đỏ), [`la.ts`](frontend/src/themes/la.ts) (xanh Champa), [`de.ts`](frontend/src/themes/de.ts), [`default.ts`](frontend/src/themes/default.ts), quản lý qua [`themeContext.tsx`](frontend/src/themes/themeContext.tsx).
- **Dữ liệu đa thuê bao:** thiết kế khóa sharded tiền tố `TENANT#<ISO>#...` (minh họa trong [`seed_multitenant.py`](backend/data/seed_multitenant.py)), dùng chung 5 bảng thay vì nhân bản database.

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
ExamInTheCloud/
├── backend/
│   ├── lambda/                          # 3 vi dịch vụ Python 3.12 / arm64
│   │   ├── api_handler.py               # Core API, RBAC, Gemini + Regex fallback, submit SQS
│   │   ├── face_verify_handler.py       # Điểm danh Rekognition 1:1 & khóa thiết bị
│   │   └── grading_worker.py            # Chấm bài theo lô từ SQS, ghi Redis leaderboard
│   ├── terraform/                       # IaC — toàn bộ hạ tầng AWS
│   │   ├── provider.tf / variables.tf   # Provider ap-southeast-1, remote state S3 + lock
│   │   ├── terraform.tfvars.example     # Mẫu biến cấu hình (khóa vệ tinh đa đám mây)
│   │   ├── api_gateway.tf               # REST API, routes, Cognito authorizer, CORS
│   │   ├── cognito.tf                   # User Pool, App Client PKCE, 4 nhóm RBAC
│   │   ├── dynamodb.tf                  # 5 bảng On-Demand + GSI
│   │   ├── lambda.tf                    # 3 hàm Lambda Graviton2 arm64 + SQS mapping
│   │   ├── iam.tf                       # IAM roles least-privilege
│   │   ├── s3.tf                        # Web bucket (OAC) + media bucket, lifecycle
│   │   ├── sqs.tf                       # Submission queue + DLQ (maxReceiveCount 3)
│   │   ├── step_functions.tf            # Máy trạng thái vòng đời ca thi v2
│   │   ├── cloudfront.tf                # CDN OAC + Edge Function phân giải tenant
│   │   ├── route53.tf                   # DNS cloudexam.id.vn + subdomains, ACM
│   │   ├── waf.tf                       # WAFv2 Web ACL 5 quy tắc (bật/tắt qua enable_waf)
│   │   ├── vpc.tf                       # Khung VPC tùy chọn (mặc định không dùng)
│   │   ├── cloudwatch.tf                # Log groups, alarms, SNS topic alerts
│   │   ├── budgets.tf                   # AWS Budgets $0.50 + cảnh báo
│   │   ├── frontend_env.tf / outputs.tf # Sinh cấu hình frontend & outputs
│   ├── data/                            # Seed data & script quản trị
│   │   ├── seed_dynamodb.py             # Nạp ngân hàng đề, câu hỏi, thí sinh, ca thi
│   │   ├── seed_cognito.py              # Tạo tài khoản + gán nhóm RBAC
│   │   ├── upload_sample_faces.py       # Đồng bộ ảnh thẻ lên S3 faces/
│   │   ├── seed_all.py                  # Chạy toàn bộ seed một lượt
│   │   ├── seed_multitenant.py          # Seed minh họa khóa TENANT# đa thuê bao
│   │   ├── question_banks_seed.json / questions_seed.json
│   │   ├── candidates_seed.json / sessions_seed.json / multitenant_seed.json
│   │   ├── sample_faces/                # Ảnh chân dung mẫu
│   │   └── sample_exam_ses101.docx      # Đề Word mẫu để thử bóc tách AI
├── frontend/                            # React 19 + Vite + Tailwind CSS v4 SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── CandidateRoomLogin.tsx   # Cổng phòng thi: email + mật khẩu ca
│   │   │   ├── ExamRoom.tsx             # Phòng thi Local-First, webcam, nộp bài, kết quả
│   │   │   ├── LiveProctorDashboard.tsx # Bàn giám thị: mở khóa máy, gửi báo cáo SNS
│   │   │   ├── ExamSessionTab.tsx       # Quản lý ca thi, link thi, leaderboard
│   │   │   ├── QuestionBankTab.tsx      # Ngân hàng câu hỏi + nạp Word DOCX bằng AI
│   │   │   ├── CandidatesTab.tsx        # Hồ sơ thí sinh & ảnh thẻ
│   │   │   ├── SessionResultsModal.tsx  # Bảng điểm, phổ điểm, xuất CSV UTF-8 BOM
│   │   │   ├── LiveLeaderboard.tsx      # Bảng xếp hạng Upstash Redis
│   │   │   ├── TurnstileCaptcha.tsx     # Widget Cloudflare Turnstile
│   │   │   └── Callback.tsx             # OAuth2 Authorization Code PKCE callback
│   │   ├── services/
│   │   │   ├── apiService.ts            # Client API Gateway (dual-mode mock/real, retry)
│   │   │   ├── auth.ts                  # Phiên Cognito PKCE & phân vai
│   │   │   ├── domainService.ts         # Nhận diện tên miền quốc gia → ngôn ngữ/theme
│   │   │   └── s3Service.ts             # Upload ảnh trực tiếp lên S3 (presigned)
│   │   ├── locales/                     # Từ điển vi / en / la / de
│   │   └── themes/                      # vn / la / de / default + themeContext.tsx
│   ├── .env.example                     # Mẫu biến môi trường (copy thành .env.local)
│   └── vite.config.ts
├── docs/                                # Hồ sơ kỹ thuật & minh chứng nghiệm thu
│   ├── report/                          # REPORT.md + README.md + 27 hình minh chứng
│   ├── evidence/                        # Ảnh console, báo cáo Locust/FAR-FRR/WAF-SQS,
│   │                                    # ảnh hình 3.1/3.4/3.6/3.8/3.9/3.10 trong báo cáo
│   ├── demo/                            # Kịch bản quay demo & video
│   ├── *.eraser                         # Sơ đồ kiến trúc nguồn (eraser.io)
│   ├── finops_report.md                 # Báo cáo chi phí $0.00 Free Tier
│   ├── SECURITY_AUDIT_REPORT.md         # Rà soát an ninh Zero-Trust
│   ├── SUBMISSION_STAMPEDE_REPORT.md    # Báo cáo tải nộp bài 500 VUs
│   ├── DATABASE_DESIGN.md               # Thiết kế DynamoDB 5 bảng & sparse GSI
│   ├── S3_STORAGE_DESIGN.md             # Phân vùng S3 & lifecycle
│   └── COGNITO_IAM_APIGATEWAY_GUIDE.md  # Cognito PKCE, IAM & API Gateway
├── scripts/
│   ├── deploy_frontend.py               # Build React → sync S3 → invalidate CloudFront
│   ├── setup_domain.py                  # Cấu hình tên miền & subdomains
│   ├── generate_sqs_traffic.py          # Sinh lưu lượng nộp bài kiểm thử
│   └── seed_cloud_data.py               # Nạp dữ liệu đồng bộ lên AWS
├── tests/                               # Bộ kiểm thử tự động
│   ├── locustfile.py                    # Tải 500 VUs nộp bài dồn dập (P99 = 35.96ms)
│   ├── rekognition_accuracy_test.py     # FAR/FRR theo ISO/IEC 19795 (100 lượt đối soát)
│   ├── multi_cloud_test.py              # Tích hợp đa đám mây — 18/18 PASS
│   ├── test_face_verify.py              # Unit test điểm danh khuôn mặt — 14/14 PASS
│   ├── test_gemini_features.py          # Kiểm thử tính năng Gemini & fallback
│   └── waf_sqs_test.py                  # WAF rate limit (AT12) & DLQ (AT09), xung tải AT08
└── .github/workflows/deploy.yml         # CI/CD GitHub Actions qua AWS OIDC
```

---

## 4. HƯỚNG DẪN CÀI ĐẶT & TRIỂN KHAI

### 4.1. Yêu cầu tiên quyết

- **Node.js** 20 LTS trở lên, **Python** 3.12, **Terraform** v1.8+, **AWS CLI v2**.
- AWS CLI cấu hình quyền triển khai tại `ap-southeast-1`:

```bash
aws configure   # Access Key / Secret Key / region ap-southeast-1 / output json
```

### 4.2. Bước 1 — Triển khai hạ tầng bằng Terraform

```bash
cd backend/terraform
cp terraform.tfvars.example terraform.tfvars   # điền khóa Gemini, Upstash, Turnstile...

terraform init
terraform validate
terraform plan -out=tfplan.binary
terraform apply tfplan.binary
```

Các biến đáng chú ý trong `terraform.tfvars`: `environment`, `aws_region`, `custom_domain_name` (`cloudexam.id.vn`), `gemini_api_key`, `upstash_redis_rest_url`/`token`, `cloudflare_turnstile_secret_key`, `report_email` (nhận báo cáo điểm qua SNS), `budget_limit_amount` (`0.50`), `enable_waf` (`false` ở dev để giữ $0 — bật khi cần kiểm thử an ninh).

Kết quả: 5 bảng DynamoDB, 2 S3 bucket, 3 Lambda, SQS + DLQ, Step Functions, Cognito, API Gateway, CloudFront + Route 53, CloudWatch Alarms + SNS + Budgets.

### 4.3. Bước 2 — Nạp dữ liệu mẫu

```bash
python backend/data/seed_dynamodb.py        # ngân hàng đề, câu hỏi, thí sinh, ca thi
python backend/data/upload_sample_faces.py  # ảnh thẻ lên S3 faces/{studentCode}.jpg
python backend/data/seed_cognito.py         # tài khoản + nhóm RBAC (mật khẩu mặc định 12345678)
# hoặc chạy một lượt:
python backend/data/seed_all.py
```

### 4.4. Bước 3 — Chạy frontend & tài khoản kiểm thử

```bash
cd frontend
npm install
cp .env.example .env.local   # điền giá trị từ terraform output
npm run dev                  # http://localhost:5173
```

Các biến chính trong `.env.local` (lấy từ `terraform output`): `VITE_API_BASE_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_IDENTITY_POOL_ID`, `VITE_S3_BUCKET_NAME`, `VITE_TURNSTILE_SITE_KEY`, `VITE_USE_MOCK=false`.

**Tài khoản kiểm thử mặc định** (mật khẩu Cognito `12345678`):

| Vai trò | Email |
| :--- | :--- |
| Giảng viên / Admin | `annv@uet.vnu.edu.vn` hoặc `tranducmanh2006@gmail.com` |
| Giám thị | `laladoraema@gmail.com` |
| Thí sinh | `duc.tm24@vnu.edu.vn` (xem thêm `candidates_seed.json`) |

Thí sinh vào phòng thi tại `https://cloudexam.id.vn/?exam=<sessionId>` bằng email + **mật khẩu phòng thi** do giảng viên đặt khi tạo ca (không dùng mật khẩu Cognito).

### 4.5. Bước 4 — Triển khai production & CI/CD

```bash
python scripts/deploy_frontend.py   # build Vite → sync S3 web bucket → invalidate CloudFront
```

Ứng dụng phân phối qua CloudFront OAC tại [https://cloudexam.id.vn](https://cloudexam.id.vn) và các subdomain quốc gia.

**CI/CD:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) chạy khi push `main` — xác thực AWS qua **OIDC** (không lưu khóa tĩnh), chạy bộ kiểm thử tự động, `terraform apply` và đồng bộ frontend lên S3/CloudFront.

Kiểm tra nhanh sau triển khai:

```bash
curl -I https://cloudexam.id.vn       # CloudFront trả HTTP 200
curl -I https://vn.cloudexam.id.vn    # subdomain quốc gia phân giải đúng tenant
```

---

## 5. KIỂM THỬ & KẾT QUẢ THỰC NGHIỆM

Toàn bộ số liệu dưới đây đo trực tiếp trên hạ tầng AWS Singapore, minh chứng trong [`docs/evidence/`](docs/evidence/) và Chương 3 của [báo cáo tổng kết](docs/report/REPORT.md).

### 5.1. Bão nộp bài giây cuối — 500 thí sinh đồng thời (P99 = 35.96 ms)

```bash
python tests/locustfile.py --users 500 --duration 10
```

| Chỉ số | Kết quả | SLA |
| :--- | :--- | :--- |
| Bài tiếp nhận thành công | 500/500 (100%) | ≥ 99.9% |
| Mean / P50 | 18.94 ms / 18.05 ms | < 30 ms |
| P90 / P95 | 26.28 ms / 29.07 ms | < 40 / 45 ms |
| **P99** | **35.96 ms** | **< 50 ms** |
| Max | 48.77 ms | < 100 ms |
| Thời gian đệm toàn bộ 500 bài vào SQS | 2.25 s | < 5 s |
| Số batch worker (Batch 10) | 50 | — |
| Bài rơi vào DLQ | 0 | 0 |

Kịch bản AT08 (`tests/waf_sqs_test.py`): bơm 100 bài nộp trong 1 giây qua mạng thật từ Việt Nam → Singapore — worker xử lý 13 lượt thực thi, trung bình ~2.95 s/batch 10 bài, tối đa ~3.95 s (cold start), không lỗi 5XX. Chi tiết: [`docs/SUBMISSION_STAMPEDE_REPORT.md`](docs/SUBMISSION_STAMPEDE_REPORT.md).

### 5.2. Sinh trắc học Rekognition — 100% accuracy, FAR = FRR = 0.00%

```bash
python tests/rekognition_accuracy_test.py
```

20 kịch bản thực địa (TC-01…TC-20) × 5 lần lặp = **100 lượt đối soát**: 65 lượt chính chủ (đủ sáng, đeo kính, nghiêng ±15–30°, thiếu sáng/ngược sáng) và 35 lượt giả mạo (thi hộ, ảnh in A4, màn hình điện thoại).

| Chỉ số (ISO/IEC 19795, ngưỡng 80.0%) | Kết quả |
| :--- | :--- |
| True Positive (chính chủ được chấp nhận) | 13/13 ca, độ khớp 81.40–97.15% |
| True Negative (giả mạo bị chặn) | 7/7 ca, độ khớp chỉ 12.30–31.80% |
| **FAR / FRR** | **0.00% / 0.00%** |
| Độ chính xác tổng thể | 100.00% |

Quét ngưỡng 70–90% cho thấy 80% là điểm cân bằng: nâng lên 85% / 90% khiến FRR tăng vọt 38.46% / 69.23%. Độ trễ toàn trình API face-verify đo qua DevTools ~2.37 s (trong đó Rekognition ~750 ms). Ghi chú: chống spoofing ảnh in/màn hình hiện dựa trên đối soát của giám thị; chưa tích hợp Rekognition Face Liveness (xem hạn chế trong báo cáo).

### 5.3. Tích hợp đa đám mây — 18/18 PASS

```bash
python tests/multi_cloud_test.py      # Gemini + Turnstile + Upstash + Step Functions + SNS
python tests/test_face_verify.py      # 14/14 unit test điểm danh
python tests/test_gemini_features.py  # tính năng Gemini & fallback
```

### 5.4. WAFv2 & chịu lỗi SQS DLQ

```bash
python tests/waf_sqs_test.py
```

- **AT12 (WAF rate limit):** hạ ngưỡng kiểm thử xuống 100 req/5 phút/IP, bắn 150 request — 100 đầu HTTP 200, 50 sau bị chặn HTTP 403. Bộ quy tắc SQLi/Common/KnownBadInputs chặn payload tiêm nhiễm. Web ACL `cloudexam-web-acl-dev` gồm 5 quy tắc: RateLimitPerIP, AWSManagedRulesCommonRuleSet, SQLiRuleSet, KnownBadInputsRuleSet, GeoMatchRule (count mode).
- **AT09 (DLQ):** payload hỏng cấu trúc được retry đúng 3 lần rồi chuyển vào `cloudexam-exam-submission-dlq-dev` (lưu 14 ngày), bảo toàn dữ liệu; alarm `cloudexam-sqs-dlq-messages-dev` giám sát liên tục.

### 5.5. Local-First & khôi phục sau sự cố mạng

1. Làm bài vài câu → ngắt Wi-Fi / tắt trình duyệt đột ngột / F5.
2. Mở lại trang: toàn bộ đáp án + vị trí câu đang làm khôi phục từ `localStorage` trong ~1.2 ms.
3. Có mạng lại → bộ định thì 60 s tự đồng bộ nháp lên DynamoDB trong suốt.
4. Sau khi nộp: F5 vào thẳng màn kết quả (không cho làm lại); nếu worker chưa chấm xong, màn hình hiển thị "đang chấm" và tự cập nhật điểm.

Mô hình giảm tải I/O (ca 5.000 thí sinh, đề 50 câu, 60 phút): ~500.000 lượt ghi nháp trực tiếp → ~50.000 lượt với throttled micro-batching (**giảm 90% WCU**), độ trễ giao diện 0 ms.

---

## 6. QUẢN TRỊ CHI PHÍ (FINOPS)

### 6.1. Đối soát thực tế tháng 11/2026 — $0.00 (AWS Cost Explorer)

Môi trường dev chạy trong Free Tier, `enable_waf = false` để tránh phí WAF cố định:

| Dịch vụ | Hạn mức miễn phí | Sử dụng thực tế | Chi phí |
| :--- | :--- | :--- | :---: |
| AWS Lambda (arm64) | 1M requests + 400.000 GB-s/tháng | ~25.000 requests + ~30.000 s compute | $0.00 |
| DynamoDB | 25 GB + 25 WCU/RCU | ~120 MB, 5 bảng + sparse GSI | $0.00 |
| S3 | 5 GB + 20.000 GET | ~450 MB ảnh đề & ảnh thẻ | $0.00 |
| SQS + DLQ | 1M requests/tháng | ~15.000 messages | $0.00 |
| CloudFront | 1 TB + 10M requests | ~3.2 GB băng thông | $0.00 |
| Cognito | 50.000 MAU | 25 tài khoản kiểm thử | $0.00 |
| SNS | 1.000 email/tháng | ~120 email báo cáo ca thi | $0.00 |
| Google Gemini (AI Studio) | 1.500 requests/ngày | ~450 lượt bóc tách đề | $0.00 |
| Upstash Redis | 10.000 commands/ngày | ~3.500 lệnh ZADD/ZREVRANGE | $0.00 |
| Cloudflare Turnstile | Không giới hạn | ~2.500 lượt xác thực | $0.00 |
| **Tổng** | — | — | **$0.00** |

Minh chứng: [`docs/evidence/console_cost_explorer.png`](docs/evidence/console_cost_explorer.png), [`docs/finops_report.md`](docs/finops_report.md). Kiểm soát chủ động: AWS Budgets ngưỡng $0.50 + CloudWatch Billing Alarms + 4 metric alarms (DLQ, lỗi Lambda, 5XX...).

### 6.2. Ước tính quy mô production — kỳ thi 5.000 thí sinh

Theo AWS Pricing Calculator (chi tiết trong báo cáo, mục 2.5):

- **Giao dịch trong 60 phút thi (~$6.87):** Lambda $0.35 + DynamoDB $0.85 + SQS $0.02 + S3/CloudFront $0.65 + Rekognition 5.000 lượt CompareFaces $5.00.
- **Cố định theo tháng (~$10.71):** WAFv2 $10.00 + Route 53 hosted zone $0.50 + API Gateway $0.21.
- **Tổng ~$17.58/tháng ≈ 88 VNĐ/thí sinh** — tiết kiệm ~91% so với in đề giấy và ~81% so với cụm EC2 c5.large + ALB trực 24/7 (~$94/tháng).

---

## 7. THÀNH VIÊN NHÓM & PHÂN CÔNG NHIỆM VỤ

Nhóm 14 — INT3319 1, học kỳ I 2026–2027. Phân công theo 4 sprint, đóng góp đồng đều **25%/thành viên** (chi tiết commit trong Bảng 3.6 của báo cáo):

| Thành viên | MSSV | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Nguyễn Thị Ngọc Hà** (nhóm trưởng) | 24020115 | Khởi tạo dự án React 19 + TypeScript + Vite + Tailwind; giao diện quản trị câu hỏi/thí sinh/ca thi; kiến trúc hệ thống & kế hoạch sprint; hạ tầng SQS/DLQ/Grading Worker/IAM bằng Terraform; tích hợp Gemini, Turnstile, Upstash, bóc tách DOCX; CloudFront OAC & đa thuê bao tầng biên; RBAC 3 cổng + LiveProctorDashboard; chủ trì báo cáo 1–3. |
| **Trần Đức Mạnh** | 24021561 | Cognito OAuth2 PKCE, Hosted UI, API Gateway, IAM least-privilege; SQS Grading Worker (Python) & API kết quả; CI/CD GitHub Actions OIDC, Step Functions, SNS; tích hợp Gemini sinh đề + fallback đa model; CloudFront, Route 53, tên miền cloudexam.id.vn & subdomains; tăng cường RBAC và kiểm soát tài khoản. |
| **Phạm Tuấn Phong** | 24021596 | Thiết kế 5 bảng DynamoDB + S3 CORS Direct PUT; Lambda điểm danh Rekognition & CloudWatch Alarms; chuẩn hóa ảnh thẻ + unit test; AWS Budgets, SNS cảnh báo chi phí, Cost Allocation Tags, S3 Lifecycle; báo cáo FinOps & sơ đồ kiến trúc; kịch bản tải Locust 500 VUs; đánh giá FAR/FRR; tài liệu thiết kế CSDL. |
| **Nguyễn Phúc Tấn** | 24021620 | Phòng thi `ExamRoom.tsx` (webcam, đếm ngược, tự nộp bài); `SessionResultsModal.tsx` + xuất CSV UTF-8; hệ thống chuyển theme/ngôn ngữ đa quốc gia; tối ưu UX phòng thi, mở rộng tiếng Anh & tiếng Lào; sửa lỗi nghiệp vụ ca thi, bộ bóc tách câu tự luận bằng AI. |

---

## 8. TÀI LIỆU KỸ THUẬT THAM KHẢO

**Trong repo:**

- [Báo cáo tổng kết đồ án (REPORT.md)](docs/report/REPORT.md) — toàn văn báo cáo cuối kỳ kèm [danh mục 27 hình minh chứng](docs/report/README.md)
- [Báo cáo rà soát an ninh Zero-Trust](docs/SECURITY_AUDIT_REPORT.md)
- [Báo cáo kiểm thử tải nộp bài dồn dập](docs/SUBMISSION_STAMPEDE_REPORT.md)
- [Báo cáo FinOps $0.00](docs/finops_report.md)
- [Thiết kế CSDL DynamoDB](docs/DATABASE_DESIGN.md) · [Thiết kế lưu trữ S3](docs/S3_STORAGE_DESIGN.md) · [Hướng dẫn Cognito/IAM/API Gateway](docs/COGNITO_IAM_APIGATEWAY_GUIDE.md)
- [Minh chứng kiểm thử (console, Locust, FAR/FRR, WAF/SQS)](docs/evidence/) · [Kịch bản quay demo](docs/demo/KICH_BAN_QUAY_DEMO.md)

**Tài liệu trình bày:**

- Slide thuyết trình chính thức (Canva, 42 trang): https://www.canva.com/design/DAHa6Jyltt8/KM0Zizd_0s8KiLjZhV7I8A/edit
- Video thuyết minh slide: https://www.youtube.com/watch?v=bIGDnOnkjZc
- Video demo vận hành trực tiếp toàn trình: https://www.youtube.com/watch?v=UMXmyUHUJRo

---

*© 2026 Nhóm 14 — VNU University of Engineering and Technology (VNU-UET).*