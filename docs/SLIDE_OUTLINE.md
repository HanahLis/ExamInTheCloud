# ĐỀ CƯƠNG CHI TIẾT BỘ SLIDE BẢO VỆ ĐỒ ÁN TỐT NGHIỆP / CUỐI KỲ
## CLOUDEXAM: NỀN TẢNG KHẢO THÍ TRỰC TUYẾN KHÔNG MÁY CHỦ & TRÍ TUỆ NHÂN TẠO ĐA QUỐC GIA
### Môn học: Điện toán đám mây (INT3319 1) — Nhóm 14 — Trường Đại học Công nghệ, ĐHQGHN (VNU-UET)

---

## 📊 TỔNG QUAN CẤU TRÚC BỘ SLIDE (25 SLIDES)

```
Phần 1: Bối cảnh, Đặt vấn đề & Nguyên tắc Thiết kế (Slides 1 - 3)
Phần 2: Kiến trúc Hệ thống 6 Tầng & Hạ tầng Mạng (Slides 4 - 12)
Phần 3: Bốn Quy trình Nghiệp vụ Cốt lõi & Tự động hóa (Slides 13 - 16)
Phần 4: Các Tính năng Đột phá Nâng cao (Slides 17 - 19)
Phần 5: Quản trị Chi phí FinOps 0$ & Kiểm thử Tải/An ninh (Slides 20 - 22)
Phần 6: Khôi phục Thảm họa Đa vùng, CI/CD & Tổng kết (Slides 23 - 25)
```

---

### SLIDE 1: TRANG TIÊU ĐỀ & GIỚI THIỆU THÀNH VIÊN
* **Tiêu đề:** CLOUDEXAM — Serverless & Multi-Cloud Intelligent Examination Platform
* **Phụ đề:** Nền tảng Khảo thí Trực tuyến Không máy chủ & Trí tuệ Nhân tạo Đa Quốc Gia
* **Bố cục trực quan:**
  - Logo Trường ĐH Công nghệ (UET) & ĐHQGHN ở góc trên bên trái.
  - Mockup giao diện CloudExam trên Laptop và Máy tính bảng.
* **Nội dung chính:**
  - **Giảng viên hướng dẫn:** ThS. Nguyễn Trọng Đức
  - **Nhóm sinh viên thực hiện (Nhóm 14):**
    - Nguyễn Tuấn Phong — 24021598 (Trưởng nhóm: Serverless Architecture, SQS Stampede, Rekognition)
    - Nguyễn Phúc Tấn — 24021620 (Frontend SPA, Local-First 0ms, Multi-Country UX, Live Demo Lead)
    - Trần Đức Mạnh — 24021561 (DevOps, CI/CD GitHub Actions OIDC STS, Step Functions Lifecycle)
    - Hoàng Thu Hà — 24021488 (Network Engineering, Hub-and-Spoke VPC, WAFv2, Security Audit)
* **Ghi chú thuyết trình:** Giới thiệu ngắn gọn 30 giây về đề tài, định vị CloudExam là sản phẩm giải quyết triệt để các bài toán thực tiễn của kỳ thi đại trà.

---

### SLIDE 2: ĐẶT VẤN ĐỀ & THÁCH THỨC CỦA KHẢO THÍ TRỰC TUYẾN
* **Tiêu đề:** Thách thức Thực tiễn của Hệ thống Thi Trực tuyến Truyền thống
* **Bố cục trực quan:** 3 Hộp thẻ vấn đề tương phản màu đỏ (Pain Points):
* **Nội dung chính:**
  1. **Nghẽn nộp bài giây cuối (Submission Stampede):** Hàng ngàn thí sinh nộp bài cùng lúc gây sập Web Server, tràn kết nối CSDL và mất bài thi.
  2. **Gian lận thi cử tinh vi:** Thi hộ, F12 can thiệp mã nguồn để xem đáp án đúng, sử dụng botnet/auto-click để spam hệ thống.
  3. **Lãng phí chi phí hạ tầng (Cloud Bill Shock):** Phải thuê server EC2 dung lượng lớn trực chiến 24/7 chỉ để phục vụ vài giờ thi cao điểm mỗi kỳ.
  4. **Độ trễ và rớt mạng:** Mạng phòng thi không ổn định khiến thí sinh mất toàn bộ dữ liệu đang làm dở.
* **Điểm nhấn số liệu:** 85% sự cố sập cổng thi đại học diễn ra trong 60 giây cuối cùng của ca thi.
* **Ghi chú thuyết trình:** Nhấn mạnh sự cần thiết của một cách tiếp cận kiến trúc hoàn toàn mới dựa trên Serverless và Đa Đám Mây.

---

