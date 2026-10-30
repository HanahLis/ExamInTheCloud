# KẾ HOẠCH SPRINT 4: HOÀN THIỆN HẠ TẦNG NÂNG CAO, KIỂM THỬ TẢI DỒN DẬP, BẢO MẬT ZERO-TRUST & TỔNG DUYỆT DEMO
## Dự án: CloudExam — Nền Tảng Khảo Thí Trực Tuyến Đa Đám Mây Không Máy Chủ
**Học phần:** Điện toán đám mây (INT3319 1) — Nhóm 14 (VNU-UET)  
**Thời gian thực hiện:** Tuần 9 – Tuần 10  
**Mục tiêu Sprint:** Hoàn thiện 100% tất cả các hạng mục tồn đọng từ Sprint 3, triển khai hạ tầng mạng VPC/PrivateLink & CloudFront OAC, thực hiện kiểm thử tải nộp bài dồn dập (Submission Stampede), rà soát bảo mật toàn diện (Security Audit), tự động hóa CI/CD qua GitHub Actions OIDC và hoàn thiện Slide/Video Demo bảo vệ đồ án.

---

## 1. PHÂN CHIA CÔNG VIỆC TỔNG THỂ (WORK BREAKDOWN STRUCTURE)

| Thành viên phụ trách | Vai trò kỹ thuật chính | Số lượng công việc | Tổng nỗ lực ước tính |
| :--- | :--- | :---: | :---: |
| **1. Nguyễn Thị Ngọc Hà (24020115)** — Nhóm trưởng | Kiến trúc Hạ tầng Mạng VPC, PrivateLink, CloudFront Edge & Security Audit | 3 hạng mục lớn | 32 giờ |
| **2. Trần Đức Mạnh (24021561)** | Tự động hóa CI/CD GitHub Actions OIDC, Step Functions Lifecycle & Email Báo cáo SNS | 2 hạng mục lớn | 30 giờ |
| **3. Phạm Tuấn Phong (24021596)** | Kiểm thử Tải Nộp bài Dồn dập (Submission Stampede) & Thực địa Sinh trắc học AI Rekognition | 2 hạng mục lớn | 32 giờ |
| **4. Nguyễn Phúc Tấn (24021620)** | Hoàn thiện Frontend SPA Multi-Country, Test E2E Phòng thi & Slide/Kịch bản Demo | 2 hạng mục lớn | 30 giờ |

---

## 2. CHI TIẾT KẾ HOẠCH TRIỂN KHAI & PHƯƠNG PHÁP KIỂM THỬ THEO TỪNG THÀNH VIÊN

---

### 👩‍💻 THÀNH VIÊN 1: NGUYỄN THỊ NGỌC HÀ (24020115) — Trưởng nhóm
**Trọng tâm:** Mạng riêng ảo VPC, AWS PrivateLink Interface Endpoint, CloudFront Distribution IaC & Báo cáo Rà soát An ninh (Security Audit).

#### 📌 Công việc 1.1: Khởi tạo AWS PrivateLink cho Rekognition & VPC Subnets cách ly (`backend/terraform/vpc.tf`)
* **Mục tiêu:** Đưa hàm Lambda `face_verify_handler` vào Private Isolated Subnets (không Public IP), kết nối trực tiếp tới Amazon Rekognition qua mạng trục AWS thông qua Interface VPC Endpoint ($0.00 NAT Gateway).
* **Cách triển khai (Implementation):**
  1. Tạo tệp `backend/terraform/vpc.tf`:
     - Khai báo `aws_vpc.main` (CIDR: `10.0.0.0/16`).
     - Khai báo 2 Private Subnets `aws_subnet.private_a` (`10.0.1.0/24`) và `aws_subnet.private_b` (`10.0.2.0/24`) trải dài trên 2 AZs `ap-southeast-1a` và `ap-southeast-1b`.
     - Cấu hình 2 Gateway VPC Endpoints cho Amazon S3 (`com.amazonaws.ap-southeast-1.s3`) và DynamoDB (`com.amazonaws.ap-southeast-1.dynamodb`) gắn vào Route Table của Private Subnets ($0 chi phí).
     - Cấu hình 1 Interface VPC Endpoint (AWS PrivateLink) cho Amazon Rekognition (`com.amazonaws.ap-southeast-1.rekognition`) gắn kèm Security Group cho phép cổng 443 từ dải CIDR của VPC.
  2. Trong `backend/terraform/lambda.tf`: Gắn khối cấu hình `vpc_config` vào `aws_lambda_function.face_verify`.
