# KẾ HOẠCH SPRINT 3: KIẾN TRÚC ĐA ĐÁM MÂY (MULTI-CLOUD), PHỤC HỒI THẢM HỌA ĐA VÙNG (ZERO-CLICKOPS) & QUẢN TRỊ FINOPS (0 USD CLOUD)
## Dự án: CloudExam — Hệ Thống Khảo Thí Trực Tuyến Thế Hệ Mới

---

## 1. TÌNH HÌNH MÃ NGUỒN HIỆN TẠI (CURRENT CODEBASE STATE)

Sau khi hoàn thành xuất sắc Sprint 1 và Sprint 2, hệ sinh thái CloudExam đã vận hành trơn tru chu trình thi trắc nghiệm cốt lõi trên môi trường **AWS Live Cloud** (`ap-southeast-1` Singapore):

### ✅ Các thành phần cốt lõi đã hoạt động hoàn chỉnh:
1. **Hạ tầng IaC (Terraform):** Bộ mã nguồn tại `backend/terraform/` đã khởi tạo thành công:
   - `cognito.tf`: User Pool PKCE, Identity Pool, 3 nhóm quyền RBAC (`Admin`, `Organizer`, `Candidate`).
   - `dynamodb.tf`: 4 bảng NoSQL On-Demand (`CloudExam_Questions_dev`, `CloudExam_Candidates_dev`, `CloudExam_Sessions_dev`, `CloudExam_QuestionBanks_dev`).
   - `s3.tf`: Bucket `cloudexam-storage-409289618109-dev` phân quyền CORS upload trực tiếp (`questions/`, `faces/`).
   - `api_gateway.tf`: REST API `cloudexam-api-dev` tích hợp Cognito Authorizer và Gateway Responses CORS.
   - `sqs.tf`: Hàng đợi đệm nộp bài `ExamSubmissionQueue` và Dead-Letter Queue `ExamSubmissionDLQ`.
   - `lambda.tf` & `iam.tf`: Triển khai 3 hàm Lambda với quyền Least-Privilege.
2. **Backend Serverless (AWS Lambda Python 3.11):**
   - `api_handler.py`: CRUD Đề thi, Thí sinh, Ca thi, sinh Presigned URL S3 và đẩy bài nộp vào SQS.
   - `face_verify_handler.py`: Điểm danh AI bằng Amazon Rekognition `CompareFaces` (ngưỡng ≥ 80%).
   - `grading_worker.py`: Tiêu thụ batch 10 message từ SQS để chấm điểm tự động và ghi vào DynamoDB.
3. **Frontend React SPA (Vite + TypeScript + Tailwind CSS):**
   - `QuestionBankTab.tsx`: Quản lý ngân hàng đề, soạn câu hỏi, upload ảnh minh họa qua Presigned URL.
   - `CandidatesTab.tsx`: Quản lý hồ sơ thí sinh và liên kết ảnh thẻ sinh trắc học gốc.
   - `ExamSessionTab.tsx` & `SessionResultsModal.tsx`: Quản trị ca thi, xuất bảng điểm Excel/CSV chuẩn UTF-8 tiếng Việt.
   - `ExamRoom.tsx`: Phòng thi trực tuyến, mở Webcam HTML5, canvas chụp ảnh sinh trắc, đồng hồ đếm ngược, lưu nháp Cloud liên tục.