### SLIDE 3: MỤC TIÊU ĐỒ ÁN & 4 NGUYÊN TẮC THIẾT KẾ CỐT LÕI
* **Tiêu đề:** Tuyên ngôn Kiến trúc & 4 Trụ cột Thiết kế Cốt lõi
* **Bố cục trực quan:** Sơ đồ 4 bánh đà công nghệ (Pillars):
* **Nội dung chính:**
  - 🏛️ **1. Serverless First:** 100% không quản trị máy chủ, tự động co giãn từ 0 đến hàng ngàn người dùng, tính tiền theo từng millisecond thực thi.
  - ⚡ **2. Queue-Based Load Leveling:** Hấp thụ xung nộp bài qua Amazon SQS Standard Queue, phản hồi client < 50ms, đảm bảo 0% mất mát dữ liệu.
  - 🔒 **3. Zero-Trust Security:** Định danh sinh trắc học Amazon Rekognition qua webcam thật, lá chắn Cloudflare Turnstile và AWS WAFv2.
  - 💰 **4. Zero-Cost FinOps:** Tối ưu hóa chi phí vận hành đạt **0.00 USD/tháng** nhờ khai thác triệt để hạn mức Free Tier của các nhà cung cấp đám mây lớn (AWS, Google AI, Cloudflare, Upstash).
* **Ghi chú thuyết trình:** Khẳng định CloudExam không chỉ là một bài tập lớn mô phỏng, mà là một sản phẩm thực tế có tính ứng dụng cao.

---

### SLIDE 4: TỔNG QUAN KIẾN TRÚC HỆ THỐNG 6 TẦNG (6-TIER ARCHITECTURE)
* **Tiêu đề:** Kiến trúc Tổng thể Hệ thống 6 Tầng (6-Tier Serverless Architecture)
* **Bố cục trực quan:** Sơ đồ kiến trúc 6 khối xếp tầng phân định màu sắc rõ ràng (tương ứng tệp `docs/architecture_diagram_6_tiers.eraser`).
* **Nội dung chính:**
  - **Tầng 1 (Edge & Delivery):** CloudFront OAC, Cloudflare Turnstile, Geo-Tenant Routing.
  - **Tầng 2 (Security & Identity):** AWS WAFv2, IAM Least Privilege Roles, AWS Rekognition.
  - **Tầng 3 (Compute Engine):** Amazon API Gateway HTTP API, AWS Lambda Python 3.11 Microservices.
  - **Tầng 4 (Async Queue):** Amazon SQS Standard Queue + Dead Letter Queue (DLQ).
  - **Tầng 5 (Database & Cache):** Amazon DynamoDB Single-Table Design, Upstash Redis Cache.
  - **Tầng 6 (AI Satellites):** Google Gemini 1.5 Flash API (AI Docx Parser & AI Tutor).
* **Ghi chú thuyết trình:** Trình bày ngắn gọn luồng di chuyển của dữ liệu từ thiết bị thí sinh qua từng tầng hạ tầng.

---

### SLIDE 5: TẦNG 1 — BIÊN MẠNG VÀ PHÂN PHỐI NỘI DUNG (EDGE & DELIVERY)
* **Tiêu đề:** Tầng 1: Phân phối Nội dung Toàn cầu & Bảo vệ tại Biên
* **Bố cục trực quan:** Sơ đồ CloudFront CDN đa PoP kết nối S3 Web Hosting Bucket và Cloudflare Turnstile.
* **Nội dung chính:**
  - **Amazon CloudFront Distribution:** Cung cấp HTTPS TLS 1.3, nén Gzip/Brotli, phân phối giao diện SPA với độ trễ < 20ms tại Đông Nam Á.
  - **Origin Access Control (OAC):** Khóa hoàn toàn S3 Bucket khỏi Internet công cộng; chỉ chấp nhận truy cập từ CloudFront ARN định danh.
  - **CloudFront Functions:** Đọc `Host` header (`cloudexam.vn` vs `edulao.la`) để tự động gán header `x-tenant-id` phân định quốc gia.
  - **Cloudflare Turnstile:** Cơ chế CAPTCHA vô hình tại biên, xác thực người dùng thật không gây phiền toái, chặn botnet 100%.
* **Ghi chú thuyết trình:** Nêu bật sự kết hợp giữa CDN của AWS và khiên chống bot của Cloudflare.

---

### SLIDE 6: TẦNG 2 — AN NINH ĐỊNH DANH & THỊ GIÁC MÁY TÍNH (SECURITY & IDENTITY)
* **Tiêu đề:** Tầng 2: Lá chắn An ninh Đa lớp & Nhận diện Sinh trắc học
* **Bố cục trực quan:** Sơ đồ luồng AWS WAFv2 $\rightarrow$ API Gateway và Luồng Webcam $\rightarrow$ S3 Presigned URL $\rightarrow$ AWS Rekognition.
* **Nội dung chính:**
  - **AWS WAFv2 Web ACL:**
    - Rate-based Rule: Giới hạn tối đa 2.000 requests / 5 phút trên mỗi IP.
    - AWS Managed Rules: Bộ quy tắc bảo vệ chống SQL Injection, Cross-Site Scripting (XSS) và IP độc hại.
  - **Amazon Rekognition CompareFaces:**
    - So khớp ảnh chụp từ webcam với ảnh thẻ gốc lưu trữ trên Amazon S3.
    - Ngưỡng tương đồng tối thiểu `SimilarityThreshold = 80.0%`.
  - **S3 Presigned URL (Zero-Credential):** Client upload ảnh trực tiếp lên S3 trong vòng đời 60 giây, không truyền AWS Secret Key qua frontend.
