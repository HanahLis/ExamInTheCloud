# KẾ HOẠCH SPRINT 2: HOÀN THIỆN NGHIỆP VỤ LÕI & VẬN HÀNH ỔN ĐỊNH HỆ THỐNG
## Dự án: CloudExam — Hệ Thống Thi Trực Tuyến Đa Vùng, Đa Quốc Gia ($0 AWS Free Tier)

---

## 1. BÁO CÁO HIỆN TRẠNG MÃ NGUỒN (CURRENT STATE)

Hệ thống đã triển khai thành công **Giai đoạn 1** trên môi trường AWS Live (`ap-southeast-1` Singapore):

### ✅ Các thành phần đã hoạt động tốt:
1. **Hạ tầng IaC (Terraform):** 9 module cốt lõi đã apply lên AWS (`cognito.tf`, `dynamodb.tf`, `s3.tf`, `api_gateway.tf`, `iam.tf`, `lambda.tf`, `provider.tf`, `variables.tf`, `outputs.tf`).
2. **Bảo mật định danh (Amazon Cognito):** User Pool `cloudexam-user-pool-dev`, Hosted UI PKCE, phân quyền 3 nhóm RBAC (`Admin`, `Organizer`, `Candidate`), Identity Pool cấp quyền upload S3.
3. **Cơ sở dữ liệu NoSQL (Amazon DynamoDB):** 4 bảng chế độ `PAY_PER_REQUEST` ($0 idle cost): `CloudExam_QuestionBanks_dev`, `CloudExam_Questions_dev` (GSI `BankIdIndex`), `CloudExam_Candidates_dev` (GSI `StudentCodeIndex`), `CloudExam_Sessions_dev`.
4. **Lưu trữ đám mây (Amazon S3):** Bucket `cloudexam-storage-409289618109-dev`, Public Read policy, phân quyền PUT trực tiếp qua S3 Presigned URL (TTL 300s).
5. **Cổng API tập trung (Amazon API Gateway):** REST API `cloudexam-api-dev` (ID: `tmfbgkjy03`), tích hợp Cognito Authorizer và Gateway Responses CORS (`DEFAULT_4XX` / `DEFAULT_5XX`).
6. **Backend Serverless (AWS Lambda):** 
   - `core_api` (`api_handler.py`): CRUD ngân hàng câu hỏi, câu hỏi, thí sinh, ca thi và sinh Presigned URL.
   - `face_verify` (`face_verify_handler.py`): Logic đối sánh khuôn mặt qua Amazon Rekognition CompareFaces (ngưỡng $\ge 80\%$).
7. **Frontend Web SPA (React 18 + Vite + Tailwind CSS):** 4 tab nghiệp vụ (Ngân hàng câu hỏi, Thí sinh, Ca thi, Phòng thi camera HTML5) kèm cơ chế Dual-Mode (`VITE_USE_MOCK=false` gọi AWS thật vs `true` dùng LocalStorage).

### ⚠️ Các điểm nghẽn cần giải quyết trong Sprint 2:
* **Lưu trữ kết quả thi:** `POST /exam/submit` mới chỉ tính điểm trong RAM, chưa lưu bản ghi bài thi vào DynamoDB.
* **Bộ đệm chịu tải:** Chưa có hàng đợi Amazon SQS và Lambda worker chấm điểm bất đồng bộ (`grading_worker.py`).
* **Bảng điểm ca thi:** Giảng viên chưa có màn hình xem danh sách thí sinh đã nộp bài và điểm số.
* **Đa quốc gia:** Frontend chưa có module `themes/` và `locales/` để chuyển đổi giao diện linh hoạt giữa các nước (kèm cơ chế Fallback về Theme chuẩn).

---

## 2. MỤC TIÊU SPRINT 2 (SPRINT GOAL)

> **"Hoàn thiện 100% chu trình nghiệp vụ khép kín từ Tạo đề -> Mở ca thi -> Điểm danh AI khuôn mặt thật -> Làm bài thi -> Nộp bài vào SQS buffer -> Chấm điểm tự động lưu DynamoDB -> Giảng viên xem Bảng điểm, đảm bảo Web chạy mượt mà trên môi trường AWS Live Cloud."**

---

## 3. PHÂN CÔNG CÔNG VIỆC CHI TIẾT 4 THÀNH VIÊN

### 👩‍💻 1. Nguyễn Thị Ngọc Hà (24020115) — Trưởng nhóm / Hạ tầng SQS & Định tuyến Đa Quốc Gia
* **Vai trò:** Quản trị hạ tầng Terraform, kiến trúc hàng đợi đệm và định tuyến Edge.
* **Dịch vụ AWS:** `Amazon SQS & DLQ`, `AWS Lambda ESM`, `Amazon S3`, `AWS IAM`, `Terraform`.