### ⚠️ Những thách thức & Giới hạn kỹ thuật cần giải quyết trong Sprint 3:
1. **Phụ thuộc độc quyền nhà cung cấp (Vendor Lock-in):** Toàn bộ hệ thống hiện đang đặt trên AWS. Cần mở rộng kiến trúc **Đa Đám Mây (Multi-Cloud)** kết hợp Google Cloud và Cloudflare để tận dụng thế mạnh miễn phí vượt trội của từng hãng.
2. **Khâu nhập liệu đề thi còn thủ công:** Giảng viên vẫn phải gõ tay từng câu hỏi hoặc nhập JSON. Cần tính năng **tự động bóc tách file Word/PDF** thành ngân hàng câu hỏi.
3. **Nguy cơ Bot Spam & Gian lận nộp bài:** Chưa có cơ chế phân biệt người thật và script botnet tự động spam nộp bài làm nghẽn hàng đợi SQS.
4. **Trải nghiệm thi đấu trực tiếp (Gamified Exam):** Chưa có bảng xếp hạng nhảy điểm trực tiếp theo thời gian thực (Live Leaderboard < 5ms) phục vụ các kỳ thi giao lưu.
5. **Rủi ro thảm họa diện rộng (Single-Region Failure):** Toàn bộ dữ liệu nằm ở Singapore. Nếu xảy ra đứt cáp biển hoặc sự cố data center, hệ thống sẽ ngưng trệ. Cần cơ chế **Phục hồi Thảm họa Đa Vùng Tự động (Zero-ClickOps Multi-Region DR)** sang Jakarta (`ap-southeast-3`).
6. **Mở rộng đa quốc gia (`cloudexam.vn` vs `edulao.la`):** Cần cơ chế cùng 1 hệ thống backend nhưng tự động đổi thương hiệu, màu sắc, ngôn ngữ và cô lập dữ liệu theo từng tên miền quốc gia.
7. **Kiểm soát chi phí (0 USD FinOps):** Cần công cụ theo dõi, đo đạc chi phí tự động và kịch bản bật/tắt dịch vụ để bảo vệ tài khoản khỏi nguy cơ vượt hạn mức Free Tier.

---

## 2. MỤC TIÊU SPRINT 3 (SPRINT GOAL)

> **"Nâng tầm CloudExam thành nền tảng Khảo thí Đa Đám Mây (Multi-Cloud: AWS + Google Cloud + Cloudflare + Upstash), hỗ trợ Đa Tên miền Quốc gia (Việt Nam & Lào), Tự động hóa Phục hồi Thảm họa Đa Vùng (Zero-ClickOps Singapore - Jakarta) và Đo đạc kiểm soát chi phí FinOps tuyệt đối ở mức 0.00 USD."**

---

## 3. CHIẾN LƯỢC PHÂN CHIA ĐA ĐÁM MÂY & GIẢI THÍCH LOGIC KỸ THUẬT

Nhóm kiên định áp dụng **Mô hình Kiến trúc Hạt nhân & Vệ tinh (Hub-and-Spoke Multi-Cloud Architecture)**:

```
                               ┌────────────────────────────────────────────────────────┐
                               │                 GOOGLE CLOUD (AI Studio)               │
                               │  - Gemini 1.5 Flash API (Free 1,500 req/ngày, 0 USD)   │
                               │  - Đọc hiểu & Bóc tách file Word/PDF thành đề thi JSON │
                               └───────────────────────────▲────────────────────────────┘
                                                           │ (REST API HTTPS)
┌─────────────────────────────────┐        ┌───────────────┴────────────────┐        ┌─────────────────────────────────┐
│     CLOUDFLARE (Edge Security)  │        │       AWS CLOUD (Core Backbone)│        │      UPSTASH CLOUD (In-Memory)  │
│  - Turnstile (Invisible CAPTCHA)│───────►│  - API Gateway, Lambda, DynamoDB│◄───────│  - Serverless Redis (Free 10K)  │
│  - Chống Bot spam nộp bài       │ Token  │  - Rekognition AI, SQS, S3     │ Leader-│  - Live Leaderboard Top 5       │
│  - Free Unlimited, 0 USD chi phí│ 0.1s   │  - Multi-Region & CloudFront   │ board  │  - Độ trễ phản hồi < 5ms        │
└─────────────────────────────────┘        └────────────────────────────────┘        └─────────────────────────────────┘
```