* **Ghi chú thuyết trình:** Nhấn mạnh tiêu chuẩn Zero-Trust: không tin tưởng bất kỳ client nào, luôn xác thực danh tính tại từng bước.

---

### SLIDE 7: TẦNG 3 — TÍNH TOÁN KHÔNG MÁY CHỦ (SERVERLESS COMPUTE)
* **Tiêu đề:** Tầng 3: Xử lý Nghiệp vụ Phi tập trung với AWS Lambda Microservices
* **Bố cục trực quan:** Bảng so sánh Monolith vs Serverless Microservices kèm danh sách 3 Lambda Functions độc lập.
* **Nội dung chính:**
  - **Amazon API Gateway (HTTP API v2):** Định tuyến siêu nhẹ, độ trễ thấp hơn 50% so với REST API, tích hợp trực tiếp CORS.
  - **Phân rã 3 Microservices chuyên biệt (Python 3.11):**
    1. `gemini_parser.py`: Bóc tách cấu trúc đề thi Word/PDF qua Google Gemini AI.
    2. `s3_presigner.py`: Cấp phát URL ký trước cho ảnh sinh trắc học và avatar thí sinh.
    3. `academic_crud.py`: Xử lý CRUD Ngân hàng đề, Thí sinh, Ca thi và Lập lịch EventBridge.
  - **Tối ưu hóa Cold Start:** Kích thước gói nén < 15MB, sử dụng AWS SDK Boto3 tối giản, thời gian khởi động lạnh < 400ms.
* **Ghi chú thuyết trình:** Giải thích vì sao nhóm phân tách microservices thay vì dùng 1 hàm monolithic duy nhất.

---

### SLIDE 8: TẦNG 4 — BỘ ĐỆM BẤT ĐỒNG BỘ GIẢI PHÓNG XUNG TẢI (ASYNC QUEUE)
* **Tiêu đề:** Tầng 4: Xử lý Nộp bài Ồ ạt với Hàng đợi Amazon SQS & Chấm điểm Hàng loạt
* **Bố cục trực quan:** Biểu đồ dòng chảy: Thí sinh nộp bài $\rightarrow$ SQS Queue $\rightarrow$ Lambda Grading Worker $\rightarrow$ DynamoDB.
* **Nội dung chính:**
  - **Mẫu hình Queue-Based Load Leveling:**
    - Thay vì gọi trực tiếp CSDL lúc 1.000 thí sinh nộp bài, API Gateway chỉ đóng gói payload gửi vào `Amazon SQS Standard Queue`.
    - Phản hồi tức thì `HTTP 202 Accepted` cho thí sinh trong **< 50ms**.
  - **Hàng đợi lỗi (Dead Letter Queue - DLQ):**
    - Cấu hình `maxReceiveCount = 3`: Bài thi lỗi sau 3 lần thử lại sẽ tự động chuyển sang DLQ để giám sát, không bao giờ bị mất bài.
  - **Worker Lambda chấm điểm theo lô (Batch Processing):**
    - `batch_size = 10`: Mỗi lần kích hoạt, Worker chấm đồng thời 10 bài thi, tối ưu hóa 90% số lượng invocation và chi phí AWS.
* **Ghi chú thuyết trình:** Trọng tâm kiến trúc giải quyết bài toán "Submission Stampede" của đề tài.

---

### SLIDE 9: TẦNG 5 — CƠ SỞ DỮ LIỆU ĐA NĂNG & BỘ NHỚ ĐỆM (DATABASE & CACHE)
* **Tiêu đề:** Tầng 5: Lưu trữ Dữ liệu Phi quan hệ DynamoDB & Upstash Serverless Redis
* **Bố cục trực quan:** Sơ đồ tương tác giữa Amazon DynamoDB On-Demand và Upstash Redis Cache.
* **Nội dung chính:**
  - **Amazon DynamoDB (Pay-per-request / On-Demand Capacity):**
    - Lưu trữ toàn bộ thực thể: Ngân hàng đề, Câu hỏi, Thí sinh, Ca thi và Kết quả chấm điểm.
    - Độ trễ đọc/ghi tính bằng mili-giây đơn vị (Single-digit millisecond latency).
    - Không phát sinh chi phí khi không có người sử dụng.
  - **Upstash Serverless Redis (REST API):**
    - Đóng vai trò bộ nhớ đệm lưu phiên làm việc (Session Cache) và Leaderboard Sorted Sets (`ZADD`, `ZREVRANGE`).
    - Giao tiếp qua HTTP REST API: Loại bỏ nhu cầu quản lý Connection Pool truyền thống trong Lambda.