| Mã Task | Mô tả công việc chi tiết | Tệp mã nguồn liên quan | Mức độ | Hạn chót |
|:---:|:---|:---|:---:|:---:|
| **H-01** | Viết module Terraform khởi tạo hàng đợi `ExamSubmissionQueue` và Dead Letter Queue `ExamSubmissionDLQ` (maxReceiveCount = 3) | `backend/terraform/sqs.tf` | 🔴 CRITICAL | Ngày 2 |
| **H-02** | Cấu hình Event Source Mapping kết nối SQS với Lambda `grading_worker` trong `lambda.tf` (Batch size = 10) | `backend/terraform/lambda.tf` | 🔴 CRITICAL | Ngày 3 |
| **H-03** | Cập nhật IAM Policy cấp quyền `sqs:SendMessage` cho Core API và `sqs:ReceiveMessage/DeleteMessage` cho Grading Worker | `backend/terraform/iam.tf` | 🔴 CRITICAL | Ngày 3 |
| **H-04** | Chuẩn hóa phân quyền S3 Bucket Policy cho thư mục `faces/` và `questions/` để đảm bảo upload ảnh không lỗi CORS/403 | `backend/terraform/s3.tf` | 🟡 HIGH | Ngày 4 |

---

### 👨‍💻 2. Trần Đức Mạnh (24021561) — Backend Core, SQS Pipeline & API Bảng Điểm
* **Vai trò:** Phát triển logic nghiệp vụ serverless backend, xử lý hàng đợi nộp bài và quản trị điểm số.
* **Dịch vụ AWS:** `Amazon API Gateway`, `AWS Lambda (Python)`, `Amazon SQS`, `Amazon DynamoDB`.

| Mã Task | Mô tả công việc chi tiết | Tệp mã nguồn liên quan | Mức độ | Hạn chót |
|:---:|:---|:---|:---:|:---:|
| **M-01** | Viết mới Lambda Worker `grading_worker.py`: Tiêu thụ batch 10 message từ SQS, giải mã bài nộp, so khớp đáp án chuẩn và ghi kết quả vào DynamoDB | `backend/lambda/grading_worker.py` | 🔴 CRITICAL | Ngày 2 |
| **M-02** | Nâng cấp `POST /exam/submit` trong `api_handler.py`: Đóng gói bài thi và đẩy vào SQS Queue bằng `boto3.client('sqs')`, trả HTTP 200 tức thì (< 50ms) | `backend/lambda/api_handler.py` | 🔴 CRITICAL | Ngày 3 |
| **M-03** | Bổ sung API `GET /sessions/{id}/results`: Trả về danh sách thí sinh đã nộp bài, điểm số, thời gian nộp và trạng thái ca thi cho Giảng viên | `backend/lambda/api_handler.py` | 🔴 CRITICAL | Ngày 4 |
| **M-04** | Đóng gói payload ZIP, chạy `terraform apply` và kiểm thử API nộp bài qua Postman/cURL | `backend/terraform/` | 🟡 HIGH | Ngày 5 |

---

### 👨‍💻 3. Phạm Tuấn Phong (24021596) — AI Rekognition, Dữ Liệu Ảnh Thẻ & CloudWatch Alarms
* **Vai trò:** Chịu trách nhiệm thị giác máy tính AI, chất lượng dữ liệu thẻ thí sinh và giám sát vận hành.
* **Dịch vụ AWS:** `Amazon Rekognition`, `Amazon S3`, `Amazon DynamoDB`, `Amazon CloudWatch`.

| Mã Task | Mô tả công việc chi tiết | Tệp mã nguồn liên quan | Mức độ | Hạn chót |
|:---:|:---|:---|:---:|:---:|
| **P-01** | Nâng cấp `face_verify_handler.py`: Bắt trọn ngoại lệ của Rekognition (`InvalidParameterException`, `FaceNotFoundException`) và trả thông báo lỗi thân thiện | `backend/lambda/face_verify_handler.py` | 🔴 CRITICAL | Ngày 2 |
| **P-02** | Chuẩn bị bộ ảnh chân dung thật của nhóm: Viết script nạp ảnh vào S3 `faces/{studentCode}.jpg` và cập nhật trường `faceImageUrl` trong bảng `CloudExam_Candidates_dev` | `backend/data/upload_sample_faces.py` | 🔴 CRITICAL | Ngày 3 |
| **P-03** | Cấu hình CloudWatch Log Groups tập trung và thiết lập 2 Metric Alarms: Cảnh báo API lỗi 5XX và Cảnh báo có message trong Dead Letter Queue | `backend/terraform/cloudwatch.tf` | 🟡 HIGH | Ngày 4 |
| **P-04** | Kiểm thử trực tiếp luồng quét khuôn mặt từ camera thật với ảnh hồ sơ S3 trên môi trường AWS Live | `tests/` | 🟡 HIGH | Ngày 5 |