### Tại sao lại phân chia như vậy?
1. **AWS = "Trái tim & Xương sống" (Core Backbone):** Giữ nguyên 100% CSDL (DynamoDB), Lưu trữ (S3), Nhận diện khuôn mặt (Rekognition), Hàng đợi (SQS) và Tính toán (Lambda). Đây là luồng dữ liệu nghiệp vụ quan trọng nhất, giữ trên AWS giúp độ trễ nội bộ đạt tối ưu (dưới 15ms) và dễ dàng quản lý đồng nhất qua Terraform.
2. **Google Cloud (Google AI Studio) = "Vệ tinh Trí tuệ":** AWS Bedrock không có gói miễn phí vĩnh viễn (phải trả phí theo token). Google AI Studio cung cấp **Gemini 1.5 Flash hoàn toàn miễn phí** (15 RPM, 1 triệu token/phút), đọc hiểu tiếng Việt xuất sắc, phân tích tệp Word đề thi thành JSON chỉ trong 2 giây với chi phí **0.00 USD**.
3. **Cloudflare = "Lá chắn Biên Tàng hình":** AWS WAF tính phí cố định 5 USD/tháng/Web ACL; AWS Captcha tính tiền theo lượt giải. **Cloudflare Turnstile hoàn toàn miễn phí không giới hạn**, chặn đứng Botnet ngay tại biên trước khi request chạm vào AWS API Gateway, bảo vệ hạn mức gọi Lambda.
4. **Upstash Cloud = "Bộ nhớ Đệm Tốc độ cao":** AWS ElastiCache không có gói Serverless Free Tier vĩnh viễn. **Upstash Serverless Redis miễn phí 10,000 lệnh/ngày**, phản hồi bảng xếp hạng trực tiếp trong dưới 5ms mà không tiêu tốn dung lượng đọc/ghi của DynamoDB.

---

## 4. PHÂN CHIA CÔNG VIỆC CHI TIẾT 4 THÀNH VIÊN (WORK BREAKDOWN STRUCTURE)

---

### 👩‍💻 1. Nguyễn Thị Ngọc Hà (24020115) — Trưởng nhóm / Kiến trúc Đa Vùng DR, CloudFront Multi-Domain & Bảo mật Biên Cloudflare

* **Vai trò:** Quản trị kiến trúc tổng thể, hạ tầng Multi-Region DR, phân phối CDN đa quốc gia và tích hợp xác thực biên Cloudflare.
* **Đám mây phụ trách:** **AWS** (`Route 53`, `CloudFront Functions`, `S3 CRR`, `DynamoDB Global Tables`, `Terraform`) & **Cloudflare** (`Turnstile`).

| Mã Task | Tên công việc | Lý do thêm & Lý do triển khai ở file | File mã nguồn liên quan | Mức độ | Hạn chót |
|:---:|:---|:---|:---|:---:|:---:|
| **H-01** | **Cấu hình Đa Vùng & Sao chép CSDL DynamoDB Global Tables** | *Lý do:* Chống thảm họa. Nếu vùng Singapore mất điện, dữ liệu tại Jakarta (`ap-southeast-3`) đã sẵn sàng đồng bộ 2 chiều (dưới 1s). Triển khai trong Terraform để tự động hóa 100%. | `backend/terraform/dynamodb_global.tf` | 🔴 CRITICAL | Ngày 1 |
| **H-02** | **Cấu hình S3 Cross-Region Replication (CRR) sang Jakarta** | *Lý do:* Đảm bảo toàn bộ ảnh thẻ thí sinh và ảnh minh họa câu hỏi được tự động sao chép sang S3 bucket dự phòng tại Jakarta. | `backend/terraform/s3_crr.tf` | 🔴 CRITICAL | Ngày 2 |
| **H-03** | **Cấu hình Route 53 Health Check & DNS Failover Policy (Zero-ClickOps)** | *Lý do:* Thăm dò endpoint `/health` tại Singapore mỗi 10s. Nếu lỗi 3 lần liên tiếp, Route 53 tự động chuyển DNS sang Jakarta trong dưới 2 phút mà không cần can thiệp tay. | `backend/terraform/route53.tf` | 🔴 CRITICAL | Ngày 2 |
| **H-04** | **Triển khai CloudFront Functions phân giải Đa Tên miền (`cloudexam.vn` vs `edulao.la`)** | *Lý do:* Chạy tại Edge (< 1ms). Trích xuất Host Header, tự động gắn `x-tenant-id = 'VN'` hoặc `'LA'` chuyển tiếp cho Backend và Frontend. | `cloudfront_functions/tenant-detector.js`, `backend/terraform/cloudfront.tf` | 🔴 CRITICAL | Ngày 3 |
| **H-05** | **Đăng ký Cloudflare Turnstile & Viết module kiểm tra Token tại Lambda** | *Lý do:* Chặn bot spam nộp bài thi. Viết hàm xác thực token tại Lambda Core API trước khi đẩy vào SQS. Miễn phí vĩnh viễn 100%. | `backend/lambda/api_handler.py` (hàm `verify_turnstile`) | 🟡 HIGH | Ngày 4 |
| **H-06** | **Xây dựng kịch bản kiểm thử giả lập sự cố Singapore và đo thời gian DNS chuyển vùng** | *Lý do:* Chứng minh tính năng Zero-ClickOps DR phục vụ chấm điểm đồ án. | `tests/dr_failover_test.sh` | 🟢 MEDIUM | Ngày 5 |