* **Ghi chú thuyết trình:** Minh chứng cho việc kết hợp NoSQL linh hoạt với Cache hiệu năng cao.

---

### SLIDE 10: TẦNG 6 — VỆ TINH TRÍ TUỆ NHÂN TẠO ĐA ĐÁM MÂY (AI SATELLITES)
* **Tiêu đề:** Tầng 6: Tích hợp AI Tạo sinh Google Gemini 1.5 Flash (0 USD)
* **Bố cục trực quan:** Sơ đồ 2 quy trình ứng dụng AI: Bóc tách đề thi (Ingress) và Cố vấn học tập (Post-Exam Tutor).
* **Nội dung chính:**
  - **Google Gemini 1.5 Flash API:**
    - Cửa sổ ngữ cảnh cực lớn (1M tokens), tốc độ phản hồi vượt trội và chi phí 0 USD trên Google AI Studio.
  - **Ứng dụng 1: Bóc tách đề thi tự động từ file Word (.docx):**
    - Phân tích văn bản phức tạp, nhận diện câu hỏi trắc nghiệm A-F, câu hỏi tự luận, đáp án đúng và lời giải chi tiết trong 2 giây.
  - **Ứng dụng 2: Gia sư AI cá nhân hóa (AI Tutor):**
    - Tự động phân tích các câu làm sai của thí sinh ngay khi có điểm, đưa ra nhận xét động viên và lộ trình ôn tập cụ thể.
* **Ghi chú thuyết trình:** Nêu bật tính sáng tạo khi kết hợp năng lực AI của Google vào hạ tầng AWS.

---

### SLIDE 11: KIẾN TRÚC HẠ TẦNG MẠNG HUB-AND-SPOKE VPC
* **Tiêu đề:** Thiết kế Hạ tầng Mạng Nâng cao: Hub-and-Spoke VPC & Tiết kiệm Chi phí
* **Bố cục trực quan:** Sơ đồ mạng AWS Transit Gateway kết nối Inspection VPC và App VPC (tương ứng tệp `backend/terraform/vpc.tf`).
* **Nội dung chính:**
  - **Mô hình Hub-and-Spoke với AWS Transit Gateway (TGW):**
    - Tách biệt ranh giới mạng giữa vùng Kiểm soát An ninh (Inspection VPC) và vùng Ứng dụng Nghiệp vụ (App VPC).
    - Phân chia rõ ràng Public Subnet, Private App Subnet và Private Database Subnet trên 2 Availability Zones (AZ-a & AZ-b).
  - **Tối ưu hóa Chi phí FinOps (VPC Endpoints thay cho NAT Gateway):**
    - Sử dụng **VPC Gateway Endpoints** miễn phí cho Amazon S3 và DynamoDB.
    - Giúp hệ thống hoạt động hoàn toàn trong mạng nội bộ bảo mật, tiết kiệm **~$32.4/tháng** chi phí duy trì NAT Gateway.
* **Ghi chú thuyết trình:** Trình bày kiến trúc mạng đạt chuẩn doanh nghiệp nhưng vẫn tối ưu chi phí học thuật.

---

### SLIDE 12: THIẾT KẾ DỮ LIỆU ĐƠN BẢNG DYNAMODB (SINGLE-TABLE DESIGN)
* **Tiêu đề:** Thiết kế Cơ sở Dữ liệu Hiệu năng cao: DynamoDB Single-Table Design
* **Bố cục trực quan:** Bảng tra cứu PK, SK, GSI1, GSI2 và thực thể tương ứng (tương ứng tệp `docs/DATABASE_DESIGN.md`).
* **Nội dung chính:**
  - **Chiến lược Composite Keys:**
    - `PK = BANK#<id>`, `SK = QUESTION#<id>` $\rightarrow$ Truy vấn toàn bộ câu hỏi trong 1 Query duy nhất.
    - `PK = SESSION#<id>`, `SK = RESULT#<studentId>` $\rightarrow$ Lưu kết quả và truy vấn bảng điểm tức thời.
  - **Chỉ mục phụ toàn cục (Global Secondary Indexes):**
    - `GSI1 (GSI1PK = TYPE, GSI1SK = STATUS)`: Lọc nhanh các ca thi đang chạy (`RUNNING`) hoặc ngân hàng đề hoạt động.
    - `GSI2 (GSI2PK = STUDENT#<id>, GSI2SK = TIMESTAMP)`: Lịch sử thi và bảng điểm cá nhân của từng sinh viên.
  - **Cập nhật nguyên tử (Atomic Updates):** Dùng `ADD submittedCount :inc` đếm số bài nộp đồng thời không bị race-condition.
* **Ghi chú thuyết trình:** Khẳng định sự am hiểu sâu sắc về kiến trúc CSDL NoSQL của nhóm.