* **Cách kiểm thử (Testing):**
  - **Backend Test:**
    - Chạy lệnh: `& "C:\msys64\ucrt64\bin\python.exe" tests/test_face_verify.py` để xác nhận toàn bộ 14 ca kiểm thử điểm danh PASS 100%.
    - Kiểm tra CloudWatch Logs của hàm `cloudexam-face-verify-dev`: Xác nhận dòng log `CompareFaces durationMs` dưới 500ms, không có lỗi kết nối mạng.
  - **Frontend Test:**
    - Mở trình duyệt truy cập tab **Phòng thi** (`ExamRoom.tsx`), chọn ca thi và bật webcam điểm danh.
    - Quan sát Network tab: Request `POST /auth/face-verify` trả về mã HTTP `200 OK` trong vòng < 1 giây, trạng thái chuyển sang `CHECKED_IN`.

#### 📌 Công việc 1.2: Phân phối biên CloudFront & Tự động tiêm header Đa thuê bạ (`backend/terraform/cloudfront.tf`)
* **Mục tiêu:** Đóng gói hạ tầng CDN CloudFront, bảo vệ mã nguồn tĩnh React SPA bằng Origin Access Control (OAC) và triển khai hàm CloudFront Function `tenant-detector.js` tiêm header `x-tenant-id`.
* **Cách triển khai (Implementation):**
  1. Tạo tệp `backend/terraform/cloudfront.tf`:
     - Khai báo `aws_cloudfront_origin_access_control.spa_oac` (Signing protocol SigV4).
     - Khai báo `aws_cloudfront_function.tenant_resolver` thực thi mã JavaScript ECMAScript 5.1:
       ```javascript
       function handler(event) {
           var request = event.request;
           var host = request.headers.host ? request.headers.host.value : '';
           if (host.indexOf('edulao.la') !== -1) {
               request.headers['x-tenant-id'] = { value: 'la' };
           } else {
               request.headers['x-tenant-id'] = { value: 'vn' };
           }
           return request;
       }
       ```
     - Khai báo `aws_cloudfront_distribution.spa_distribution` gắn Viewer Request Hook vào hàm trên, trỏ Origin vào S3 Web Hosting Bucket và gắn WAFv2 Web ACL ARN.
* **Cách kiểm thử (Testing):**
  - **Backend Test:**
    - Sử dụng cURL giả lập các header Host khác nhau:
      ```bash
      curl -I -H "Host: edulao.la" https://<cloudfront-domain>/
      curl -I -H "Host: cloudexam.vn" https://<cloudfront-domain>/
      ```
    - Kiểm tra response headers hoặc CloudFront Viewer Request logs ghi nhận đúng `x-tenant-id: la` hoặc `x-tenant-id: vn`.
  - **Frontend Test:**
    - Mở ứng dụng trên trình duyệt: Chuyển đổi tên miền hoặc đổi country toggle ở góc màn hình.
    - Kiểm tra giao diện tự động đổi màu sắc nhận diện (Theme cờ đỏ sao vàng VN vs Theme cờ Lào) và bộ từ điển ngôn ngữ tương ứng mà không cần reload server.

#### 📌 Công việc 1.3: Rà soát An ninh Toàn diện (Security Audit) & Xuất Báo cáo
* **Mục tiêu:** Quét lỗ hổng tĩnh mã nguồn IaC và Python Backend, chứng minh kiến trúc Zero-Trust.
* **Cách triển khai (Implementation):**
  1. Cài đặt và chạy công cụ quét tĩnh:
     - Chạy `tfsec backend/terraform/` quét các vi phạm bảo mật Terraform (KMS, S3 Bucket Policy, WAF).
     - Chạy `bandit -r backend/lambda/` quét các lỗ hổng mã nguồn Python (SQLi, command injection, hardcoded secrets).
  2. Tạo tài liệu `docs/SECURITY_AUDIT_REPORT.md` tổng hợp các chỉ số: 0 lỗ hổng Critical/High, 100% tài nguyên mã hóa SSE-KMS, 100% IAM Roles tuân thủ PoLP.
