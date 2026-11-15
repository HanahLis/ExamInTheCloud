# BÁO CÁO QUẢN TRỊ TÀI CHÍNH ĐÁM MÂY
## Dự án: CloudExam — Hệ Thống Khảo Thí Trực Tuyến Đa Vùng, Đa Đám Mây
### Mục tiêu Ngân sách: 0.00 USD
**Người phụ trách:** Phạm Tuấn Phong — CSDL NoSQL & Quản trị FinOps.
---

## 1. TỔNG QUAN CHIẾN LƯỢC FINOPS

Khác với các hệ thống truyền thống sử dụng máy chủ ảo EC2 (tốn từ 15 – 50 USD/tháng dù không có thí sinh truy cập), CloudExam áp dụng **100% kiến trúc Serverless Event-Driven kết hợp Mô hình Hạt nhân & Vệ tinh (Hub-and-Spoke Multi-Cloud)**.

### Nguyên tắc Vàng của Kiến trúc FinOps CloudExam:
1. **Zero Idle Cost:** Khi không có ca thi, không có bất kỳ container hoặc máy chủ nào chạy ngầm. Chi phí duy trì hệ thống là **đúng 0.00 USD/tháng**.
2. **Khai thác tối đa Hạn mức Always Free:** Ưu tiên các dịch vụ nằm trong danh mục miễn phí vĩnh viễn của AWS (Lambda 1M req, DynamoDB 25GB, Cognito 50K MAU, SQS 1M msg, SNS 1M msg).
3. **Mô hình Vệ tinh Tránh Phí:** Với các dịch vụ AWS tính phí cao (Bedrock AI tính theo token, WAF $5/tháng, ElastiCache $15/tháng), nhóm kết nối thông minh sang các đám mây vệ tinh cung cấp gói miễn phí vĩnh viễn (Google AI Studio, Cloudflare Turnstile, Upstash Redis).
4. **Hàng rào Bảo vệ Ngân sách Tự động (Automated Budget Guardrails):** Cấu hình AWS Budgets cảnh báo ngưỡng 0.50 USD và S3 Lifecycle tự động dọn dẹp ảnh tạm thời sau 24h.

---

## 2. BẢNG ĐỐI CHIẾU HẠN MỨC FREE TIER VÀ MỨC TIÊU THỤ THỰC TẾ

| # | Dịch vụ Đám mây | Nhà cung cấp | Hạn mức Miễn phí (Free Tier) | Mức tiêu thụ Thực tế (Dev, Test tải & Demo) | Chi phí Thực tế |
|:---:|:---|:---:|:---|:---|:---:|
| 1 | **AWS Lambda** (arm64) | AWS | 1,000,000 requests/tháng + 400,000 GB-s | ~50,000 invocations (Core API + Face Verify + Grading Worker) | **$0.00** |
| 2 | **Amazon DynamoDB** | AWS | 25 GB Storage + On-Demand 200M requests | 5 bảng On-Demand ~4.5 MB, ~65,000 reads/writes | **$0.00** |
| 3 | **Amazon Cognito** | AWS | 50,000 MAUs (Monthly Active Users) | ~30 tài khoản kiểm thử Giảng viên, Giám thị & Thí sinh | **$0.00** |
| 4 | **Amazon S3** | AWS | 5 GB Standard Storage + 20,000 GETs | ~65 MB ảnh thẻ sinh trắc học, ảnh câu hỏi & frontend assets | **$0.00** |
| 5 | **Amazon API Gateway** | AWS | 1,000,000 REST API calls/tháng | ~72,000 REST calls qua Cognito Authorizer | **$0.00** |
| 6 | **Amazon Rekognition** | AWS | 5,000 hình ảnh/tháng (12-Month Free) | ~650 lượt quét khuôn mặt điểm danh webcam thực địa & benchmark | **$0.00** |
| 7 | **Amazon SQS & DLQ** | AWS | 1,000,000 messages/tháng | ~2,500 bài nộp đệm bất đồng bộ (bao gồm kiểm thử 500 VUs) | **$0.00** |
| 8 | **AWS Step Functions** | AWS | 4,000 state transitions/tháng | ~120 chu trình điều phối ca thi (Exam Lifecycle v2) | **$0.00** |
| 9 | **Amazon CloudWatch** | AWS | 5 GB Log Ingestion + 10 Alarms | 3 Log Groups (Retention 14 ngày), 4 Alarms hoạt động | **$0.00** |
| 10 | **Amazon SNS** | AWS | 1,000,000 push/email notifications | ~60 email cảnh báo FinOps và báo cáo kết thúc ca thi | **$0.00** |
| 11 | **Google Gemini Flash** | Google Cloud | 1,500 requests/ngày (Free AI Studio) | ~120 lượt bóc tách Word DOCX & trợ lý AI giải thích bài | **$0.00** |
| 12 | **Cloudflare Turnstile** | Cloudflare | Không giới hạn lượt xác thực người thật | ~850 lượt xác thực tàng hình chống bot khi nộp bài | **$0.00** |
| 13 | **Upstash Redis** | Upstash Cloud | 10,000 commands/ngày | ~4,200 lệnh Sorted Set cập nhật Live Leaderboard <5ms | **$0.00** |
| **TỔNG**| **TOÀN BỘ HỆ THỐNG** | **MULTI-CLOUD**| — | — | **0.00 USD** |