---

### 👨‍💻 2. Trần Đức Mạnh (24021561) — Backend Core, Tích hợp Google Gemini AI & Upstash Redis

* **Vai trò:** Lập trình Serverless Backend, tích hợp API Google AI Studio bóc tách đề thi Word và kết nối Upstash Redis Live Leaderboard.
* **Đám mây phụ trách:** **AWS Lambda** (Python 3.11), **Google Cloud** (Gemini 1.5 Flash API), **Upstash Cloud** (Redis REST API).

| Mã Task | Tên công việc | Lý do thêm & Lý do triển khai ở file | File mã nguồn liên quan | Mức độ | Hạn chót |
|:---:|:---|:---|:---|:---:|:---:|
| **M-01** | **Viết API trích xuất file Word qua Google Gemini (`POST /questions/parse-doc`)** | *Lý do:* Giảng viên chỉ cần kéo thả file Word đề thi, Lambda đọc text và gọi Google Gemini Flash để tự sinh JSON câu hỏi trắc nghiệm lưu vào DynamoDB. Tiết kiệm 95% thời gian tạo đề. | `backend/lambda/api_handler.py` | 🔴 CRITICAL | Ngày 1 |
| **M-02** | **Cập nhật endpoint `POST /exam/submit` xác thực Cloudflare Turnstile Token** | *Lý do:* Trước khi đóng gói bài thi vào SQS, Lambda kiểm tra Turnstile Token với Cloudflare. Nếu phát hiện bot/script tự động -> trả HTTP 403 Blocked ngay lập tức. | `backend/lambda/api_handler.py` | 🔴 CRITICAL | Ngày 2 |
| **M-03** | **Tích hợp đẩy điểm vào Upstash Serverless Redis trong `grading_worker.py`** | *Lý do:* Khi chấm xong bài thi, vừa lưu vào DynamoDB, vừa gọi Upstash REST API `ZADD leaderboard:{sessionId}` để phục vụ Bảng xếp hạng trực tiếp dưới 5ms. | `backend/lambda/grading_worker.py` | 🔴 CRITICAL | Ngày 3 |
| **M-04** | **Xây dựng API truy vấn Bảng xếp hạng trực tiếp `GET /sessions/{id}/leaderboard`** | *Lý do:* Trả về Top 5 thí sinh dẫn đầu điểm số từ Upstash Redis cho Frontend hiển thị thời gian thực mà không tốn RCU của DynamoDB. | `backend/lambda/api_handler.py` | 🟡 HIGH | Ngày 3 |
| **M-05** | **Tích hợp tính năng AI Gia sư ảo giải thích đáp án sai (`POST /exam/explain-answers`)** | *Lý do:* Sau khi thi, thí sinh bấm vào câu làm sai để nhận lời giải thích từ Gemini AI: "Vì sao chọn B và phương án A sai ở đâu". Tăng tính học thuật cho đề tài. | `backend/lambda/api_handler.py` | 🟡 HIGH | Ngày 4 |
| **M-06** | **Kiểm thử tích hợp API Đa Đám mây (AWS Lambda kết nối Google Gemini, Upstash và Cloudflare)** | *Lý do:* Đảm bảo các luồng gọi API chéo mây xử lý ngoại lệ tốt khi mất kết nối mạng. | `tests/multi_cloud_test.py` | 🟢 MEDIUM | Ngày 5 |