* **Cách kiểm thử (Testing):**
  - Chạy script kiểm thử an ninh `tests/waf_sqs_test.py` xác nhận tiêu chí AT12 (WAF Rate-based 2000 req/5m, chặn SQLi/XSS) đạt **PASS 100%**.

---

### 👨‍💻 THÀNH VIÊN 2: TRẦN ĐỨC MẠNH (24021561)
**Trọng tâm:** CI/CD GitHub Actions qua OIDC STS, Tự động hóa Vòng đời Ca thi Step Functions & Kênh Thông báo Amazon SNS.

#### 📌 Công việc 2.1: Xây dựng Pipeline CI/CD GitHub Actions qua OIDC STS (`.github/workflows/deploy.yml`)
* **Mục tiêu:** Tự động hóa 100% quy trình kiểm thử và triển khai khi có mã nguồn mới, loại bỏ hoàn toàn việc lưu Access Key tĩnh trên GitHub Secrets (Zero Long-lived Keys).
* **Cách triển khai (Implementation):**
  1. Cấu hình IAM Role OIDC Provider trong `backend/terraform/iam.tf`: Khai báo `aws_iam_openid_connect_provider.github` (`token.actions.githubusercontent.com`) và vai trò `aws_iam_role.github_actions_deploy`.
  2. Khởi tạo tệp `.github/workflows/deploy.yml`:
     - **Job 1 (Test Suite):** Thiết lập Python 3.11, chạy tự động 3 tệp test:
       `python tests/multi_cloud_test.py`  
       `python tests/test_face_verify.py`  
       `python tests/waf_sqs_test.py`
     - **Job 2 (Frontend Build):** Thiết lập Node.js 20, chạy `npm --prefix frontend ci && npm --prefix frontend run build`.
     - **Job 3 (AWS Deploy):** Sử dụng `aws-actions/configure-aws-credentials` qua OIDC ARN, thực thi `terraform plan` và `terraform apply -auto-approve`.
* **Cách kiểm thử (Testing):**
  - **Backend & CI Test:**
    - Tạo nhánh git thử nghiệm `git checkout -b test-ci`, thực hiện một thay đổi nhỏ và push lên GitHub.
    - Vào tab **Actions** trên GitHub: Xác nhận toàn bộ 3 Jobs đều chạy thành công (màu xanh lá 100%), không phát sinh lỗi xác thực IAM OIDC.
  - **Frontend Test:**
    - Kiểm tra tệp build `dist/` được đồng bộ thành công lên S3 WebBucket và CloudFront tự động invalidate cache.

#### 📌 Công việc 2.2: Hoàn thiện Step Functions Auto-Finalize & Gửi Email Báo cáo Bảng điểm qua SNS
* **Mục tiêu:** Đảm bảo khi ca thi kết thúc (`CLOSED`), Step Functions tự động kích hoạt Worker quét các bài thi nháp chưa nộp để chấm bù (Auto-Finalize), sau đó kích hoạt Amazon SNS gửi email bảng điểm tổng kết cho giảng viên.
* **Cách triển khai (Implementation):**
  1. Trong `backend/lambda/api_handler.py`:
     - Hoàn thiện endpoint `POST /sessions/{id}/send-report`: Truy vấn bảng điểm ca thi từ DynamoDB `SessionResultsIndex`, tạo bảng thống kê HTML/Text đẹp mắt (Tổng số thí sinh, Điểm cao nhất, Điểm trung bình, Phổ điểm) và gửi qua lệnh `sns.publish(TopicArn=SNS_TOPIC_ARN)`.
  2. Trong `backend/terraform/step_functions.tf`:
     - Đảm bảo trạng thái cuối cùng của `ExamStateMachine` gọi tác vụ `AutoFinalizeTask` và `SendReportTask`.
