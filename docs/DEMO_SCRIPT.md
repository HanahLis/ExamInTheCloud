# KỊCH BẢN DEMO TRỰC TIẾP & BẢO VỆ ĐỒ ÁN CLOUDEXAM
## (LIVE DEMO WORKFLOW & 15-MINUTE DEFENSE SCRIPT)
### Đồ án: Nền tảng Khảo thí Trực tuyến Không máy chủ & Trí tuệ Nhân tạo Đa Quốc Gia
### Môn học: Điện toán đám mây (INT3319 1) — Nhóm 14 — Trường Đại học Công nghệ, ĐHQGHN (VNU-UET)

---

## 👥 THÔNG TIN PHÂN CÔNG THUYẾT TRÌNH & ĐIỀU PHỐI

| Thành viên | Mã sinh viên | Vai trò trong buổi bảo vệ | Phụ trách trình bày & Thao tác |
| :--- | :---: | :--- | :--- |
| **Nguyễn Tuấn Phong** | **24021598** | Trưởng nhóm / Điều phối viên | Mở đầu, Kiến trúc SQS Buffer, Chấm điểm Worker, Load Test Stampede, FinOps |
| **Nguyễn Phúc Tấn** | **24021620** | Kỹ sư Frontend & Demo Lead | Trực tiếp điều khiển màn hình SPA, Demo 5 Bước Vàng, Local-First, Đa ngôn ngữ |
| **Trần Đức Mạnh** | **24021561** | Kỹ sư DevOps & Tự động hóa | AWS Step Functions, EventBridge Scheduler, SNS Email Bảng điểm, CI/CD OIDC |
| **Hoàng Thu Hà** | **24021488** | Kỹ sư Hạ tầng Mạng & An ninh | Kiến trúc Hub-and-Spoke VPC, CloudFront OAC, AWS WAFv2, Security Audit |

---

## ⏱️ PHÂN BỔ THỜI GIAN BUỔI BẢO VỆ (TỔNG CỘNG: 15 PHÚT)

```
[00:00 - 02:00]  Mở đầu: Đặt vấn đề, Triết lý Thiết kế 0 USD FinOps & Kiến trúc 6 Tầng
[02:00 - 04:30]  BƯỚC 1 (Demo): Soạn đề thi AI bằng Google Gemini 1.5 Flash (0 USD)
[04:30 - 06:30]  BƯỚC 2 (Demo): Khởi tạo Ca thi & Tự động hóa EventBridge / Step Functions
[06:30 - 09:00]  BƯỚC 3 (Demo): Điểm danh Sinh trắc học AWS Rekognition qua Webcam thật
[09:00 - 11:30]  BƯỚC 4 (Demo): Phòng thi An toàn, Local-First 0ms & Live Leaderboard Top 5
[11:30 - 13:45]  BƯỚC 5 (Demo): Nộp bài Bất đồng bộ SQS Stampede & AI Tutor Phân tích
[13:45 - 15:00]  Tổng kết: Bảng nghiệm thu Chỉ số Kỹ thuật, Báo cáo Chi phí & Sẵn sàng Q&A
```

---

## 🛠️ DANH MỤC CHUẨN BỊ TRƯỚC GIỜ G (PRE-DEMO CHECKLIST)

- [ ] **Môi trường Trình duyệt (Chrome / Edge):**
  - Tab 1: Ứng dụng CloudExam SPA (`http://localhost:5173/` hoặc CloudFront URL `https://d3xxxx.cloudfront.net`).
  - Tab 2: AWS Console trang **Amazon SQS** (`CloudExam_ExamSubmissionQueue_dev`) và **DynamoDB** (`CloudExam_Sessions_dev`, `CloudExam_Candidates_dev`).
  - Tab 3: AWS Console trang **AWS Step Functions** (`CloudExam_SessionLifecycle_StateMachine`).
  - Tab 4: Thư mục chứa tệp đề mẫu `tests/data/sample_exam_int3319.docx` và ảnh chân dung thí sinh.
- [ ] **Thiết bị phần cứng:**
  - Webcam laptop hoạt động bình thường, đã cấp quyền camera cho trình duyệt.
  - Kết nối Internet ổn định; chuẩn bị sẵn 1 điện thoại phát Hotspot 4G dự phòng.
- [ ] **Tài liệu sao lưu:**
  - Video Demo Full HD 1080p (thời lượng 8 phút) nằm sẵn trên Desktop.
  - Slide thuyết trình PDF mở sẵn chế độ Fullscreen.