---

### 👨‍💻 3. Phạm Tuấn Phong (24021596) — CSDL NoSQL Multi-Tenant, Quản trị Khóa Cloud & Giám sát FinOps

* **Vai trò:** Thiết kế dữ liệu phân tách đa quốc gia, khởi tạo tài nguyên ngoài (Google AI, Upstash, Cloudflare) và giám sát chi phí 0 USD.
* **Đám mây phụ trách:** **AWS** (`DynamoDB`, `AWS Budgets`, `CloudWatch`), **Upstash Cloud** (Redis Database), **Google Cloud** (API Key).

| Mã Task | Tên công việc | Lý do thêm & Lý do triển khai ở file | File mã nguồn liên quan | Mức độ | Hạn chót |
|:---:|:---|:---|:---|:---:|:---|:---:|
| **P-01** | **Khởi tạo Database Upstash Redis & Đăng ký Google Gemini API Key** | *Lý do:* Lấy URL/Token Upstash và Gemini API Key miễn phí (không cần visa) để nạp vào biến môi trường Lambda. | `backend/terraform/variables.tf`, `backend/terraform/lambda.tf` | 🔴 CRITICAL | Ngày 1 |
| **P-02** | **Cập nhật Schema DynamoDB hỗ trợ Multi-Tenancy (`TENANT#VN#`, `TENANT#LA#`)** | *Lý do:* Dùng chung 1 bảng CSDL duy nhất nhưng phân tách dữ liệu an toàn tuyệt đối giữa thí sinh Việt Nam và Lào bằng khóa phân vùng có prefix. | `backend/data/seed_multitenant.py`, `backend/terraform/dynamodb.tf` | 🔴 CRITICAL | Ngày 2 |
| **P-03** | **Thiết lập AWS Budgets cảnh báo ngưỡng 0.50 USD & Cost Anomaly Detection** | *Lý do:* Bảo vệ tài khoản sinh viên. Tự động gửi email cảnh báo về điện thoại ngay khi có bất kỳ dịch vụ nào phát sinh cước bất thường trên 0.01 USD/ngày. | `backend/terraform/budgets.tf` | 🟡 HIGH | Ngày 3 |
| **P-04** | **Gắn Cost Allocation Tags đồng bộ trên toàn bộ tài nguyên Terraform** | *Lý do:* Gắn thẻ `Project=CloudExam`, `Env=dev`, `Tenant=VN/LA` để AWS Cost Explorer phân tích chi tiết chi phí từng quốc gia và từng chức năng. | `backend/terraform/*.tf` | 🟡 HIGH | Ngày 3 |
| **P-05** | **Cấu hình EventBridge Scheduler tự động dọn dẹp ảnh tạm thời trên S3 sau 24h** | *Lý do:* Tránh tràn dung lượng 5GB miễn phí của S3, duy trì chi phí lưu trữ luôn ở mức 0.00 USD. | `backend/terraform/s3.tf` (Lifecycle Rules) | 🟢 MEDIUM | Ngày 4 |
| **P-06** | **Trích xuất báo cáo đo đạc chi phí thực tế từ AWS Cost Explorer (Báo cáo FinOps)** | *Lý do:* Cung cấp bằng chứng minh bạch trong hồ sơ nghiệm thu đồ án chứng minh toàn bộ hệ thống hoạt động ở mức 0.00 USD. | `docs/finops_report.md` | 🟢 MEDIUM | Ngày 5 |

---

### 👨‍💻 4. Nguyễn Phúc Tấn (24021620) — Frontend: Tải File Đề thi, Turnstile Tàng hình, Live Leaderboard & Multi-Brand

* **Vai trò:** Phát triển giao diện người dùng, tích hợp các widget đa đám mây và hoàn thiện bộ nhận diện thương hiệu Việt Nam - Lào.
* **Tech stack:** `React 18`, `TypeScript`, `Tailwind CSS`, `Cloudflare Turnstile SDK`, `Axios`.