---

### 👨‍💻 4. Nguyễn Phúc Tấn (24021620) — Frontend: Ổn Định Phòng Thi, Bảng Điểm & Dynamic Multi-Country
* **Vai trò:** Hoàn thiện giao diện phòng thi trực tuyến, bảng điểm ca thi, kiến trúc đa quốc gia và tối ưu UX.
* **Dịch vụ / Tech stack:** `React 18`, `TypeScript`, `Tailwind CSS`, `HTML5 MediaDevices / Canvas`, `Cognito Auth PKCE`.

| Mã Task | Mô tả công việc chi tiết | Tệp mã nguồn liên quan | Mức độ | Hạn chót |
|:---:|:---|:---|:---:|:---:|
| **T-01** | Hoàn thiện `ExamRoom.tsx`: Xử lý mượt mà mở camera HTML5, hiệu ứng quét khuôn mặt sinh trắc học, Timer đếm ngược 45p, tự động nộp bài khi hết giờ | `frontend/src/components/ExamRoom.tsx` | 🔴 CRITICAL | Ngày 2 |
| **T-02** | Xây dựng Modal Xem Bảng Điểm Ca Thi trong `ExamSessionTab.tsx`: Hiển thị danh sách thí sinh đã nộp, điểm số, thời gian nộp và nút tải kết quả | `frontend/src/components/SessionResultsModal.tsx` | 🔴 CRITICAL | Ngày 3 |
| **T-03** | Xây dựng Dynamic Multi-Country Engine: Tạo `themes/{vn, la, default}.ts` và `locales/{vi, la, en}.json` kèm cơ chế Graceful Fallback về Theme chuẩn | `frontend/src/themes/`, `frontend/src/locales/` | 🟡 HIGH | Ngày 4 |
| **T-04** | Kiểm thử toàn diện ở chế độ AWS Live (`VITE_USE_MOCK=false`), fix triệt để lỗi token hết hạn, CORS và trạng thái loading | `frontend/src/` | 🔴 CRITICAL | Ngày 5 |

---

## 4. CÂY THƯ MỤC DỰ ÁN CHUẨN HÓA