---

## 🎬 KỊCH BẢN CHI TIẾT 5 BƯỚC VÀNG (LIVE DEMO WORKFLOW)

### 🎙️ PHẦN MỞ ĐẦU (00:00 - 02:00) — Trình bày: Phong & Hà

* **Màn hình hiển thị:** Slide 1 - 4 (Tổng quan đề tài & Sơ đồ kiến trúc 6 Tầng).
* **Lời thoại dẫn dắt (Phong):**
  > "Kính thưa Hội đồng, các hệ thống thi trực tuyến truyền thống thường gặp 3 tử huyệt lớn: **Một là**, sập máy chủ do nghẽn nộp bài vào những giây cuối (Submission Stampede); **Hai là**, gian lận thi cử tinh vi như thi hộ, can thiệp mã nguồn; và **Ba là**, chi phí hạ tầng đắt đỏ khi phải duy trì server 24/7.
  > Để giải quyết triệt để bài toán này, Nhóm 14 đã xây dựng **CloudExam** — Nền tảng Khảo thí Trực tuyến Không máy chủ (Serverless), tích hợp Trí tuệ Nhân tạo Đa Đám Mây và hỗ trợ Đa Quốc Gia. Sau đây, bạn Tấn sẽ trực tiếp điều khiển Live Demo hệ thống qua 5 Bước Vàng."

---

### 🌟 BƯỚC 1: SOẠN ĐỀ THI TỰ ĐỘNG BẰNG GOOGLE GEMINI 1.5 FLASH (02:00 - 04:30)
**Người thao tác:** Tấn | **Người thuyết minh:** Tấn & Phong

* **Mục tiêu kỹ thuật:** Chứng minh khả năng bóc tách tệp Word đề thi thực tế (.docx) có cấu trúc phức tạp thành dữ liệu JSON chuẩn trong 2 giây, chi phí **0.00 USD** nhờ Google AI Studio Free Tier.
* **Thao tác trên màn hình (Tấn):**
  1. Đăng nhập với vai trò **Giảng viên (Organizer)**: `PGS. TS. Nguyễn Văn An (GV001)`.
  2. Chọn tab **"Ngân hàng câu hỏi"** (`QuestionBankTab`).
  3. Bấm nút màu tím: **"Nhập từ Word (Gemini AI)"**.
  4. Hộp thoại modal hiện lên: Chọn tệp `sample_exam_int3319.docx` (chứa 10 câu hỏi trắc nghiệm A-D và 2 câu hỏi tự luận).
  5. Bấm nút **"Bắt đầu bóc tách bằng Gemini Flash"**.
* **Hiện tượng trên màn hình:**
  - Hiệu ứng sóng AI chạy trong ~1.8 giây.
  - Toàn bộ danh sách câu hỏi được hiển thị trực quan: Trích xuất chính xác Nội dung câu hỏi, 4 phương án, Đáp án đúng, và Lời giải chi tiết.
  - Hệ thống tự động phân loại: Thẻ màu xanh `[Trắc nghiệm]` và thẻ màu tím `[Tự luận]`.
  - Bấm **"Lưu vào Ngân hàng"** -> Dữ liệu được ghi thẳng vào bảng DynamoDB `CloudExam_Questions_dev`.
* **Lời thoại dẫn dắt (Tấn):**
  > "Như Thầy/Cô đang thấy trên màn hình, thay vì giảng viên phải gõ tay 50 câu hỏi mất hàng giờ, CloudExam tích hợp vệ tinh đa đám mây Google Gemini 1.5 Flash. Tệp Word đề thi được bóc tách chỉ trong chưa đầy 2 giây. Đặc biệt, nhờ tận dụng hạn mức miễn phí 1.500 requests/ngày của Gemini API, chi phí cho phân hệ này là **hoàn toàn 0 USD**!"

---

### 🌟 BƯỚC 2: KHỞI TẠO CA THI & ĐIỀU PHỐI VÒNG ĐỜI BẰNG STEP FUNCTIONS (04:30 - 06:30)
**Người thao tác:** Tấn | **Người thuyết minh:** Mạnh & Hà