| Mã Task  | Tên công việc | Lý do thêm & Lý do triển khai ở file | File mã nguồn liên quan | Mức độ | Hạn chót |
|:--------:|:---|:---|:---|:---:|:---:|
| **T-01** | **Xây dựng UI Kéo thả file Word đề thi trong `QuestionBankTab.tsx`** | *Lý do:* Giảng viên kéo thả file `.docx` vào khung, xem hiệu ứng tải và nhận danh sách câu hỏi trích xuất từ Gemini AI hiển thị trực quan trước khi lưu. | `frontend/src/components/QuestionBankTab.tsx` | 🔴 CRITICAL | Ngày 1 |
| **T-02** | **Nhúng Widget Cloudflare Turnstile tàng hình vào phòng thi `ExamRoom.tsx`** | *Lý do:* Tự động xác thực người thật trong 0.1s ở chế độ nền khi thí sinh vào phòng thi, lấy token đính kèm payload nộp bài gửi lên AWS. | `frontend/src/components/ExamRoom.tsx`, `frontend/index.html` | 🔴 CRITICAL | Ngày 2 |
| **T-03** | **Hoàn thiện Dynamic Multi-Country Brand Engine (`cloudexam.vn` vs `edulao.la`)** | *Lý do:* Đọc header `x-tenant-id` hoặc hostname: tự động đổi sang Brand **CloudExam** (Đỏ/Vàng, tiếng Việt) hoặc Brand **EduLao** (Xanh/Đỏ, ພາສາລາວ) kèm cơ chế Fallback về Theme chuẩn. | `frontend/src/themes/`, `frontend/src/locales/`, `frontend/src/App.tsx` | 🟡 HIGH | Ngày 4 |
| **T-04** | **Giao diện Modal Giải thích Đáp án chi tiết bằng AI sau khi kết thúc ca thi** | *Lý do:* Thí sinh mở `SessionResultsModal.tsx` bấm nút "Hỏi Gia sư AI" để đọc phân tích vì sao mình làm sai từng câu. | `frontend/src/components/SessionResultsModal.tsx` | 🟡 HIGH | Ngày 4 |
| **T-05** | **Tổng kiểm thử trải nghiệm người dùng (UX Audit) và tối ưu hóa Responsive trên Mobile** | *Lý do:* Đảm bảo phòng thi hiển thị mượt mà trên cả máy tính lẫn máy tính bảng của sinh viên. | `frontend/src/` | 🟢 MEDIUM | Ngày 5 |

---

## 5. CẤU TRÚC MÃ NGUỒN CẬP NHẬT SAU SPRINT 3