* **Cách kiểm thử (Testing):**
  - **Backend Test:**
    - Dùng Python gọi thử nghiệm `POST /sessions/EX-TEST-01/send-report` với token của giảng viên:
      Xác nhận HTTP trả về `200 OK` kèm `messageId` của Amazon SNS.
  - **Frontend Test:**
    - Đăng nhập quyền Giảng viên trên giao diện Web, vào tab **Ca thi** -> Bấm nút **"Xem bảng điểm"** (`SessionResultsModal.tsx`) -> Bấm nút **"Gửi báo cáo Email (Amazon SNS)"**.
    - Kiểm tra thông báo Toast hiển thị thành công: *"Đã gửi email báo cáo tổng hợp ca thi qua Amazon SNS thành công!"*. Hộp thư email đăng ký nhận được thông báo kết quả.

---

### 👨‍💻 THÀNH VIÊN 3: PHẠM TUẤN PHONG (24021596)
**Trọng tâm:** Kiểm thử Tải Dồn dập (Submission Stampede Load Test) & Đánh giá Thực địa Sinh trắc học AI Rekognition.

#### 📌 Công việc 3.1: Xây dựng Kịch bản Kiểm thử Tải Dồn dập (Submission Stampede Load Test)
* **Mục tiêu:** Giả lập 500 – 1.000 thí sinh đồng loạt nhấn nộp bài trong 10 giây cuối cùng của ca thi, chứng minh mẫu hình Queue-Based Load Leveling của Amazon SQS triệt tiêu 100% rủi ro nghẽn CSDL.
* **Cách triển khai (Implementation):**
  1. Tạo tệp kịch bản kiểm thử tải `tests/locustfile.py` (hoặc `tests/load_test_stampede.js` với Artillery):
     - Định nghĩa tác vụ `submit_exam`: Tạo ngẫu nhiên mảng đáp án cho 50 câu hỏi, đính kèm token Turnstile hợp lệ và mã ca thi `SESSION_STAMPEDE_01`.
     - Thiết lập kịch bản dồn tải (Ramp-up): Khởi tạo 500 Virtual Users (VU) trong vòng 10 giây, mỗi VU gửi 1 request nộp bài `POST /exam/submit`.
  2. Chạy thử nghiệm và đo đạc các chỉ số:
     - Tỷ lệ HTTP 200 OK của API Gateway (Mục tiêu: 100%).
     - Thời gian phản hồi xác nhận nộp bài (Mục tiêu: P99 Latency < 50ms).
     - Thời gian hàng đợi SQS tích lũy và tốc độ tiêu thụ theo Batch 10 của Lambda `grading_worker`.
     - Số lượng bài nộp rơi vào Dead-Letter Queue (Mục tiêu: 0 bài).
  3. Xuất kết quả vào tệp báo cáo `docs/SUBMISSION_STAMPEDE_REPORT.md` kèm biểu đồ thông lượng.
* **Cách kiểm thử (Testing):**
  - **Backend Test:**
    - Chạy lệnh: `& "C:\msys64\ucrt64\bin\python.exe" tests/waf_sqs_test.py` (Kịch bản AT08 đo nộp bài đồng thời).
    - Kiểm tra CloudWatch Metrics của SQS: `NumberOfMessagesSent = 500`, `ApproximateNumberOfMessagesVisible` giảm đều về 0 khi Worker xử lý.
  - **Frontend Test:**
    - Mở giao diện phòng thi trên máy tính, thực hiện nộp bài ở giây cuối: Đồng hồ đếm ngược chuyển về 0 -> Hệ thống tự động kích hoạt Auto-Submit -> Màn hình thông báo *"Nộp bài thành công"* hiển thị ngay trong < 100ms.

#### 📌 Công việc 3.2: Kiểm thử Thực địa & Đánh giá Độ chính xác Sinh trắc học Rekognition
* **Mục tiêu:** Đánh giá độ tin cậy của thuật toán so khớp khuôn mặt Amazon Rekognition trong điều kiện thi thực tế bất lợi, tinh chỉnh ngưỡng `SimilarityThreshold = 80.0%`.
* **Cách triển khai (Implementation):**
  1. Xây dựng tệp kiểm thử `tests/rekognition_accuracy_test.py`:
     - Nạp tập dữ liệu 20 ảnh thử nghiệm trong thư mục `backend/data/sample_faces/`: ảnh góc nghiêng 30 độ, ảnh đeo kính, ảnh ánh sáng tối/chói, ảnh in trên giấy A4 (Anti-Spoofing).
     - Đo lường chỉ số chấp nhận sai (False Acceptance Rate - FAR) và từ chối sai (False Rejection Rate - FRR).
  2. Tổng hợp bảng số liệu đối soát vào báo cáo Chương 2.