* **Mục tiêu kỹ thuật:** Chứng minh cơ chế Event-Driven Serverless: Tự động hóa 100% vòng đời ca thi mà không cần máy chủ cron job chạy ngầm.
* **Thao tác trên màn hình (Tấn & Mạnh):**
  1. Chuyển sang tab **"Ca thi"** (`ExamSessionTab`).
  2. Bấm nút **"Tạo ca thi mới"**:
     - Tên ca thi: `Thi Cuối Kỳ Điện toán đám mây - K66 UET`.
     - Chọn ngân hàng vừa tạo ở Bước 1.
     - Thời lượng: `45 phút`.
     - Chọn danh sách thí sinh dự thi: Gán tài khoản sinh viên `Nguyễn Phúc Tấn (24021620)`.
  3. Bấm **"Lưu ca thi"**.
  4. (Mạnh chuyển sang tab AWS Console): Mở dịch vụ **AWS Step Functions**.
* **Hiện tượng trên màn hình:**
  - Trên SPA: Ca thi xuất hiện ở trạng thái `SCHEDULED` với mã định danh duy nhất (UUIDv4).
  - Trên AWS Console Step Functions: Máy trạng thái `CloudExam_SessionLifecycle_StateMachine` vừa được kích hoạt, chuyển sang trạng thái chờ `WaitForExamStart` ứng với mốc thời gian thi.
* **Lời thoại dẫn dắt (Mạnh):**
  > "Thưa Hội đồng, hệ thống không sử dụng các tiến trình cronjob truyền thống tốn kém tài nguyên. Mỗi ca thi được quản lý bởi một State Machine của AWS Step Functions kết hợp Amazon EventBridge. Khi đến giờ thi, ca thi tự động chuyển `RUNNING`. Khi hết giờ, State Machine tự động gọi Worker quét bài thi chưa nộp để khóa ca (`CLOSED`) và gửi email bảng điểm tổng kết qua Amazon SNS."

---

### 🌟 BƯỚC 3: ĐIỂM DANH SINH TRẮC HỌC AWS REKOGNITION QUA WEBCAM (06:30 - 09:00)
**Người thao tác:** Tấn | **Người thuyết minh:** Phong

* **Mục tiêu kỹ thuật:** Chứng minh tính năng bảo mật định danh Zero-Trust: Ngăn chặn triệt để tình trạng thi hộ bằng thị giác máy tính so khớp 1:1 trong < 800ms.
* **Thao tác trên màn hình (Tấn):**
  1. Bấm nút **"Đổi tài khoản"** ở góc trên bên phải, chuyển sang vai trò **Thí sinh**: `Nguyễn Phúc Tấn (24021620)`.
  2. Vào tab **"Phòng thi"** (`ExamRoom`): Danh sách ca thi hiện lên với thông báo: *"Vui lòng xác thực khuôn mặt trước khi vào bài thi"*.
  3. Bấm nút **"Vào phòng thi"** -> Màn hình điểm danh sinh trắc học xuất hiện.
  4. Bấm **"Bật Camera"**: Khung hình webcam HTML5 hiển thị gương mặt trực tiếp của Tấn.
  5. Thử nghiệm tình huống 1 (Giả lập gian lận): Tấn nghiêng hẳn mặt sang một bên hoặc nhờ bạn bên cạnh ghé mặt vào -> Bấm **"Chụp ảnh & Điểm danh"**.
     - Kết quả: Báo đỏ `Xác thực thất bại! Độ trùng khớp 42.1% < 80.0% (HTTP 403 Forbidden)`.
  6. Thử nghiệm tình huống 2 (Thí sinh thật ngồi thẳng mặt): Bấm **"Chụp ảnh & Điểm danh"**.
* **Hiện tượng trên màn hình:**
  - Ảnh chụp tức thì được đẩy lên S3 qua **Presigned URL** bảo mật (không lộ credentials).
  - AWS Lambda gọi `rekognition:CompareFaces` đối soát với ảnh thẻ gốc lưu sẵn trên S3.
  - Màn hình chuyển xanh lập tức: `Xác thực thành công! Độ trùng khớp 94.8%`.
  - Nút **"Bắt đầu làm bài"** mở khóa mượt mà.
* **Lời thoại dẫn dắt (Phong):**
  > "Thuật toán Rekognition CompareFaces của AWS so khớp 128 vector đặc trưng khuôn mặt với ngưỡng tin cậy 80%. Nhờ cơ chế S3 Presigned URL, ảnh chân dung truyền trực tiếp từ client lên S3 mà không đi vòng qua API Gateway, giảm độ trễ chỉ còn ~650ms và tiết kiệm băng thông tối đa."

---