```text
ExamInTheCloud/
├── backend/
│   ├── terraform/                             # Quản trị hạ tầng đa vùng & đa đám mây (IaC)
│   │   ├── provider.tf                       # Multi-Provider (Singapore ap-southeast-1 & Jakarta ap-southeast-3)
│   │   ├── variables.tf                      # Khai báo GEMINI_API_KEY, UPSTASH_TOKEN, CLOUDFLARE_KEY
│   │   ├── outputs.tf                        # Xuất Endpoint và cấu hình kết nối
│   │   ├── cognito.tf                        # Amazon Cognito User Pool PKCE & RBAC Groups
│   │   ├── dynamodb.tf                       # 4 bảng NoSQL On-Demand (Hỗ trợ Multi-Tenancy)
│   │   ├── dynamodb_global.tf                # [MỚI - Hà] Nhân bản CSDL DynamoDB Global Tables sang Jakarta
│   │   ├── s3.tf                             # S3 Media Bucket (faces/, questions/) & Presigned URL
│   │   ├── s3_crr.tf                         # [MỚI - Hà] S3 Cross-Region Replication sang Jakarta
│   │   ├── api_gateway.tf                    # REST API tập trung, Cognito Authorizer & CORS
│   │   ├── route53.tf                        # [MỚI - Hà] DNS Failover tự động (Zero-ClickOps RTO < 2m)
│   │   ├── cloudfront.tf                     # [MỚI - Hà] CDN toàn cầu & SSL ACM Wildcard
│   │   ├── sqs.tf                            # Hàng đợi đệm nộp bài SQS & DLQ
│   │   ├── lambda.tf                         # Cấu hình 3 hàm Lambda kết nối API ngoài
│   │   ├── iam.tf                            # Phân quyền Least-Privilege an toàn
│   │   ├── cloudwatch.tf                     # Log Groups tập trung & Metric Alarms cảnh báo
│   │   └── budgets.tf                        # [MỚI - Phong] Cấu hình AWS Budgets (ngưỡng 0.50 USD) & Cost Allocation
│   ├── lambda/                               # Xử lý Serverless Đa Đám Mây
│   │   ├── api_handler.py                    # [Cập nhật - Mạnh/Hà] Core CRUD, Tích hợp Google Gemini & Cloudflare
│   │   ├── face_verify_handler.py            # [Phong] Điểm danh AI Rekognition CompareFaces (ngưỡng trên 80%)
│   │   └── grading_worker.py                 # [Cập nhật - Mạnh] Chấm điểm SQS & Đẩy Upstash Redis Leaderboard
│   └── data/                                 # Dữ liệu & Script nạp
│       ├── seed_dynamodb.py                  # Script nạp dữ liệu chuẩn
│       ├── seed_multitenant.py               # [MỚI - Phong] Dữ liệu mẫu phân tách Việt Nam & Lào
│       └── upload_sample_faces.py            # Script nạp ảnh thẻ thật vào S3
├── frontend/                                 # Ứng dụng Web Single Page Application (React 18)
│   ├── src/
│   │   ├── components/
│   │   │   ├── QuestionBankTab.tsx           # [Cập nhật - Tấn] Kéo thả file Word đề thi (Google Gemini)
│   │   │   ├── CandidatesTab.tsx             # Quản lý hồ sơ thí sinh Việt Nam & Lào
│   │   │   ├── ExamSessionTab.tsx            # Quản trị tạo ca thi & sinh link phòng thi
│   │   │   ├── SessionResultsModal.tsx       # [Cập nhật - Tấn] Xem bảng điểm & Hỏi Gia sư AI giải thích
│   │   │   └── ExamRoom.tsx                  # [Cập nhật - Tấn] Webcam, Turnstile Tàng hình & Live Leaderboard
│   │   ├── themes/                           # [Tấn] Dynamic Multi-Country Theme Engine
│   │   │   ├── vn.ts                         # Brand CloudExam Việt Nam (Đỏ - Vàng)
│   │   │   ├── la.ts                         # Brand EduLao Lào (Xanh - Đỏ)
│   │   │   ├── default.ts                    # Theme Chuẩn Quốc Tế (Graceful Fallback)
│   │   │   └── themeContext.tsx              # Context điều phối giao diện
│   │   ├── locales/                          # [Tấn] Đa ngôn ngữ i18n
│   │   │   ├── vi.json                       # Tiếng Việt
│   │   │   ├── la.json                       # Tiếng Lào (ພາສາລາວ)
│   │   │   ├── en.json                       # Tiếng Anh
│   │   │   └── i18nContext.tsx               # Context chuyển đổi ngôn ngữ
│   │   ├── services/
│   │   │   ├── apiService.ts                 # Axios Client gọi API Gateway & đính kèm Tenant ID
│   │   │   └── auth.ts                       # Xác thực Cognito PKCE
│   │   ├── App.tsx                           # Tự động nhận diện tên miền và nạp Theme tương ứng
│   │   └── main.tsx
│   ├── index.html                            # [MỚI - Tấn] Tích hợp script Cloudflare Turnstile
│   └── package.json
├── cloudfront_functions/
│   └── tenant-detector.js                    # [MỚI - Hà] JavaScript tại Edge nhận diện cloudexam.vn vs edulao.la
├── tests/
│   ├── dr_failover_test.sh                   # [MỚI - Hà] Kịch bản kiểm thử chuyển vùng tự động Singapore -> Jakarta
│   └── multi_cloud_test.py                   # [MỚI - Mạnh] Kiểm thử luồng gọi API chéo mây
└── docs/                                     # Tài liệu đồ án
    ├── SPRINT_2_PLAN.md                      # Kế hoạch Sprint 2 (Đã hoàn thành)
    ├── SPRINT_3_PLAN.md                      # [MỚI] Kế hoạch Sprint 3 Đa Đám Mây & Đa Vùng
    ├── finops_report.md                      # [MỚI - Phong] Báo cáo đo đạc chi phí 0 USD Free Tier
    └── architecture_diagram_v2.svg           # Sơ đồ kiến trúc tổng thể
```