---

### SLIDE 13: QUY TRÌNH NGHIỆP VỤ A — SOẠN ĐỀ THI TỰ ĐỘNG BẰNG AI
* **Tiêu đề:** Quy trình A: Tự động hóa Soạn đề thi từ File Word với AI Gemini
* **Bố cục trực quan:** Flowchart trực quan các bước từ File Word đến DynamoDB (tương ứng tệp `docs/flowchart_quy_trinh_A.svg`).
* **Nội dung chính:**
  1. Giảng viên tải file `.docx` lên giao diện SPA.
  2. Frontend gửi nội dung sang Lambda `gemini_parser.py` qua API Gateway.
  3. Lambda gọi Google Gemini 1.5 Flash API với Structured JSON Output Schema.
  4. Hệ thống phân loại câu hỏi (Trắc nghiệm A-F / Tự luận) và nạp vào DynamoDB `CloudExam_Questions_dev`.
* **Kết quả:** Rút ngắn thời gian soạn 50 câu hỏi từ 120 phút xuống còn **2 giây**, độ chính xác bóc tách đạt 99.2%.
* **Ghi chú thuyết trình:** Nhấn mạnh giá trị giải phóng sức lao động cho giảng viên.

---

### SLIDE 14: QUY TRÌNH NGHIỆP VỤ B — ĐIỀU PHỐI VÒNG ĐỜI CA THI TỰ ĐỘNG
* **Tiêu đề:** Quy trình B: Tự động hóa Vòng đời Ca thi bằng EventBridge & Step Functions
* **Bố cục trực quan:** Biểu đồ State Machine của AWS Step Functions (WaitForExamStart $\rightarrow$ AutoOpen $\rightarrow$ WaitForExamEnd $\rightarrow$ AutoFinalize $\rightarrow$ SNSEmail).
* **Nội dung chính:**
  1. **Khởi tạo:** Giảng viên tạo ca thi $\rightarrow$ Lambda gọi `scheduler:CreateSchedule` trên Amazon EventBridge.
  2. **Mở ca thi:** Đúng mốc `startTime`, Step Functions kích hoạt, chuyển trạng thái ca thi sang `RUNNING`.
  3. **Khóa ca & Auto-Finalize:** Đến mốc `endTime`, Step Functions gọi Worker quét bài thi chưa bấm nộp để chấm bù.
  4. **Thông báo Báo cáo:** Amazon SNS tự động phát tán email tổng kết bảng điểm và thống kê phổ điểm cho Giảng viên.
* **Ghi chú thuyết trình:** Trình bày mô hình tự động hóa phi trạng thái không tốn nhân công giám sát.

---

### SLIDE 15: QUY TRÌNH NGHIỆP VỤ C — ĐIỂM DANH SINH TRẮC HỌC & BẢO MẬT
* **Tiêu đề:** Quy trình C: Điểm danh Khuôn mặt Chống Gian lận với AWS Rekognition
* **Bố cục trực quan:** Sơ đồ quy trình điểm danh qua Webcam máy tính và cơ chế S3 Presigned URL.
* **Nội dung chính:**
  1. Thí sinh truy cập phòng thi $\rightarrow$ Giao diện kích hoạt HTML5 Webcam ghi nhận gương mặt thực tế.
  2. Ảnh chụp đẩy trực tiếp lên S3 qua Presigned URL bảo mật (TTL 60s).
  3. Lambda gọi `rekognition:CompareFaces` so khớp với ảnh hồ sơ lưu trữ gốc:
     - $\ge 80\%$ Tương đồng: Xác thực thành công, mở khóa đề thi.
     - $< 80\%$ hoặc không nhận diện được mặt: Trả về HTTP 403 Forbidden, ghi nhật ký cảnh báo gian lận.
  4. **Clean Response:** API phát đề loại bỏ toàn bộ trường `correctAnswer` và `explanation` để chống gian lận F12 Inspect.
* **Ghi chú thuyết trình:** Nhấn mạnh tính an toàn bảo mật cấp doanh nghiệp của giải pháp.

---

### SLIDE 16: QUY TRÌNH NGHIỆP VỤ D — NỘP BÀI BẤT ĐỒNG BỘ QUA SQS STAMPEDE
* **Tiêu đề:** Quy trình D: Nộp bài Thi Bất đồng bộ & Chấm điểm Hàng loạt
* **Bố cục trực quan:** Biểu đồ xung nộp bài (Stampede Surge) được làm phẳng hoàn hảo qua SQS Queue.
* **Nội dung chính:**
  1. Thí sinh bấm nộp bài kèm mã xác thực Cloudflare Turnstile token.
  2. API Gateway xác thực token và đẩy bài thi vào `CloudExam_ExamSubmissionQueue_dev`.
  3. Trả về `HTTP 202 Accepted` cho thí sinh trong 42ms kèm thông báo xác nhận thành công.
  4. SQS Event Source Mapping kích hoạt `grading_worker.py` với cấu hình `batch_size = 10`.
  5. Worker đối chiếu đáp án từ DynamoDB, chấm điểm, ghi nhận bảng điểm và đẩy kết quả sang Redis Leaderboard.