* **Cách kiểm thử (Testing):**
  - **Backend Test:**
    - Chạy lệnh: `& "C:\msys64\ucrt64\bin\python.exe" tests/test_face_verify.py` xác nhận 14/14 test cases PASS.
  - **Frontend Test:**
    - Thí sinh dùng camera webcam máy tính thật: Đưa ảnh in hoặc mở video trên điện thoại trước webcam -> Hệ thống kích hoạt kiểm tra Face Liveness và từ chối truy cập (HTTP 403 Blocked).
    - Thí sinh thật ngồi thẳng mặt: Điểm danh thành công (Độ khớp > 90%), mở khóa giao diện làm bài thi.

---

### 👨‍💻 THÀNH VIÊN 4: NGUYỄN PHÚC TẤN (24021620)
**Trọng tâm:** Hoàn thiện Frontend SPA Multi-Country, Kiểm thử End-to-End Toàn hệ thống & Slide / Kịch bản Demo Trực tiếp.

#### 📌 Công việc 4.1: Tối ưu Hóa Giao diện Phòng thi & Bản địa hóa Đa ngôn ngữ Hoàn hảo
* **Mục tiêu:** Rà soát và hoàn thiện 100% trải nghiệm người dùng (UX) trên giao diện web, đảm bảo hỗ trợ mượt mà cả câu hỏi trắc nghiệm (A-F) và tự luận (Essay), lưu nháp Local-First 0ms và chuyển ngữ mượt mà.
* **Cách triển khai (Implementation):**
  1. Trong `frontend/src/components/QuestionBankTab.tsx`:
     - Kiểm tra thanh chuyển đổi `📝 Trắc nghiệm (A-F)` và `✍️ Tự luận (Essay)`.
     - Kiểm tra nút xóa ngân hàng `✕`: xác nhận xóa vĩnh viễn trên AWS DynamoDB, không bị lỗi ngân hàng hiện lại nhờ Tombstone Blacklist (`cloudexam_deleted_banks`).
  2. Trong `frontend/src/components/ExamRoom.tsx`:
     - Đảm bảo với câu hỏi tự luận hiển thị ô `textarea` cho thí sinh nhập bài làm, lưu nháp tức thì vào `localStorage`.
     - Hiển thị nhãn trạng thái đồng bộ: *"Đã lưu cục bộ (Local-First 0ms)"* và *"Đã đồng bộ Cloud lúc HH:mm:ss"*.
  3. Hoàn thiện bộ từ điển `frontend/src/locales/`: Rà soát toàn bộ các chuỗi tiếng Việt (`vi.json`), tiếng Lào (`la.json`) và tiếng Anh (`en.json`), đảm bảo không còn chuỗi văn bản nào bị hardcode.
* **Cách kiểm thử (Testing):**
  - **Frontend Test:**
    - Chạy lệnh: `npm --prefix frontend run build` kiểm tra 0 lỗi TypeScript và Vite bundler.
    - Mở trình duyệt tại `http://localhost:5173/`:
      - Thử tạo câu hỏi tự luận -> Lưu vào ngân hàng đề -> Vào phòng thi làm bài tự luận -> F5 tải lại trang -> Bài làm tự luận vẫn được giữ nguyên 100% (Local-First).
      - Thử bấm nút xóa ngân hàng -> Ngân hàng biến mất lập tức trên thanh lọc và dropdown.
      - Chuyển đổi cờ quốc gia (VN / LA / EN) -> Toàn bộ nhãn, tiêu đề, nút bấm đổi ngôn ngữ mượt mà.