---

## 6. LỊCH TRÌNH 5 NGÀY & TIÊU CHÍ NGHIỆM THU (DEFINITION OF DONE)

### 📅 Lịch trình thực hiện (5 Ngày):
* **Ngày 1:** Phong lấy API Key Google/Upstash; Mạnh viết hàm Lambda tích hợp Google Gemini bóc tách file Word; Tấn làm UI kéo thả file; Hà khởi tạo cấu hình DynamoDB Global Tables đa vùng.
* **Ngày 2:** Hà cấu hình S3 CRR và Route 53 DNS Failover; Mạnh nâng cấp xác thực Cloudflare Turnstile trong Lambda; Tấn nhúng widget Turnstile vào `ExamRoom.tsx`; Phong cấu hình CSDL Multi-Tenancy.
* **Ngày 3:** Mạnh tích hợp Upstash Redis vào `grading_worker.py`; Tấn làm Widget Live Leaderboard Top 5 trên phòng thi; Hà viết CloudFront Functions nhận diện tên miền; Phong cài đặt AWS Budgets cảnh báo ngưỡng 0.50 USD.
* **Ngày 4:** Tấn hoàn thiện Dynamic Theme Engine (`cloudexam.vn` vs `edulao.la`) và Modal hỏi Gia sư AI; Mạnh viết API giải thích câu sai; Phong gắn thẻ Cost Allocation Tags; Hà kiểm tra cấu hình Turnstile trên môi trường Live.
* **Ngày 5 (Tổng duyệt Toàn diện):** 
  - Cả nhóm chạy ca thi thử nghiệm: Kéo thả file Word tạo đề thi chuyển sang Đăng nhập phòng thi có Turnstile bảo vệ, Điểm danh AI khuôn mặt, Làm bài thi có Live Leaderboard nhảy điểm, Xem bảng điểm và giải thích câu sai bằng AI, Giả lập đứt mạng Singapore để kiểm chứng Route 53 tự động chuyển sang Jakarta, Trích xuất báo cáo FinOps chứng minh chi phí 0.00 USD.

---

### 🎯 Tiêu chí Hoàn thành Nghiệm thu (Acceptance Criteria):
1. **Số hóa đề thi bằng AI:** Giảng viên tải file `.docx` đề thi lên, hệ thống tự động sinh đúng danh sách câu hỏi trắc nghiệm A-B-C-D lưu vào DynamoDB trong dưới 3 giây qua Google Gemini Flash (chi phí 0 USD).
2. **Chống Bot tàng hình:** Màn hình nộp bài có Cloudflare Turnstile xác thực người thật trong 0.1s ở chế độ nền, chặn đứng 100% request nộp bài rác từ script tự động.
3. **Bảng xếp hạng trực tiếp:** Phòng thi hiển thị Top 5 điểm số nhảy tức thì với độ trễ phản hồi dưới 5ms qua Upstash Redis mà không làm tăng WCU/RCU của DynamoDB.
4. **Đa tên miền & Bản địa hóa:** Truy cập `cloudexam.vn` tự động hiển thị thương hiệu Việt Nam (tiếng Việt); truy cập `edulao.la` tự động chuyển sang thương hiệu EduLao (tiếng Lào); dữ liệu hai bên cô lập an toàn trên cùng backend dùng chung.
5. **Khôi phục Thảm họa Tự động:** Khi giả lập cổng `/health` Singapore gặp sự cố, Route 53 tự động điều hướng sang Jakarta trong dưới 2 phút (Zero-ClickOps), bài thi và dữ liệu của thí sinh được bảo toàn 100%.
6. **Chi phí 0 USD FinOps:** Bảng AWS Budgets và Cost Explorer xác nhận tổng hóa đơn AWS và các đám mây vệ tinh giữ nguyên ở mức **0.00 USD** trong suốt quá trình chạy thử nghiệm.