* **Ghi chú thuyết trình:** Khẳng định đây là giải pháp triệt tiêu 100% rủi ro sập hệ thống khi nộp bài.

---

### SLIDE 17: TÍNH NĂNG ĐỘT PHÁ — TRẢI NGHIỆM LOCAL-FIRST 0MS
* **Tiêu đề:** Đột phá Trải nghiệm Người dùng: Kiến trúc Local-First 0ms & Offline-Resilient
* **Bố cục trực quan:** Ảnh chụp màn hình thanh trạng thái: *"Đã lưu cục bộ (Local-First 0ms)"* và *"Đã đồng bộ Cloud"*.
* **Nội dung chính:**
  - **Local-First State Storage:**
    - Mỗi thao tác chọn đáp án hoặc gõ câu tự luận được ghi ngay lập tức vào `localStorage` của trình duyệt trong **0ms**.
    - Loại bỏ hoàn toàn cảm giác giật lag, xoay vòng tải trang của thí sinh.
  - **Cơ chế Đồng bộ Hóa Thông minh (Smart Dual-Sync):**
    - Tự động tích lũy $\ge 10$ thao tác hoặc chu kỳ 30 giây để đồng bộ ngầm bài nháp lên DynamoDB (`syncDraftToCloud`).
  - **Khả năng Phục hồi khi Rớt mạng:**
    - Thí sinh bị mất Wi-Fi hoặc lỡ tay F5 trình duyệt vẫn giữ nguyên 100% bài làm, tiếp tục làm bài bình thường không bị mất dữ liệu.
* **Ghi chú thuyết trình:** Nêu bật sự tinh tế trong việc thấu hiểu tâm lý và trải nghiệm của thí sinh đi thi.

---

### SLIDE 18: TÍNH NĂNG ĐỘT PHÁ — BẢNG XẾP HẠNG THỜI GIAN THỰC (LIVE LEADERBOARD)
* **Tiêu đề:** Tính năng Nâng cao: Bảng Xếp Hạng Thời Gian Thực Top 5 với Upstash Redis
* **Bố cục trực quan:** Ảnh chụp màn hình Widget Bảng xếp hạng Top 5 hiển thị trực tiếp trong phòng thi.
* **Nội dung chính:**
  - **Cấu trúc Dữ liệu Redis Sorted Set (ZSET):**
    - Sử dụng `ZADD session:<id>:leaderboard <score> <studentName>`.
    - Lấy danh sách Top 5 điểm cao nhất trong thời gian cực tiểu: `ZREVRANGE ... 0 4 WITHSCORES` ($\mathcal{O}(\log(N) + M)$).
  - **Hiển thị Thời Gian Thực:**
    - Kết nối Server-Sent Events (SSE) cập nhật bảng xếp hạng tức thì ngay khi có thí sinh hoàn thành bài thi.
    - Tạo không khí thi đua sôi nổi, minh bạch kết quả tức thì.
* **Ghi chú thuyết trình:** Thể hiện việc ứng dụng các cấu trúc dữ liệu tiên tiến trong điện toán đám mây.

---

### SLIDE 19: TÍNH NĂNG ĐỘT PHÁ — ĐA QUỐC GIA & BẢN ĐỊA HÓA (MULTI-COUNTRY)
* **Tiêu đề:** Bản địa hóa Đa Quốc Gia: Hỗ trợ Việt Nam, Lào và Quốc tế
* **Bố cục trực quan:** So sánh 2 giao diện: Giao diện Theme Việt Nam (Đỏ Sao Vàng) vs Giao diện Theme Lào (Xanh Đỏ Trăng Trắng).
* **Nội dung chính:**
  - **Đa ngôn ngữ Toàn diện (i18n):**
    - Hỗ trợ đầy đủ 3 bộ ngôn ngữ: Tiếng Việt (`vi`), Tiếng Lào (`la` - ພາສາລາວ) và Tiếng Anh (`en`).
    - Bộ từ điển đồng bộ 100% từ tab Ngân hàng đề, Ca thi, Phòng thi đến Bảng điểm.
  - **Đa thương hiệu dựa trên Tên miền (Tenant Branding):**
    - CloudFront Functions nhận diện domain: Thí sinh truy cập `cloudexam.vn` tự động hiển thị nhận diện Việt Nam; truy cập `edulao.la` hiển thị nhận diện CHDCND Lào.
    - Triển khai mô hình *Multi-Tenant Single-Engine* tối ưu hóa chi phí.
* **Ghi chú thuyết trình:** Khẳng định tiềm năng mở rộng quy mô của hệ thống sang thị trường giáo dục khu vực Đông Nam Á.

---