#### 📌 Công việc 4.2: Xây dựng Kịch bản Demo Trực tiếp, Slide Bảo vệ & Video Demo Dự phòng
* **Mục tiêu:** Chuẩn bị đầy đủ học liệu bảo vệ đồ án cuối kỳ môn Điện toán đám mây, đảm bảo buổi thuyết trình diễn ra thuyết phục và chuyên nghiệp nhất.
* **Cách triển khai (Implementation):**
  1. Xây dựng **Kịch bản Demo Trực tiếp 5 Bước Vàng (Live Demo Workflow)**:
     - **Bước 1 (Soạn đề AI):** Giảng viên tải file Word đề thi lên -> Google Gemini 1.5 Flash tự động bóc tách thành ngân hàng đề thi trong 2 giây (0 USD chi phí).
     - **Bước 2 (Mở ca thi):** Tạo ca thi và gán thí sinh -> EventBridge / Step Functions tự động kích hoạt ca thi.
     - **Bước 3 (Điểm danh Sinh trắc học):** Thí sinh vào phòng thi -> Bật webcam -> Chụp ảnh S3 Presigned URL -> Amazon Rekognition so khớp ảnh thẻ gốc (Độ khớp > 90%).
     - **Bước 4 (Làm bài thi an toàn):** Thí sinh làm bài trắc nghiệm + tự luận -> Đồng hồ đếm ngược -> Lưu nháp Local-First 0ms -> Backend ẩn đáp án đúng chống F12.
     - **Bước 5 (Nộp bài & Bảng điểm):** Bấm nộp bài qua khiên Turnstile -> SQS Buffer tiếp nhận trong 50ms -> Worker chấm điểm theo Batch 10 -> Giảng viên xem Bảng điểm trực tiếp và xuất CSV.
  2. Thiết kế bộ Slide bảo vệ đồ án (PowerPoint / Canva) gồm 25 slides bám sát đề cương Báo cáo.
  3. Quay video demo dự phòng Full HD 1080p có thuyết minh (thời lượng 7 – 10 phút) phòng sự cố mạng khi bảo vệ.
* **Cách kiểm thử (Testing):**
  - Cả nhóm tổ chức diễn tập thử (Dry Run) toàn bộ quy trình demo trên môi trường Live Cloud, bấm giờ chuẩn 15 phút trình bày.

---

## 3. BẢNG TIẾN ĐỘ THỰC HIỆN THEO NGÀY (SPRINT 4 TIMELINE)

```
Tuần 9:
├─ Ngày 1 - 2: Hoàn thiện vpc.tf, cloudfront.tf (Hà) & deploy.yml CI/CD (Mạnh)
├─ Ngày 3 - 4: Viết kịch bản locustfile.py (Phong) & Rà soát UI Multi-Country (Tấn)
└─ Ngày 5: Chạy kiểm thử tải SQS Stampede & Kiểm tra độ chính xác Rekognition (Phong, Hà)

Tuần 10:
├─ Ngày 6 - 7: Chạy quét bảo mật tfsec/bandit, hoàn thiện SECURITY_AUDIT_REPORT (Hà, Mạnh)
├─ Ngày 8: Tích hợp Step Functions Auto-Finalize & SNS Email Report (Mạnh, Tấn)
├─ Ngày 9: Hoàn thiện Slide bảo vệ & Quay video demo dự phòng 1080p (Tấn, Cả nhóm)
└─ Ngày 10: Tổng diễn tập Demo trực tiếp (Dry Run 15 phút) & Nộp Báo cáo hoàn chỉnh (Cả nhóm)
```

---

## 4. TIÊU CHÍ HOÀN THÀNH SPRINT 4 (DEFINITION OF DONE - DOD)
1. **Kiểm thử tự động:** `multi_cloud_test.py`, `test_face_verify.py` và `waf_sqs_test.py` đạt **100% PASS** (không có ca kiểm thử nào thất bại).
2. **Kiểm thử tải:** Kịch bản nộp bài 500 requests đồng thời đạt tỷ lệ thành công ≥ 99.9%, P99 Latency < 50ms, 0 bài thi rơi vào DLQ.
3. **Mã nguồn:** Toàn bộ mã nguồn backend và frontend được biên dịch sạch sẽ (`npm run build` 0 lỗi), commit và push đồng bộ lên 5 nhánh remote.
4. **Hạ tầng:** Tệp Terraform được định dạng chuẩn (`terraform fmt`), không có cảnh báo bảo mật Critical từ `tfsec`.
5. **Hồ sơ bảo vệ:** Có đầy đủ Slide thuyết trình, Video demo dự phòng và Báo cáo tổng kết đồ án.