### 🌟 BƯỚC 4: PHÒNG THI AN TOÀN, LOCAL-FIRST 0MS & BẢNG XẾP HẠNG REAL-TIME (09:00 - 11:30)
**Người thao tác:** Tấn | **Người thuyết minh:** Tấn & Hà

* **Mục tiêu kỹ thuật:** Chứng minh trải nghiệm làm bài thi không độ trễ, khả năng phục hồi dữ liệu khi mất kết nối (Offline-Resilient), và chống rò rỉ đáp án.
* **Thao tác trên màn hình (Tấn & Hà):**
  1. Thí sinh bắt đầu làm bài: Đồng hồ đếm ngược 45:00 bắt đầu chạy.
  2. Chọn đáp án trắc nghiệm câu 1, 2, 3 và nhập nội dung câu tự luận vào ô textarea.
  3. Chỉ vào thanh trạng thái: Hiển thị nhãn **"Đã lưu cục bộ (Local-First 0ms)"** ngay khi gõ từng ký tự.
  4. Cứ mỗi 10 thao tác hoặc 30 giây, nhãn chuyển sang: **"Đã đồng bộ Cloud lúc 14:32:15"**.
  5. **Thao tác ấn tượng (Kiểm thử ngắt mạng):**
     - Mở DevTools (F12) -> Tab Network -> Chuyển sang chế độ **Offline** (hoặc ngắt Wi-Fi).
     - Thí sinh tiếp tục tích chọn các câu còn lại và sửa bài tự luận.
     - F5 tải lại trang -> Toàn bộ bài làm vẫn nguyên vẹn 100% từ LocalStorage!
     - Bật lại Online -> Trạng thái tự động đồng bộ lên DynamoDB trong 0ms.
  6. **Kiểm tra chống gian lận (Inspect F12):**
     - Mở tab Network -> Xem response câu hỏi: Thuộc tính `correctAnswer` và `explanation` hoàn toàn bị loại bỏ khỏi API trả về thí sinh, triệt tiêu nguy cơ dùng F12 hack đáp án.
  7. **Bảng xếp hạng trực tiếp (Live Leaderboard):**
     - Khung bên phải hiển thị Top 5 thí sinh nộp bài sớm nhất cập nhật thời gian thực qua cơ chế Server-Sent Events / Upstash Redis Sorted Sets.
  8. **Đa quốc gia (Multi-Country):**
     - Chuyển đổi cờ quốc gia góc trên sang **Lào (LA)** -> Toàn bộ giao diện chuyển sang tiếng Lào và nhận diện màu cờ Lào.
* **Lời thoại dẫn dắt (Tấn & Hà):**
  > "Mô hình Local-First giúp thí sinh hoàn toàn yên tâm dù mạng phòng thi chập chờn. Dữ liệu được lưu trữ kép: tức thì 0ms trên trình duyệt và định kỳ đồng bộ ngầm lên AWS. Đồng thời, kiến trúc Zero-Trust bảo vệ triệt để tính công bằng của kỳ thi: đáp án đúng tuyệt đối không xuất hiện trên mã nguồn máy khách."

---

### 🌟 BƯỚC 5: NỘP BÀI BẤT ĐỒNG BỘ QUA SQS STAMPEDE & AI TUTOR (11:30 - 13:45)
**Người thao tác:** Tấn | **Người thuyết minh:** Phong & Mạnh

* **Mục tiêu kỹ thuật:** Chứng minh mô hình giải phóng xung tải (Queue-Based Load Leveling) xử lý bài toán nộp bài ồ ạt (Submission Stampede), kết hợp AI Tutor phản hồi học tập cá nhân hóa.
* **Thao tác trên màn hình (Tấn & Phong):**
  1. Thí sinh hoàn thành bài thi -> Bấm nút **"Nộp bài"**.
  2. Hộp thoại xác nhận hiện ra kèm khiên bảo vệ **Cloudflare Turnstile** xác thực người thật.
  3. Bấm **"Xác nhận nộp bài"**.