```text
ExamInTheCloud/
├── backend/
│   ├── terraform/                             # Quản trị hạ tầng dạng mã (IaC)
│   │   ├── provider.tf                       # AWS Provider (Singapore ap-southeast-1)
│   │   ├── variables.tf                      # Biến môi trường
│   │   ├── outputs.tf                        # Outputs API Gateway, Cognito, S3
│   │   ├── cognito.tf                        # User Pool, Hosted UI PKCE, RBAC Groups, Identity Pool
│   │   ├── dynamodb.tf                       # 4 bảng NoSQL On-Demand
│   │   ├── s3.tf                             # S3 Bucket lưu ảnh thẻ và câu hỏi
│   │   ├── api_gateway.tf                    # REST API, Cognito Authorizer, CORS Responses
│   │   ├── iam.tf                            # IAM Least-Privilege cho toàn bộ Lambda
│   │   ├── lambda.tf                         # Khởi tạo Lambda Functions & Event Source Mapping
│   │   ├── sqs.tf                            # [MỚI] Hàng đợi SQS ExamSubmission & DLQ (Hà)
│   │   ├── cloudwatch.tf                     # [MỚI] Log Groups & Metric Alarms (Phong)
│   │   └── terraform.tfvars.example          
│   ├── lambda/                               # Backend Serverless
│   │   ├── api_handler.py                    # Core CRUD, Presigned URL & Đẩy bài vào SQS (Mạnh)
│   │   ├── face_verify_handler.py            # Điểm danh AI Rekognition CompareFaces (Phong)
│   │   └── grading_worker.py                 # [MỚI] Worker tiêu thụ SQS chấm điểm tự động (Mạnh)
│   └── data/                                 # Dữ liệu & Script
│       ├── questions_seed.json               
│       ├── candidates_seed.json              
│       ├── sessions_seed.json                
│       ├── seed_dynamodb.py                  # Script nạp dữ liệu DynamoDB
│       └── upload_sample_faces.py            # [MỚI] Script nạp ảnh thẻ thật vào S3 (Phong)
├── frontend/                                 # Ứng dụng Web Single Page Application (React 18)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Callback.tsx                  # Điều hướng sau khi đăng nhập Cognito PKCE
│   │   │   ├── CandidatesTab.tsx             # Quản lý thí sinh & ảnh mẫu
│   │   │   ├── ExamSessionTab.tsx            # Quản trị ca thi & xem bảng điểm (Tấn)
│   │   │   ├── SessionResultsModal.tsx       # [MỚI] Modal xem bảng điểm thí sinh nộp bài (Tấn)
│   │   │   ├── QuestionBankTab.tsx           # Soạn thảo câu hỏi & tải ảnh qua Presigned URL
│   │   │   └── ExamRoom.tsx                  # Phòng thi: Camera HTML5, AI Rekognition, Làm bài, Nộp bài
│   │   ├── services/
│   │   │   ├── apiService.ts                 # Axios Client gọi API Gateway live & Mock fallback
│   │   │   ├── auth.ts                       # Quản lý phiên đăng nhập Cognito & Mock Account
│   │   │   └── s3Service.ts                  # Tải file trực tiếp lên S3
│   │   ├── themes/                           # [MỚI] Dynamic Multi-Country Theme Engine
│   │   │   ├── vn.ts                         # Theme Việt Nam
│   │   │   ├── la.ts                         # Theme Lào
│   │   │   ├── default.ts                    # Theme Chuẩn Quốc Tế (Graceful Fallback)
│   │   │   └── themeContext.tsx              # React Context điều phối giao diện
│   │   ├── locales/                          # [MỚI] Đa ngôn ngữ i18n
│   │   │   ├── vi.json                       # Tiếng Việt
│   │   │   ├── la.json                       # Tiếng Lào
│   │   │   ├── en.json                       # Tiếng Anh
│   │   │   └── i18nContext.tsx               # Context chuyển đổi ngôn ngữ
│   │   ├── App.tsx                           # Điều hướng Tab, Header chuyển đổi Quốc gia/Ngôn ngữ
│   │   ├── App.css / index.css
│   │   └── main.tsx
│   ├── .env                                  # Cấu hình kết nối AWS Live
│   └── package.json
└── docs/                                     # Hồ sơ tài liệu & Sơ đồ kiến trúc
    ├── SPRINT_2_PLAN.md                      # [MỚI] Kế hoạch Sprint 2 chi tiết
    ├── architecture_diagram_6_tiers.eraser   # Sơ đồ Eraser Diagram-as-Code gọn gàng
    ├── architecture_diagram_v2.svg           # Sơ đồ kiến trúc Vector chuẩn
    ├── architecture_diagram_preview.html     # Trình xem trực quan sơ đồ
    ├── DATABASE_DESIGN.md
    ├── S3_STORAGE_DESIGN.md
    ├── COGNITO_IAM_APIGATEWAY_GUIDE.md
    └── TERRAFORM_GUIDE.md
```

---

## 5. LỊCH TRÌNH VÀ TIÊU CHÍ NGHIỆM THU (DEFINITION OF DONE)

### 📅 Lịch trình thực hiện (5 Ngày):
* **Ngày 1 – 2 (Backend & AI):** Hoàn thành `sqs.tf`, `grading_worker.py`, nâng cấp bắt lỗi cho `face_verify_handler.py`.
* **Ngày 3 – 4 (Frontend & Kết nối):** Hoàn thiện `ExamRoom.tsx`, tạo `SessionResultsModal.tsx`, viết bộ `themes/` và `locales/`.
* **Ngày 5 (Tổng duyệt Live):** Bật `VITE_USE_MOCK=false`, chạy ca thi thật 100%: Điểm danh camera thật -> Nộp bài vào SQS -> Kiểm tra điểm trong DynamoDB và xem Bảng điểm trên Web.

### 🎯 Tiêu chí hoàn thành (Acceptance Criteria):
1. Thí sinh điểm danh bằng Webcam máy tính, Rekognition nhận diện đúng người với độ khớp $\ge 80\%$ và mở đề thi.
2. Bấm nộp bài: API Gateway phản hồi ngay trong $< 100\text{ms}$, bài thi được đẩy vào SQS và tiêu thụ bởi `grading_worker.py`.
3. Điểm số và bài làm được lưu chính xác vào DynamoDB.
4. Giảng viên mở ca thi bấm xem Bảng điểm: Hiển thị đầy đủ danh sách thí sinh đã nộp bài kèm điểm số chính xác.
5. Bộ chuyển đổi quốc gia trên Header hoạt động mượt mà, tự động chuyển đổi theme và ngôn ngữ (hoặc fallback về Theme chuẩn quốc tế).