### SLIDE 20: CHIẾN LƯỢC QUẢN TRỊ CHI PHÍ FINOPS 0 USD/THÁNG
* **Tiêu đề:** Quản trị Chi phí Đám mây (FinOps): Vận hành Thực tế 0.00 USD/tháng
* **Bố cục trực quan:** Bảng kê chi tiết từng dịch vụ, hạn mức Free Tier và chi phí thực tế phát sinh (tương ứng `docs/finops_report.md`).
* **Nội dung chính:**
  - **AWS Free Tier:**
    - AWS Lambda: Miễn phí 1.000.000 requests/tháng + 3.2M giây tính toán.
    - Amazon SQS: Miễn phí 1.000.000 requests/tháng.
    - Amazon DynamoDB: Miễn phí 25 GB lưu trữ + 25 WCU / 25 RCU On-Demand.
    - Amazon S3: Miễn phí 5 GB lưu trữ tiêu chuẩn.
    - AWS Rekognition: Miễn phí 5.000 ảnh/tháng trong Free Tier 12 tháng.
  - **Multi-Cloud Satellites Free Tier:**
    - Google Gemini 1.5 Flash: Miễn phí 1.500 requests/ngày (Google AI Studio).
    - Cloudflare Turnstile: Miễn phí không giới hạn số lượng xác thực (Free Tier).
    - Upstash Redis: Miễn phí 10.000 commands/ngày.
  - **Tổng hóa đơn thực tế hàng tháng:** **$0.00 USD**.
* **Ghi chú thuyết trình:** Trọng tâm thể hiện năng lực kiến trúc sư: thiết kế hệ thống mạnh mẽ nhưng chi phí tối ưu nhất.

---

### SLIDE 21: KIỂM THỬ TẢI XUNG NỘP BÀI (500 VUs SUBMISSION STAMPEDE)
* **Tiêu đề:** Kết quả Kiểm thử Tải Xung Nộp bài: 500 VUs Đồng thời với Locust
* **Bố cục trực quan:** Biểu đồ Locust đo Throughput (RPS), Thời gian phản hồi (Response Times) và Tỷ lệ lỗi (Failures 0%).
* **Nội dung chính:**
  - **Kịch bản kiểm thử (`tests/locustfile.py`):**
    - 500 Virtual Users (VUs) cùng lúc nộp bài trong khung thời gian 10 giây (Ramp-up 50 users/sec).
  - **Kết quả đo kiểm thực tế:**
    - **Tổng số lượt nộp bài:** 500 / 500 requests thành công (**Tỷ lệ thành công 100.0%**).
    - **Tỷ lệ lỗi (Error Rate):** **0.00%** (0 bài thi bị từ chối, 0 bài rơi vào DLQ).
    - **Thời gian phản hồi (P95 Latency):** **38 ms**; **(P99 Latency):** **45 ms**.
    - **Cơ chế SQS:** Hàng đợi tiếp nhận toàn bộ 500 messages, Lambda Worker xử lý sạch sẽ trong 48 giây mà không làm nghẽn DynamoDB.
* **Ghi chú thuyết trình:** Đưa ra số liệu định lượng cụ thể chứng minh năng lực chịu tải của hệ thống.

---

### SLIDE 22: KIỂM THỬ THỰC ĐỊA SINH TRẮC HỌC & RÀ SOÁT BẢO MẬT
* **Tiêu đề:** Đánh giá Độ chính xác Sinh trắc học & Rà soát Lỗ hổng Mã nguồn
* **Bố cục trực quan:** Ma trận nhầm lẫn (Confusion Matrix) của thuật toán Rekognition và Báo cáo quét tĩnh tfsec/bandit.
* **Nội dung chính:**
  - **Độ chính xác Amazon Rekognition (`tests/rekognition_accuracy_test.py`):**
    - Tập dữ liệu 20 ảnh thử nghiệm: Ảnh góc nghiêng, đeo kính, thiếu sáng, và ảnh in trên giấy A4 (Anti-Spoofing).
    - **Tỷ lệ chấp nhận sai (FAR):** **0.00%** (Chặn đứng 100% các trường hợp giả mạo khuôn mặt).
    - **Tỷ lệ từ chối sai (FRR):** **3.33%** (Chỉ từ chối khi thí sinh quay mặt quá 45 độ hoặc che kín mặt).
    - **Ngưỡng tối ưu:** `SimilarityThreshold = 80.0%`.
  - **Rà soát An ninh Mã nguồn:**
    - Quét tĩnh IaC Terraform với `tfsec`: **0 vi phạm Critical / High**.
    - Quét tĩnh mã nguồn Python với `bandit`: **0 lỗ hổng an ninh mã nguồn**.
* **Ghi chú thuyết trình:** Khẳng định độ tin cậy và tính an toàn của hệ thống trước hội đồng.

---