* **Hiện tượng trên màn hình:**
  - Client nhận thông báo `HTTP 202 Accepted` và màn hình chuyển sang thông báo nộp bài thành công chỉ trong **42ms**.
  - (Phong chuyển sang AWS Console SQS): Hàng đợi `CloudExam_ExamSubmissionQueue_dev` nhận message.
  - Ngay lập tức, `grading_worker.py` Lambda kích hoạt theo Batch Size 10, chấm điểm tự động đối chiếu với đáp án bảo mật lưu trên DynamoDB.
  - Trên màn hình thí sinh: Kết quả chấm điểm xuất hiện trực quan kèm **Phân tích của AI Tutor (Google Gemini)**: Chỉ rõ thí sinh làm tốt phần nào và cần ôn lại kiến thức nào về VPC/IAM.
  - (Tấn đổi lại tài khoản Giảng viên): Vào tab Ca thi bấm **"Bảng điểm"** -> Toàn bộ điểm số, thời gian nộp bài của sinh viên hiển thị đầy đủ, bấm **"Xuất file CSV"** tải về máy trong 1 click.
* **Lời thoại dẫn dắt (Phong):**
  > "Thưa Hội đồng, đây chính là trái tim của kiến trúc CloudExam. Khi 500 hay 1.000 thí sinh nộp bài cùng lúc ở giây cuối, API Gateway không gọi thẳng vào database mà đẩy ngay vào Amazon SQS Standard Queue. Độ trễ ghi nhận chỉ 42ms. Worker phía sau điều hòa lưu lượng chấm theo từng lô, đảm bảo không một bài thi nào bị thất lạc (0% Packet Loss) và cơ sở dữ liệu không bao giờ bị nghẽn."

---

### 🏁 PHẦN TỔNG KẾT & BÁO CÁO FINOPS (13:45 - 15:00) — Trình bày: Toàn nhóm

* **Màn hình hiển thị:** Slide 20 & Slide 25 (Bảng chi phí FinOps $0.00 & Nghiệm thu chỉ số kỹ thuật).
* **Lời thoại tổng kết (Phong):**
  > "Tổng kết lại, CloudExam đã hiện thực hóa trọn vẹn một giải pháp khảo thí đám mây đáp ứng 4 tiêu chí cốt lõi:
  > 1. **Khả năng chịu tải cực hạn:** Đã kiểm thử Locust với 500 người dùng đồng thời, tỷ lệ thành công 100%, P99 Latency < 50ms.
  > 2. **Bảo mật Zero-Trust:** Điểm danh sinh trắc học Rekognition, khiên Cloudflare Turnstile và AWS WAFv2.
  > 3. **Tối ưu chi phí FinOps:** Vận hành toàn bộ hệ thống với chi phí thực tế **0.00 USD** nhờ kiến trúc Serverless Event-Driven và Free Tier Đa Đám Mây.
  > 4. **Tự động hóa hoàn toàn:** 100% hạ tầng mã hóa bằng Terraform và triển khai qua CI/CD GitHub Actions OIDC STS.
  > Nhóm 14 xin chân thành cảm ơn Quý Thầy/Cô trong Hội đồng đã chú ý lắng nghe. Nhóm đã sẵn sàng tiếp nhận các câu hỏi đánh giá!"

---

## 🚨 PHƯƠNG ÁN XỬ LÝ SỰ CỐ DỰ PHÒNG (CONTINGENCY PLAN)

| Tình huống phát sinh | Nguyên nhân khả dĩ | Phương án xử lý ngay lập tức (Dưới 10 giây) |
| :--- | :--- | :--- |
| **Mất kết nối Internet tại phòng thi** | Wi-Fi trường bị chập chờn hoặc quá tải | Tấn chuyển ngay sang Wi-Fi Hotspot 4G phát từ điện thoại cá nhân (đã kết nối sẵn). Nếu mất mạng hoàn toàn, mở Video Demo 1080p có sẵn trên máy. |
| **Trình duyệt chặn Camera Webcam** | Chưa cấp quyền hoặc quyền bị reset | Click vào biểu tượng ổ khóa bên trái thanh địa chỉ URL -> Chọn `Site settings` -> Chuyển `Camera` sang `Allow` -> Nhấn F5 (mất 5s). |
| **Hết Quota Gemini AI Studio** | Vượt ngưỡng 1.500 requests/ngày | Backend `api_handler.py` đã tích hợp sẵn cơ chế **Fallback tự động** sang Local Regex Parser, demo vẫn diễn ra mượt mà không báo lỗi. |
| **AWS Lambda Cold Start gây chậm** | Lambda ngủ đông sau thời gian không dùng | Nhóm đã cấu hình script ping làm ấm (Warm-up ping) chạy trước buổi bảo vệ 5 phút. |

---
*Tài liệu được soạn thảo và kiểm duyệt bởi Nhóm 14 — Đồ án Điện toán đám mây (INT3319 1).*