---

## 3. CÁC BIỆN PHÁP BẢO VỆ TỰ ĐỘNG ĐÃ TRIỂN KHAI TRONG SOURCE CODE

### 3.1. AWS Budgets & SNS Alert (`backend/terraform/budgets.tf`)
- **Tên Budget:** `cloudexam-monthly-budget-dev`
- **Hạn mức cảnh báo (Threshold Limit):** **0.50 USD**
- **Cơ chế 3 lớp cảnh báo tự động:**
  1. *Cảnh báo 1:* Chi phí thực tế đạt 80% (0.40 USD) -> Bắn SNS Alert và gửi email thông báo.
  2. *Cảnh báo 2:* Chi phí thực tế chạm 100% (0.50 USD) -> Báo động khẩn cấp cho ban quản trị.
  3. *Cảnh báo 3:* Dự báo (Forecasted) có nguy cơ vượt 0.50 USD trong chu kỳ thanh toán.

### 3.2. S3 Lifecycle Rules (`backend/terraform/s3.tf`)
- Thư mục ảnh chụp tạm thời `temp/` tự động hết hạn và xóa vĩnh viễn sau **24 giờ** (`days = 1`).
- Hủy bỏ các phần upload dở dang (Multipart Uploads) sau **1 ngày**, ngăn chặn phát sinh dung lượng rác ngầm.

### 3.3. CloudWatch Log Retention 14 Ngày (`backend/terraform/cloudwatch.tf`)
- Mặc định AWS CloudWatch giữ log vô thời hạn (Never Expire), sau vài tháng sẽ phát sinh phí lưu trữ.
- CloudExam giới hạn cứng thời gian lưu vết của toàn bộ Lambda Log Groups là **14 ngày**, giải phóng dung lượng cũ định kỳ.

### 3.4. Cost Allocation Tags (`backend/terraform/provider.tf`)
Mọi tài nguyên được gắn nhãn đồng bộ phục vụ AWS Cost Explorer:
- `Project`: `CloudExam`
- `Environment`: `dev`
- `ManagedBy`: `Terraform`
- `Tenant`: `MultiTenant`
- `CostCenter`: `FinOps-0USD`

### 3.5. Minh chứng Kiểm toán Chi phí Thực tế từ AWS Console
- **AWS Cost Explorer:** Ghi nhận thực tế toàn bộ các tháng phát triển và kiểm thử tải với tổng chi phí phát sinh là **đúng 0.00 USD** (xem ảnh minh chứng tại `docs/evidence/console_cost_explorer.png` và `docs/report/image19.jpg`).
- **CloudWatch Alarms:** 4 alarms giám sát chi phí và hàng đợi SQS đều duy trì ở trạng thái `OK` xanh lá (xem ảnh minh chứng tại `docs/evidence/console_cloudwatch_alarms.png`).
- **Bài toán Mở rộng (TCO Analysis):** Trong kịch bản tổ chức thi tập trung cho **5.000 thí sinh đồng thời** (đề thi 50 câu, làm trong 45 phút):
  - Phí Lambda Compute: ~$0.42
  - Phí DynamoDB RCU/WCU On-Demand: ~$0.85
  - Phí Amazon SQS (5.000 messages): $0.00 (nằm gọn trong Free Tier 1M)
  - Phí Rekognition (5.000 lượt đối soát): ~$0.00 (Free Tier 5.000 ảnh/tháng) hoặc $1.00 nếu vượt Free Tier
  - **Tổng chi phí ước tính:** Chỉ xấp xỉ **2.35 USD / toàn bộ kỳ thi 5.000 người** (~11.5 VNĐ / thí sinh), tiết kiệm hơn 99.8% so với chi phí in ấn giấy thi truyền thống.

---

## 4. KẾT LUẬN & CAM KẾT NGHIỆM THU

* **Khẳng định về Ngân sách:** Toàn bộ hệ thống CloudExam trong suốt quá trình phát triển, kiểm thử, tích hợp đa đám mây và báo cáo demo trực tiếp trước Hội đồng chấm thi **hoàn toàn nằm trong định mức 0.00 USD**.
* **Tính bền vững (Sustainability):** Thiết kế kiến trúc chứng minh một hệ thống khảo thí hiện đại, bảo mật bằng AI sinh trắc học và có khả năng chống thảm họa đa vùng hoàn toàn có thể vận hành hiệu quả với ngân sách $0 dành cho giáo dục.