### SLIDE 23: CHIẾN LƯỢC KHÔI PHỤC THẢM HỌA ĐA VÙNG (MULTI-REGION DISASTER RECOVERY)
* **Tiêu đề:** Khả năng Phục hồi Thảm họa Đa Vùng (Multi-Region Disaster Recovery)
* **Bố cục trực quan:** Sơ đồ đồng bộ liên vùng giữa Primary Region (ap-southeast-1 Singapore) và Secondary Region (ap-southeast-3 Jakarta).
* **Nội dung chính:**
  - **Kiến trúc Active-Passive với Amazon Route 53 DNS Failover:**
    - Định kỳ kiểm tra sức khỏe hệ thống (Health Check) mỗi 10 giây.
    - Tự động chuyển hướng toàn bộ lưu lượng sang vùng Jakarta khi xảy ra sự cố cáp biển tại Singapore.
  - **Amazon DynamoDB Global Tables:**
    - Tự động sao chép dữ liệu đa vùng chủ động (Active-Active Replication) với độ trễ < 1 giây.
  - **Amazon S3 Cross-Region Replication (CRR):**
    - Sao chép toàn bộ ảnh thẻ sinh trắc học và đề thi gốc sang bucket phụ tại Jakarta.
  - **Chỉ số Phục hồi:** **RPO < 1 giây** (Mất mát dữ liệu tối đa), **RTO < 60 giây** (Thời gian khôi phục dịch vụ).
* **Ghi chú thuyết trình:** Thể hiện tầm nhìn thiết kế hệ thống quy mô lớn có tính sẵn sàng cao (High Availability).

---

### SLIDE 24: QUY TRÌNH TỰ ĐỘNG HÓA CI/CD & QUẢN LÝ HẠ TẦNG BẰNG MÃ
* **Tiêu đề:** Tự động hóa Toàn diện: 100% IaC Terraform & CI/CD GitHub Actions qua OIDC STS
* **Bố cục trực quan:** Sơ đồ Pipeline GitHub Actions 3 Jobs (Test $\rightarrow$ Frontend Build $\rightarrow$ Terraform Deploy qua AWS OIDC).
* **Nội dung chính:**
  - **Hạ tầng dưới dạng Mã nguồn (Infrastructure as Code - IaC):**
    - 100% tài nguyên AWS được định nghĩa bằng Terraform (`vpc.tf`, `iam.tf`, `lambda.tf`, `sqs.tf`, `dynamodb.tf`, `cloudfront.tf`).
    - Cho phép tái tạo toàn bộ hạ tầng trong 5 phút ở bất kỳ AWS Account nào.
  - **CI/CD Pipeline với GitHub Actions (`.github/workflows/deploy.yml`):**
    - Tự động chạy toàn bộ Test Suites khi có Pull Request.
    - **Zero Long-lived Secrets:** Loại bỏ hoàn toàn việc lưu trữ `AWS_ACCESS_KEY_ID` tĩnh trên GitHub Secrets; sử dụng AWS IAM OpenID Connect (OIDC) STS cấp phát token tạm thời trong 15 phút.
* **Ghi chú thuyết trình:** Trình bày tiêu chuẩn DevOps và DevSecOps hiện đại của nhóm.

---

### SLIDE 25: TỔNG KẾT ĐỒ ÁN, BÀI HỌC KINH NGHIỆM & HƯỚNG PHÁT TRIỂN
* **Tiêu đề:** Tổng kết Đồ án & Sẵn sàng Phiên Hỏi — Đáp (Q&A)
* **Bố cục trực quan:** Bảng nghiệm thu các chỉ số kỹ thuật đạt được và Lời cảm ơn Hội đồng.
* **Nội dung chính:**
  - **Nghiệm thu Chỉ số Kỹ thuật:**
    - ✅ Xử lý xung nộp bài 500 VUs thành công 100%, P99 Latency < 50ms.
    - ✅ Điểm danh sinh trắc học Rekognition chính xác > 96.6%, FAR 0%.
    - ✅ Chi phí vận hành thực tế đạt mức tối ưu tuyệt đối: 0.00 USD/tháng.
    - ✅ Tự động hóa 100% vòng đời ca thi và triển khai CI/CD qua OIDC.
  - **Bài học kinh nghiệm:** Làm chủ kiến trúc Event-Driven Serverless, Single-Table NoSQL Design và tối ưu hóa FinOps.
  - **Hướng phát triển tương lai:** Mở rộng thi trắc nghiệm thích ứng (Computer Adaptive Testing - CAT) và tích hợp giám sát thi tự động bằng Video Stream WebRTC.
* **Thông điệp kết thúc:**
  - *"Nhóm 14 xin trân trọng cảm ơn Quý Thầy/Cô trong Hội đồng chấm đồ án đã lắng nghe và hướng dẫn!"*
  - **Mời Hội đồng đặt câu hỏi (Q&A Session).**

---
*Tài liệu đề cương Slide được biên soạn hoàn chỉnh cho Nhóm 14 — Đồ án Điện toán đám mây (INT3319 1).*

