# BÁO CÁO TỔNG KẾT ĐỒ ÁN MÔN HỌC ĐIỆN TOÁN ĐÁM MÂY
## HỆ THỐNG KHẢO THÍ TRỰC TUYẾN KHÔNG MÁY CHỦ THẾ HỆ MỚI (CLOUDEXAM)
### Kiến trúc Serverless Event-Driven, Trí tuệ Nhân tạo & Điện toán Đa Đám Mây (Multi-Cloud)

> **Học phần:** Điện toán đám mây (INT3319 1) — Nhóm 14  
> **Khoa Công nghệ Thông tin, Trường Đại học Công nghệ, ĐHQGHN (VNU-UET)**  
> **Giảng viên hướng dẫn:** TS. Nguyễn Ngọc An  
> **Thành viên thực hiện:**
> 1. **Nguyễn Thị Ngọc Hà** (24021516) — *Nhóm trưởng: Kiến trúc Hệ thống, Hạ tầng Terraform IaC, Mạng VPC PrivateLink, An ninh Zero-Trust & FinOps*
> 2. **Trần Đức Mạnh** (24021561) — *Lõi xác thực Cognito PKCE, RBAC 3 Cổng, API Gateway, SQS Queue-Based Load Leveling, Lambda Grading Worker & Điều phối Step Functions v2*
> 3. **Phạm Tuấn Phong** (24021596) — *CSDL DynamoDB On-Demand (5 Bảng), Amazon S3 Media Bucket, Điểm danh AI Rekognition 1:1, Vệ tinh Đa Đám Mây (Gemini Flash, Turnstile, Upstash Redis)*
> 4. **Nguyễn Phúc Tấn** (24021616) — *Frontend SPA (React 19 + TypeScript + Vite + Tailwind CSS), Phòng thi Local-First (0ms lag), Bàn Giám thị Live Proctor, Đa Quốc gia & Đa Ngôn ngữ*
>
> **Tên miền hệ thống triển khai:** [https://cloudexam.id.vn](https://cloudexam.id.vn)  
> **Vùng triển khai chính (Primary AWS Region):** `ap-southeast-1` (Singapore)  
> **Thời gian nghiệm thu:** Tháng 11 năm 2026

---

## MỤC LỤC BÁO CÁO

- [CHƯƠNG 1: ĐẶT VẤN ĐỀ, BỐI CẢNH VÀ MỤC TIÊU ĐỒ ÁN](#chương-1-đặt-vấn-đề-bối-cảnh-và-mục-tiêu-đồ-án)
  - [1.1. Thách thức của các hệ thống khảo thí truyền thống](#11-thách-thức-của-các-hệ-thống-khảo-thí-truyền-thống)
  - [1.2. Mục tiêu nghiên cứu và giải pháp đề xuất của CloudExam](#12-mục-tiêu-nghiên-cứu-và-giải-pháp-đề-xuất-của-cloudexam)
- [CHƯƠNG 2: THIẾT KẾ KIẾN TRÚC HỆ THỐNG CLOUDEXAM](#chương-2-thiết-kế-kiến-trúc-hệ-thống-cloudexam)
  - [2.1. Kiến trúc Tính năng Tổng thể (Master Functional Architecture)](#21-kiến-trúc-tính-năng-tổng-thể-master-functional-architecture)
  - [2.2. Phân hệ Cổng Biên, Đa Quốc Gia & Định danh Tập trung RBAC 3 Nhóm](#22-phân-hệ-cổng-biên-đa-quốc-gia--định-danh-tập-trung-rbac-3-nhóm)
  - [2.3. Phân hệ Quản trị Đề thi & Số hóa Đề bằng AI (Gemini 1.5 Flash + Local Regex Fallback)](#23-phân-hệ-quản-trị-đề-thi--số-hóa-đề-bằng-ai-gemini-15-flash--local-regex-fallback)
  - [2.4. Phân hệ Điểm danh Sinh trắc học AI Rekognition & Khóa Định danh Thiết bị](#24-phân-hệ-điểm-danh-sinh-trắc-học-ai-rekognition--khóa-định-danh-thiết-bị)
  - [2.5. Phân hệ Phòng thi Local-First, Bộ đệm Nộp bài SQS & Chấm lô Bất đồng bộ](#25-phân-hệ-phòng-thi-local-first-bộ-đệm-nộp-bài-sqs--chấm-lô-bất-đồng-bộ)
  - [2.6. Kiến trúc Triển khai Hạ tầng Vật lý AWS (Deployment Architecture)](#26-kiến-trúc-triển-khai-hạ-tầng-vật-lý-aws-deployment-architecture)
- [CHƯƠNG 3: HIỆN THỰC HÓA VÀ KẾT QUẢ THỰC NGHIỆM](#chương-3-hiện-thực-hóa-và-kết-quả-thực-nghiệm)
  - [3.1. Thử nghiệm Tải Dồn dập Nộp bài Giây Cuối (Submission Stampede Benchmark - 500 VUs)](#31-thử-nghiệm-tải-dồn-dập-nộp-bài-giây-cuối-submission-stampede-benchmark---500-vus)
  - [3.2. Giám sát Hàng đợi Amazon SQS & Xử lý Lô Chấm điểm (Batch Processing)](#32-giám-sát-hàng-đợi-amazon-sqs--xử-lý-lô-chấm-điểm-batch-processing)
  - [3.3. Đánh giá Độ chính xác Sinh trắc học Khuôn mặt (ISO/IEC 19795 FAR/FRR)](#33-đánh-giá-độ-chính-xác-sinh-trắc-học-khuôn-mặt-isoiec-19795-farfrr)
  - [3.4. Kiểm thử Chống Gian lận: Khóa Thiết bị & Khiên Bot Cloudflare Turnstile](#34-kiểm-thử-chống-gian-lận-khóa-thiết-bị--khiên-bot-cloudflare-turnstile)
  - [3.5. Kiểm thử Chịu lỗi Mạng: Local-First Engine & Khôi phục Trạng thái F5](#35-kiểm-thử-chịu-lỗi-mạng-local-first-engine--khôi-phục-trạng-thái-f5)
  - [3.6. Bảng Xếp hạng Thời gian Thực với Upstash Serverless Redis (< 5ms)](#36-bảng-xếp-hạng-thời-gian-thực-với-upstash-serverless-redis--5ms)
  - [3.7. Tự động hóa Vòng đời Ca thi bằng AWS Step Functions & Báo cáo SNS](#37-tự-động-hóa-vòng-đời-ca-thi-bằng-aws-step-functions--báo-cáo-sns)
- [CHƯƠNG 4: CHIẾN LƯỢC QUẢN TRỊ TÀI CHÍNH ĐÁM MÂY (FINOPS 0.00 USD)](#chương-4-chiến-lược-quản-trị-tài-chính-đám-mây-finops-000-usd)
  - [4.1. Nguyên lý Thiết kế Zero-Idle Cost](#41-nguyên-lý-thiết-kế-zero-idle-cost)
  - [4.2. Bảng Đối chiếu Hạn mức Free Tier & Minh chứng Tiêu thụ Thực tế](#42-bảng-đối-chiếu-hạn-mức-free-tier--minh-chứng-tiêu-thụ-thực-tế)
  - [4.3. Hàng rào Bảo vệ Ngân sách Tự động (AWS Budgets & CloudWatch Alarms)](#43-hàng-rào-bảo-vệ-ngân-sách-tự-động-aws-budgets--cloudwatch-alarms)
  - [4.4. Phân tích TCO khi Mở rộng Quy mô (5.000 Thí sinh)](#44-phân-tích-tco-khi-mở-rộng-quy-mô-5000-thí-sinh)
- [CHƯƠNG 5: KIỂM TOÁN AN NINH VÀ TUÂN THỦ ZERO-TRUST](#chương-5-kiểm-toán-an-ninh-và-tuân-thủ-zero-trust)
  - [5.1. Tường lửa Ứng dụng Web AWS WAFv2](#51-tường-lửa-ứng-dụng-web-aws-wafv2)
  - [5.2. Mạng Cô lập VPC PrivateLink & Chống Rò rỉ Dữ liệu](#52-mạng-cô-lập-vpc-privatelink--chống-rò-rỉ-dữ-liệu)
  - [5.3. Phân quyền Đặc quyền Tối thiểu (IAM Least Privilege PoLP)](#53-phân-quyền-đặc-quyền-tối-thiểu-iam-least-privilege-polp)
  - [5.4. Che giấu Đáp án Tuyệt đối Chống Kiểm tra Trình duyệt (Anti-F12)](#54-che-giấu-đáp-án-tuyệt-đối-chống-kiểm-tra-trình-duyệt-anti-f12)
- [KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN](#kết-luận-và-hướng-phát-triển)

---

## CHƯƠNG 1: ĐẶT VẤN ĐỀ, BỐI CẢNH VÀ MỤC TIÊU ĐỒ ÁN

### 1.1. Thách thức của các hệ thống khảo thí truyền thống

Các hệ thống thi trực tuyến hiện nay (Moodle, Blackboard, Google Forms...) khi triển khai trên hạ tầng máy chủ truyền thống (Monolith trên VM/EC2) thường đối mặt với 5 điểm nghẽn nghiêm trọng:
1. **Sập hệ thống do xung tải nộp bài giây cuối (Submission Stampede):** Hàng trăm đến hàng ngàn thí sinh giữ bài và đồng loạt nhấn nút nộp bài trong 10-15 giây cuối cùng của ca thi. Việc ghi đồng thời vào CSDL quan hệ (RDBMS) làm cạn kiệt Connection Pool, gây treo nghẽn máy chủ (HTTP 504 Timeout) và làm mất bài thi của thí sinh.
2. **Nguy cơ thi hộ và gian lận danh tính:** Các biện pháp kiểm tra qua mật khẩu thông thường không thể ngăn chặn hành vi chia sẻ tài khoản cho người khác thi hộ hoặc mở đồng thời nhiều cửa sổ trên nhiều thiết bị.
3. **Chi phí duy trì máy chủ đắt đỏ (Idle Cost):** Máy chủ EC2 phải thuê liên tục 24/7 với cấu hình cao để sẵn sàng cho các đợt thi cao điểm, gây lãng phí ngân sách giáo dục khi phần lớn thời gian trong tháng không có ca thi nào diễn ra.
4. **Mất bài thi khi đứt mạng đột ngột:** Mô hình Client-Server truyền thống phụ thuộc hoàn toàn vào kết nối Internet liên tục; một sự cố chập chờn mạng WiFi tại phòng thi sẽ làm mất toàn bộ các câu trả lời chưa kịp lưu của sinh viên.
5. **Năng suất số hóa đề thi thấp:** Giảng viên mất hàng giờ đồng hồ để sao chép thủ công từng câu hỏi, đáp án, hình vẽ từ tệp Word đề thi vào phần mềm quản trị.

### 1.2. Mục tiêu nghiên cứu và giải pháp đề xuất của CloudExam

**CloudExam** được xây dựng nhằm giải quyết triệt để 5 bài toán trên thông qua việc ứng dụng mô hình **Kiến trúc Không máy chủ Hướng sự kiện (Serverless Event-Driven Architecture - EDA)** kết hợp **Mô hình Hạt nhân & Vệ tinh Đa Đám Mây (Hub-and-Spoke Multi-Cloud)**:
- **Tiếp nhận bài thi bằng Amazon SQS (Queue-Based Load Leveling):** Tách rời hoàn toàn quá trình nhận bài (< 50ms) khỏi quá trình chấm điểm, loại bỏ triệt để nguy cơ nghẽn CSDL.
- **Điểm danh sinh trắc học AI Rekognition 1:1:** Đối soát tự động khuôn mặt qua webcam với ảnh thẻ gốc lưu trên S3 với độ chính xác tuyệt đối, kết hợp khóa định danh phần cứng máy tính (`deviceFingerprint`).
- **Số hóa đề thi thông minh bằng AI Tạo sinh:** Tích hợp Google Gemini 1.5 Flash kết hợp bộ phân tích cục bộ Regex NLP Fallback, bóc tách tệp Word `.docx` 50 câu thành dữ liệu JSON chuẩn trong 2 giây.
- **Trải nghiệm phòng thi Local-First:** Lưu vết tức thì từng lựa chọn vào `localStorage` (độ trễ 0ms), khôi phục nguyên vẹn khi F5 hay mất mạng, đồng bộ nền điều tiết (Throttled Cloud Sync).
- **Vận hành ngân sách 0.00 USD (FinOps):** Khai thác 100% hạn mức AWS Free Tier và các dịch vụ đám mây vệ tinh miễn phí vĩnh viễn (Cloudflare Turnstile, Upstash Redis, Google AI Studio).

---

## CHƯƠNG 2: THIẾT KẾ KIẾN TRÚC HỆ THỐNG CLOUDEXAM

### 2.1. Kiến trúc Tính năng Tổng thể (Master Functional Architecture)

Toàn bộ hệ thống CloudExam được phân rã thành các phân hệ nghiệp vụ độc lập nhưng kết nối chặt chẽ theo mô hình Hạt nhân (AWS Core) và Vệ tinh (Multi-Cloud Satellites):

![Hình 2.1: Sơ đồ kiến trúc tính năng tổng thể CloudExam](image16.png)
*Hình 2.1: Sơ đồ kiến trúc tính năng tổng thể CloudExam (Master Functional Architecture).*

Hệ thống được chia thành 3 lớp phân định rõ ràng:
1. **Lớp Ingress & Khách hàng:** Cung cấp trải nghiệm Web SPA hiện đại trên React 19, bảo vệ biên bởi CloudFront OAC, AWS WAFv2 và Cloudflare Turnstile Invisible Challenge.
2. **Lớp Tính toán Không máy chủ (Compute Backbone):** Cụm AWS Lambda chạy kiến trúc Graviton2 (arm64) runtime Python 3.11, xử lý logic REST API, xác thực khuôn mặt và công nhân chấm thi theo lô.
3. **Lớp Lưu trữ Bền vững & Vệ tinh Đa Đám Mây:** 5 bảng DynamoDB On-Demand, Amazon S3 Media Bucket, hàng đợi đệm Amazon SQS + DLQ, máy trạng thái AWS Step Functions và bộ nhớ đệm Upstash Serverless Redis.

---

### 2.2. Phân hệ Cổng Biên, Đa Quốc Gia & Định danh Tập trung RBAC 3 Nhóm

Hệ thống thiết lập 3 cổng đăng nhập và bảng điều khiển hoàn toàn độc lập, đảm bảo nguyên tắc phân quyền đặc quyền tối thiểu (Role-Based Access Control - RBAC):

![Hình 2.2: Phân hệ Cổng Biên, Đa Quốc Gia & Định danh Tập trung](image1.png)
*Hình 2.2a: Phân hệ cổng biên và điều hướng tên miền đa quốc gia.*

![Hình 2.2b: Định danh tập trung Cognito & Phân quyền 3 Cổng](image2.png)
*Hình 2.2b: Luồng xác thực Cognito User Pool PKCE và phân quyền 3 vai trò.*

1. **Cổng Giảng viên / Ban tổ chức (`Organizer`):**
   - Đăng nhập qua Cognito Hosted UI / PKCE Token Portal.
   - Quản trị ngân hàng câu hỏi, bóc tách đề thi Word bằng AI, quản trị hồ sơ thí sinh, tạo ca thi, phân công giám thị và duyệt bảng điểm tổng kết.
2. **Cổng Cán bộ Giám thị coi thi (`Proctor`):**
   - Giao diện **Bàn Giám thị trực tiếp (`LiveProctorDashboard`)**.
   - Giám sát danh sách thí sinh trong ca thi được phân công (`proctorEmails`), phát hiện thí sinh bị khóa thiết bị, thao tác "Mở khóa máy" (`lockedCandidates`), đổi mật khẩu phòng thi khi có sự cố và kích hoạt gửi email báo cáo điểm số ca thi qua Amazon SNS Topic (`cloudexam-exam-reports-dev`).
3. **Cổng Thí sinh (`Candidate`):**
   - Đăng nhập trực tiếp tại cổng phòng thi `CandidateRoomLogin` (`https://cloudexam.id.vn/?exam=<sessionId>`) bằng Email và Mật khẩu phòng thi (hoặc Cognito SSO).
   - Thí sinh bị cô lập tuyệt đối khỏi các API quản trị, chỉ được cấp quyền lấy đề thi sau khi vượt qua bước điểm danh sinh trắc học khuôn mặt.
4. **Hỗ trợ Đa Quốc Gia (Single-Table Multi-Tenancy):**
   - Tự động nhận diện tên miền và áp dụng giao diện thương hiệu cùng ngôn ngữ: Việt Nam (`cloudexam.vn` - cờ đỏ sao vàng), Lào (`edulao.la` - hoa Champa thanh bình), Anh, Đức.

---

### 2.3. Phân hệ Quản trị Đề thi & Số hóa Đề bằng AI (Gemini 1.5 Flash + Local Regex Fallback)

![Hình 2.3: Phân hệ Quản trị Đề thi & Số hóa bằng AI](image3.png)
*Hình 2.3a: Luồng bóc tách đề thi Word bằng Google Gemini 1.5 Flash và Fallback Parser.*

![Hình 2.3b: Tải ảnh minh họa trực tiếp Direct-to-Storage lên S3](image4.png)
*Hình 2.3b: Cấp S3 Presigned URL PUT trực tiếp lên Object Storage.*

- **Số hóa đề thi 2 lớp:** Giảng viên tải tệp Word `.docx` lên hệ thống. Backend `api_handler.py` ưu tiên gửi payload đến Google Gemini 1.5 Flash AI để trích xuất cấu trúc câu hỏi, 4 đáp án và lời giải thích. Nếu môi trường chưa cấu hình Gemini API Key hoặc gặp lỗi mạng, bộ phân tích **Local Regex/Rule-based NLP Fallback** ngay lập tức kích hoạt, tự động nhận dạng định dạng câu hỏi (như đề mẫu `sample_exam_ses101.docx` 50 câu) chỉ trong 2.1 giây mà không phát sinh bất kỳ lỗi nào.
- **Tải ảnh Direct-to-Storage:** Khi câu hỏi cần gắn hình vẽ minh họa, API cấp **S3 Presigned URL (SigV4, TTL 300 giây)**. Trình duyệt tải nhị phân ảnh trực tiếp lên S3, giảm 100% gánh nặng băng thông và CPU của Lambda Core.

---

### 2.4. Phân hệ Điểm danh Sinh trắc học AI Rekognition & Khóa Định danh Thiết bị

![Hình 2.4: Phân hệ Điểm danh Sinh trắc học & Rekognition 1:1](image12.png)
*Hình 2.4a: Luồng đối soát khuôn mặt 1:1 qua Amazon Rekognition.*

![Hình 2.4b: Chi tiết kiểm tra điều kiện ca thi và nạp ảnh thẻ S3](image15.png)
*Hình 2.4b: Quy trình nạp ảnh thẻ gốc và xác thực độ tương đồng.*

- Thí sinh bật camera trên trình duyệt (có hỗ trợ chế độ soi gương Mirror Mode). Ảnh chụp webcam được gửi lên Lambda `face_verify_handler.py`.
- Hàm kiểm tra ca thi đang ở trạng thái `RUNNING`, thí sinh có trong danh sách được phép thi, sau đó nạp ảnh thẻ gốc từ S3 `faces/{studentCode}.jpg` và gọi Amazon Rekognition `compare_faces` với ngưỡng tin cậy **$\ge 80.0\%$**.
- **Khóa thiết bị phần cứng (`deviceFingerprint`):** Ngay khi điểm danh thành công, mã định danh thiết bị của thí sinh được ghi vào trường `lockedCandidates` trong DynamoDB. Nếu phát hiện thí sinh đăng nhập trên thiết bị thứ hai hoặc tài khoản bị chiếm đoạt, hệ thống lập tức khóa quyền làm bài và báo đỏ.

---

### 2.5. Phân hệ Phòng thi Local-First, Bộ đệm Nộp bài SQS & Chấm lô Bất đồng bộ

![Hình 2.5a: Trải nghiệm phòng thi Local-First và Throttled Cloud Sync](image6.png)
*Hình 2.5a: Mô hình Local-First Engine lưu vết tức thì vào localStorage.*

![Hình 2.5b: Hấp thụ xung tải qua Amazon SQS & Chấm lô Lambda Worker](image7.png)
*Hình 2.5b: Đường ống đệm nộp bài SQS và tiêu thụ Batch 10 của Worker.*

![Hình 2.5c: Bảng xếp hạng trực tiếp Upstash Redis và Dead-Letter Queue](image8.png)
*Hình 2.5c: Cập nhật Upstash Redis Sorted Set và cơ chế chịu lỗi DLQ.*

- **Local-First Engine:** Mỗi lần thí sinh chọn một phương án trắc nghiệm, trạng thái được lưu lập tức vào `localStorage` của trình duyệt trong **0ms**. Dữ liệu được đồng bộ nền lên đám mây theo cơ chế tiết lưu (Throttled Sync: mỗi 60 giây hoặc sau 10 câu thay đổi).
- **Bộ đệm nộp bài SQS (Queue-Based Load Leveling):** Khi nộp bài, thí sinh vượt qua xác thực Turnstile chống bot. Lambda Core chỉ thực hiện ghi message bài thi vào hàng đợi **Amazon SQS (`cloudexam-exam-submission-queue-dev`)** và trả về mã HTTP `200 OK` cho thí sinh trong thời gian **$< 50$ mili-giây**.
- **Lambda Grading Worker:** Được kích hoạt theo đợt từ SQS (Batch Size = 10, Batch Window = 2s), đọc đáp án gốc bằng một lệnh DynamoDB duy nhất, tính điểm và ghi kết quả kép (*Dual-Write*) vào bảng Submissions và Sessions, đồng thời cập nhật tức thì lên bảng xếp hạng Upstash Redis qua lệnh `ZADD`.

---

### 2.6. Kiến trúc Triển khai Hạ tầng Vật lý AWS (Deployment Architecture)

Toàn bộ hạ tầng được mã hóa 100% bằng Terraform IaC và triển khai tại Region Singapore (`ap-southeast-1`):

![Hình 2.6: Sơ đồ kiến trúc triển khai hạ tầng AWS](image5.png)
*Hình 2.6: Kiến trúc triển khai hạ tầng vật lý AWS tại Region Singapore (ap-southeast-1).*

Các thành phần hạ tầng cốt lõi:
- **Tên miền & Mạng biên:** Route 53 DNS trỏ tên miền chính thức `cloudexam.id.vn`, cấp chứng chỉ SSL ACM tự động, định tuyến tới CloudFront Distribution (OAC) và API Gateway REST.
- **Mạng riêng ảo VPC & AWS PrivateLink:** Lambda điểm danh khuôn mặt đặt trong Dual-AZ Private Subnets, giao tiếp với DynamoDB, S3 và Rekognition qua VPC Endpoints khép kín, triệt tiêu 100% chi phí NAT Gateway.
- **Tính toán:** AWS Lambda Graviton2 arm64 tối ưu 20% chi phí và hiệu năng.
- **Cơ sở dữ liệu:** 5 bảng DynamoDB On-Demand tự động co giãn.
- **Giám sát & FinOps:** AWS Budgets cảnh báo $0.50, CloudWatch Alarms giám sát SQS Messages, DLQ và tỷ lệ lỗi Lambda.

---

## CHƯƠNG 3: HIỆN THỰC HÓA VÀ KẾT QUẢ THỰC NGHIỆM

### 3.1. Thử nghiệm Tải Dồn dập Nộp bài Giây Cuối (Submission Stampede Benchmark - 500 VUs)

Nhóm thực hiện kịch bản kiểm thử tải mô phỏng thời khắc khắc nghiệt nhất của kỳ thi: **500 thí sinh đồng loạt nhấn nút nộp bài trong 10 giây cuối cùng** thông qua công cụ Locust phân tán (`tests/locustfile.py`):

![Hình 3.1: Kết quả kiểm thử tải 500 VUs dồn dập Locust](image9.png)
*Hình 3.1: Màn hình kết quả kiểm thử tải 500 Virtual Users đồng thời qua script tests/locustfile.py.*

| Chỉ số đo đạc | Kết quả thực tế | Ngưỡng cam kết (SLA) | Đánh giá |
| :--- | :---: | :---: | :---: |
| **Tổng số bài thi gửi đi** | **500 bài** | 500 bài | Hoàn thành 100% |
| **Số bài tiếp nhận thành công** | **500 / 500 (HTTP 200)** | 100% | **ĐẠT (PASS)** |
| **Tỷ lệ thành công (Success Rate)** | **100.00%** | $\ge 99.9\%$ | **ĐẠT (PASS)** |
| **Độ trễ trung bình (Mean Latency)** | **22.06 ms** | $< 30$ ms | **ĐẠT (PASS)** |
| **Độ trễ phân vị P90** | **30.34 ms** | $< 40$ ms | **ĐẠT (PASS)** |
| **Độ trễ phân vị P99 (Critical SLA)** | **42.47 ms** | **$< 50$ ms** | **XUẤT SẮC** |
| **Độ trễ lớn nhất (Max Latency)** | **49.73 ms** | $< 100$ ms | **ĐẠT (PASS)** |
| **Số bài rơi vào Dead-Letter Queue (DLQ)** | **0 bài** | 0 bài | **BẢO TOÀN 100%** |

Kết quả chứng minh hàng đợi Amazon SQS hấp thụ hoàn toàn 100% xung tải, phản hồi xác nhận cho thí sinh chỉ trong 22ms trung bình và phân vị P99 đạt 42.47ms (thấp hơn nhiều so với mục tiêu SLA < 50ms).

---

### 3.2. Giám sát Hàng đợi Amazon SQS & Xử lý Lô Chấm điểm (Batch Processing)

![Hình 3.2: Biểu đồ giám sát hàng đợi Amazon SQS](image10.png)
*Hình 3.2a: Giám sát lưu lượng bài thi trên Amazon SQS Console.*

![Hình 3.3: Đỉnh xung tải SQS Spike & Tốc độ tiêu thụ Worker](image13.png)
*Hình 3.3: Đỉnh xung tải (Spike) khi tiếp nhận 500 bài thi và tốc độ tiêu thụ sạch của Lambda Worker.*

![Hình 3.2b: Hàng đợi lỗi Dead-Letter Queue duy trì mức 0](image11.png)
*Hình 3.2b: Dead-Letter Queue (DLQ) duy trì số lượng message bằng 0, không có bài thi bị lỗi.*

- Ngay khi 500 bài thi đổ dồn dập vào hàng đợi chính, metric *NumberOfMessagesSent* tăng vọt tạo thành đỉnh nhọn (Spike).
- Nhờ cấu hình Event Source Mapping với `BatchSize = 10` và `MaximumBatchingWindowInSeconds = 2`, Lambda `grading_worker` tự động mở rộng và xử lý chính xác **53 batches**, tiêu thụ sạch toàn bộ hàng đợi trong vòng **2.25 giây**.
- Không có bất kỳ message nào gặp lỗi hay bị chuyển vào Dead-Letter Queue (`MessagesInDLQ = 0`).

---

### 3.3. Đánh giá Độ chính xác Sinh trắc học Khuôn mặt (ISO/IEC 19795 FAR/FRR)

Nhóm xây dựng bộ kiểm thử tự động `tests/rekognition_accuracy_test.py` đánh giá thuật toán đối soát khuôn mặt 1:1 theo tiêu chuẩn quốc tế **ISO/IEC 19795** trên 20 tình huống thực tế:

![Hình 3.4: Ma trận nhầm lẫn & Đánh giá Rekognition FAR/FRR](image17.png)
*Hình 3.4: Ma trận nhầm lẫn (Confusion Matrix) và phân bố độ chính xác sinh trắc học Amazon Rekognition.*

![Hình 3.4b: Đồ thị phân tách điểm tương đồng giữa thí sinh thật và giả mạo](image18.png)
*Hình 3.4b: Khoảng cách phân tách an toàn (Safety Margin) giữa thí sinh chính chủ và kẻ thi hộ.*

- **Tỷ lệ chấp nhận sai (False Acceptance Rate - FAR):** **0.00%** (Chặn đứng 100% các trường hợp tráo người thi hộ, sử dụng ảnh in hoặc đưa màn hình điện thoại).
- **Tỷ lệ từ chối sai (False Rejection Rate - FRR):** **0.00%** (Chấp thuận 100% thí sinh chính chủ dù có sự thay đổi nhẹ về góc nghiêng hay đeo kính).
- **Độ chính xác tổng thể (Overall Accuracy):** **100.00%** tại ngưỡng khuyến nghị `SimilarityThreshold = 80.0%`.

---

### 3.4. Kiểm thử Chống Gian lận: Khóa Thiết bị & Khiên Bot Cloudflare Turnstile

![Hình 3.5: Giao diện thực tế đối soát khuôn mặt & Khóa thiết bị](image27.jpg)
*Hình 3.5: Giao diện thí sinh chụp ảnh camera, đối soát thành công và tự động khóa thiết bị.*

- Khi thí sinh chụp ảnh qua webcam, ảnh được gửi lên backend đối soát với ảnh thẻ S3 và trả về kết quả độ trùng khớp (ví dụ: `89.4%`).
- Client tự động gửi kèm mã `deviceFingerprint` để khóa phiên làm bài.
- Thử nghiệm mở cửa sổ ẩn danh thứ hai và nhập cùng tài khoản: Giao diện lập tức bị chặn với thông báo cảnh báo đỏ *"Tài khoản thí sinh đã xác thực danh tính và đang làm bài trên thiết bị khác"*.
- Giám thị tại **Bàn Giám thị (`LiveProctorDashboard`)** có thể theo dõi danh sách máy bị khóa và nhấn nút "Mở khóa máy" khi có sự cố kỹ thuật chính đáng.

---

### 3.5. Kiểm thử Chịu lỗi Mạng: Local-First Engine & Khôi phục Trạng thái F5

![Hình 3.6: Kiểm thử Local-First khôi phục bài thi trong DevTools](image26.jpg)
*Hình 3.6: Kiểm thử ngắt mạng và ấn F5 tải lại trang: Khôi phục nguyên vẹn 100% bài làm từ localStorage trong 1.2ms.*

- **Thử nghiệm ngắt mạng (Network Offline):** Thí sinh đang làm bài, ngắt kết nối mạng WiFi hoàn toàn trong DevTools. Thí sinh tiếp tục trả lời các câu hỏi tiếp theo; nhãn trạng thái chuyển thành *"Đã lưu cục bộ"*.
- **Thử nghiệm tải lại trang (F5 Refresh):** Nhấn F5 làm mới trình duyệt khi không có mạng. Ứng dụng đọc lại dữ liệu từ `localStorage` trong **1.2 mili-giây**, nạp lại chính xác toàn bộ các phương án đã chọn và vị trí câu hỏi đang làm dở.
- **Thử nghiệm có mạng trở lại (Online Sync):** Bật mạng lại, hệ thống tự động nhận diện và kích hoạt Throttled Cloud Sync, đẩy toàn bộ dữ liệu lên DynamoDB an toàn.

---

### 3.6. Bảng Xếp hạng Thời gian Thực với Upstash Serverless Redis (< 5ms)

![Hình 3.7: Bảng xếp hạng trực tiếp Live Leaderboard với Upstash Redis](image24.jpg)
*Hình 3.7: Bảng xếp hạng trực tiếp trong phòng thi cập nhật tức thì với độ trễ < 5ms.*

- Ngay khi Lambda Grading Worker chấm xong một bài thi, điểm số được ghi thẳng vào Upstash Redis Sorted Set qua lệnh `ZADD session:{id}:leaderboard {score} {candidateName}`.
- Giao diện phòng thi và Bàn Giám thị hiển thị widget bảng xếp hạng trực tiếp Top 5 dẫn đầu và thứ hạng cá nhân của thí sinh.
- Toàn bộ các yêu cầu tra cứu bảng xếp hạng được phục vụ trực tiếp từ bộ nhớ RAM của Redis với độ trễ **$< 5$ mili-giây**, không phát sinh thêm bất kỳ lượt đọc (RCU) nào lên DynamoDB.

---

### 3.7. Tự động hóa Vòng đời Ca thi bằng AWS Step Functions & Báo cáo SNS

![Hình 3.8a: Máy trạng thái AWS Step Functions điều phối vòng đời ca thi](image21.png)
*Hình 3.8a: Cấu trúc đồ thị máy trạng thái AWS Step Functions (Exam Lifecycle v2).*

![Hình 3.8b: Chi tiết các bước Wait Until End Time và Auto-Finalize](image22.png)
*Hình 3.8b: Luồng chờ đến giờ kết thúc ca thi và tự động khóa phòng.*

![Hình 3.8c: Quét bài thi nháp và chấm bù tự động](image23.png)
*Hình 3.8c: Quét các bài thi nháp chưa kịp nộp để tự động chấm điểm.*

![Hình 3.8d: Phát hành báo cáo tổng kết qua Amazon SNS Topic](image25.png)
*Hình 3.8d: Gửi email tổng kết phổ điểm tới Giảng viên và Giám thị qua Amazon SNS.*

- Máy trạng thái `cloudexam-exam-lifecycle-v2-dev` tiếp nhận lệnh khi ca thi bắt đầu.
- Trạng thái `WaitUntilEndTime` tự động đưa execution vào giấc ngủ cho đến đúng mốc thời gian kết thúc (`endTime`), không tốn chi phí CPU.
- Khi hết giờ thi, máy trạng thái tự động chuyển trạng thái ca thi sang `COMPLETED`, quét toàn bộ các bản ghi bài thi nháp lưu trong DynamoDB để chấm bù cho thí sinh quên bấm nộp bài.
- Bước cuối cùng tổng hợp phổ điểm ca thi (điểm cao nhất, điểm trung bình, số lượng bài thi) và gửi báo cáo thông báo tức thì qua **Amazon SNS Topic (`cloudexam-exam-reports-dev`)** đến email của Giám thị và Giảng viên phụ trách.

---

## CHƯƠNG 4: CHIẾN LƯỢC QUẢN TRỊ TÀI CHÍNH ĐÁM MÂY (FINOPS 0.00 USD)

### 4.1. Nguyên lý Thiết kế Zero-Idle Cost

Hệ thống CloudExam được thiết kế triệt để theo tôn chỉ **Zero-Cost Cloud Architecture**:
1. **Không duy trì máy chủ chạy ngầm:** Khi không có ca thi, số lượng container và VM chạy ngầm bằng đúng 0.
2. **Khai thác tối đa gói Always Free của AWS:** Sử dụng Lambda (1 triệu lượt gọi/tháng), DynamoDB On-Demand (25GB lưu trữ), Cognito (50.000 MAU), SQS (1 triệu tin nhắn/tháng).
3. **Mô hình Vệ tinh Tránh Phí:** Kết nối sang các dịch vụ miễn phí vĩnh viễn ở các đám mây khác (Google AI Studio 1.500 req/ngày, Cloudflare Turnstile miễn phí không giới hạn, Upstash Redis 10.000 lệnh/ngày) thay vì dùng các dịch vụ đắt tiền trên AWS như Bedrock hay ElastiCache.

---

### 4.2. Bảng Đối chiếu Hạn mức Free Tier & Minh chứng Tiêu thụ Thực tế

![Hình 4.1: Bằng chứng Quản trị Tài chính FinOps trên AWS Cost Explorer](image19.jpg)
*Hình 4.1: Bằng chứng thực tế trên AWS Cost Explorer: Tổng chi phí toàn bộ các tháng phát triển và kiểm thử là đúng 0.00 USD.*

| Dịch vụ Đám mây | Nhà cung cấp | Hạn mức Miễn phí (Free Tier) | Tiêu thụ Thực tế (Dev, Test & Demo) | Chi phí Thực tế |
| :--- | :--- | :--- | :--- | :---: |
| **AWS Lambda** (arm64) | AWS | 1.000.000 requests/tháng + 400.000 GB-s | ~50.000 invocations | **$0.00** |
| **Amazon DynamoDB** | AWS | 25 GB Storage + 200M requests On-Demand | 5 bảng ~4.5 MB, ~65.000 requests | **$0.00** |
| **Amazon Cognito** | AWS | 50.000 MAUs | ~30 tài khoản kiểm thử | **$0.00** |
| **Amazon S3** | AWS | 5 GB Standard Storage + 20.000 GETs | ~65 MB dữ liệu & ảnh thẻ | **$0.00** |
| **Amazon API Gateway** | AWS | 1.000.000 REST calls/tháng | ~72.000 REST calls | **$0.00** |
| **Amazon Rekognition** | AWS | 5.000 ảnh/tháng (12 tháng đầu) | ~650 lượt quét khuôn mặt | **$0.00** |
| **Amazon SQS & DLQ** | AWS | 1.000.000 messages/tháng | ~2.500 messages | **$0.00** |
| **AWS Step Functions** | AWS | 4.000 state transitions/tháng | ~120 executions | **$0.00** |
| **Amazon CloudWatch** | AWS | 5 GB Log Ingestion + 10 Alarms | 3 Log Groups (Retention 14 ngày), 4 Alarms | **$0.00** |
| **Amazon SNS** | AWS | 1.000.000 push/email notifications | ~60 email cảnh báo & báo cáo ca thi | **$0.00** |
| **Google Gemini Flash** | Google Cloud | 1.500 requests/ngày (Google AI Studio) | ~120 lượt bóc tách Word DOCX | **$0.00** |
| **Cloudflare Turnstile** | Cloudflare | Không giới hạn lượt xác thực | ~850 lượt chống bot nộp bài | **$0.00** |
| **Upstash Redis** | Upstash | 10.000 commands/ngày | ~4.200 lệnh ZADD / ZREVRANGE | **$0.00** |
| **TỔNG CHI PHÍ** | **MULTI-CLOUD** | — | — | **0.00 USD** |

---

### 4.3. Hàng rào Bảo vệ Ngân sách Tự động (AWS Budgets & CloudWatch Alarms)

![Hình 4.2: Thiết lập giám sát ngân sách AWS Budgets $0.50](image20.png)
*Hình 4.2: Hàng rào cảnh báo ngân sách AWS Budgets với ngưỡng kích hoạt 0.50 USD.*

- **AWS Budgets:** Thiết lập ngân sách cứng `cloudexam-monthly-budget-dev` tại ngưỡng **0.50 USD**. Hệ thống tự động gửi email cảnh báo đa tầng khi chi phí thực tế đạt 80% ($0.40), đạt 100% ($0.50) hoặc khi dự báo cuối tháng có nguy cơ vượt ngưỡng.
- **S3 Lifecycle:** Xóa vĩnh viễn ảnh tạm webcam tại thư mục `temp/` sau 24 giờ và hủy các tệp multipart upload dở dang sau 1 ngày.
- **CloudWatch Retention:** Giới hạn thời gian lưu trữ log của toàn bộ các Lambda functions là **14 ngày**, ngăn ngừa chi phí lưu log tích lũy âm thầm theo thời gian.

---

### 4.4. Phân tích TCO khi Mở rộng Quy mô (5.000 Thí sinh)

Dựa trên công cụ tính toán chính thức AWS Pricing Calculator, nhóm lập bảng phân tích tổng chi phí sở hữu (Total Cost of Ownership - TCO) cho một kỳ thi quốc gia quy mô **5.000 thí sinh thi đồng thời** (đề thi 50 câu, làm trong 45 phút):
- **Lambda Compute (API + Worker):** ~$0.42
- **DynamoDB On-Demand Reads/Writes:** ~$0.85
- **Amazon SQS Ingestion (5.000 messages):** $0.00 (nằm trọn trong Free Tier)
- **Amazon Rekognition (5.000 ảnh):** $0.00 (trong Free Tier tháng đầu) hoặc $1.00
- **Upstash Redis + Cloudflare Turnstile:** $0.00
- **Tổng chi phí toàn bộ kỳ thi 5.000 người:** **~2.35 USD** (~59.000 VNĐ, tức chỉ **~11.8 VNĐ / thí sinh**).

---

## CHƯƠNG 5: KIỂM TOÁN AN NINH VÀ TUÂN THỦ ZERO-TRUST

### 5.1. Tường lửa Ứng dụng Web AWS WAFv2

- Triển khai **AWS WAFv2 Web ACL** gắn trực tiếp vào API Gateway REST API.
- **Rate-Based Rule:** Giới hạn mỗi IP không quá 2.000 requests / 5 phút (hỗ trợ kiểm thử ngưỡng 100 req/min). Toàn bộ các yêu cầu vượt ngưỡng bị chặn với mã `HTTP 403 Forbidden`.
- **AWS Managed Rule Sets:** Kích hoạt `AWSManagedRulesSQLiRuleSet` chống SQL Injection và `AWSManagedRulesCommonRuleSet` chống tấn công XSS, Path Traversal và HTTP Smuggling.

---

### 5.2. Mạng Cô lập VPC PrivateLink & Chống Rò rỉ Dữ liệu

- Hàm Lambda xác thực khuôn mặt sinh trắc học `face_verify_handler.py` được triển khai trong **2 Private Isolated Subnets** (`10.0.1.0/24` và `10.0.2.0/24`), không gắn Internet Gateway hay gán địa chỉ IP công cộng.
- Kết nối tới DynamoDB và S3 qua **Gateway VPC Endpoints ($0.00)** gắn trên bảng định tuyến nội bộ.
- Kết nối tới Amazon Rekognition qua **Interface VPC Endpoint (AWS PrivateLink)** qua cổng HTTPS 443 khép kín trong mạng trục AWS, loại bỏ hoàn toàn chi phí đắt đỏ của NAT Gateway.

---

### 5.3. Phân quyền Đặc quyền Tối thiểu (IAM Least Privilege PoLP)

Toàn bộ các IAM Roles của hệ thống được giới hạn tài nguyên cụ thể (Resource ARN) và hành động tối thiểu:
- `cloudexam-role-lambda-face-verify-dev`: Chỉ có quyền `rekognition:CompareFaces`, `s3:GetObject` trên thư mục `faces/*`, `dynamodb:GetItem` trên bảng Candidates & Sessions. Không có quyền sửa xóa CSDL.
- `cloudexam-role-lambda-core-api-dev`: Giới hạn quyền trên đúng 5 bảng DynamoDB định danh, quyền gửi SQS URL cụ thể và quyền `sns:Publish` trên Topic báo cáo ca thi.
- `cloudexam-role-lambda-grading-worker-dev`: Chỉ có quyền nhận/xóa message trên hàng đợi SQS và ghi kết quả vào bảng Submissions & Sessions.
- `cloudexam-role-sfn-lifecycle-dev`: Chỉ được cập nhật trạng thái ca thi và gửi thông báo SNS.

---

### 5.4. Che giấu Đáp án Tuyệt đối Chống Kiểm tra Trình duyệt (Anti-F12)

- Trong toàn bộ quá trình thí sinh làm bài, endpoint `GET /sessions/{id}/exam-paper` được backend lọc bỏ triệt để các thuộc tính `correctAnswer`, `correctIndex` và `explanation` trước khi gửi payload về trình duyệt.
- Thí sinh dù có mở Chrome DevTools (F12), kiểm tra tab Network hay bộ nhớ JavaScript cũng hoàn toàn không thể xem trộm đáp án đúng của đề thi. Đáp án gốc chỉ được Lambda Grading Worker nạp ngầm từ DynamoDB sau khi bài thi đã được SQS tiếp nhận an toàn.

---

## KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

### 1. Kết luận nghiệm thu
- Hệ thống **CloudExam** đã hoàn thành 100% các mục tiêu nghiên cứu và tiêu chí nghiệm thu đề ra:
  - Giải quyết triệt để thách thức sập hệ thống khi nộp bài giây cuối nhờ mô hình **Queue-Based Load Leveling** qua Amazon SQS (độ trễ P99 đạt **42.47 ms**, 100% thành công với 500 VUs).
  - Ngăn chặn hoàn toàn hành vi thi hộ nhờ công nghệ **AI Rekognition 1:1** đạt độ chính xác **100.00%** (FAR = 0.00%), kết hợp cơ chế khóa phần cứng thiết bị.
  - Mang lại trải nghiệm làm bài mượt mà tuyệt đối với **Local-First Engine (0ms lag)**, khôi phục nguyên vẹn bài làm khi F5 hay đứt mạng.
  - Tự động hóa toàn diện chu trình ca thi bằng **AWS Step Functions v2** và phát hành báo cáo điểm số qua **Amazon SNS Topic**.
  - Chứng minh thành công mô hình tài chính đám mây **FinOps 0.00 USD**, tận dụng triệt để định mức Free Tier và vệ tinh Đa Đám Mây.

### 2. Hướng phát triển trong tương lai
1. **Giám sát tư thế đầu và ánh mắt theo thời gian thực (Eye-Tracking & Head-Pose Estimation):** Tích hợp WebRTC và mô hình thị giác máy tính nhẹ chạy trực tiếp trên trình duyệt bằng WebAssembly để phát hiện thí sinh quay cóp hoặc nhìn ra ngoài màn hình.
2. **Khảo thí thích ứng máy tính (Computerized Adaptive Testing - CAT):** Ứng dụng mô hình Lý thuyết Ứng đáp Câu hỏi (Item Response Theory - IRT) kết hợp AI để tự động điều chỉnh độ khó của câu hỏi tiếp theo dựa trên năng lực thực tế của từng thí sinh.
3. **Mở rộng đồng bộ Đa Vùng Chủ động (Active-Active Multi-Region):** Nhân bản toàn diện hệ thống giữa Region Singapore (`ap-southeast-1`) và Jakarta (`ap-southeast-3`) bằng DynamoDB Global Tables và Route 53 Geolocation Routing để sẵn sàng cho các kỳ thi quy mô hàng triệu người.

---

*Hà Nội, tháng 11 năm 2026*  
**BAN PHÁT TRIỂN DỰ ÁN CLOUDEXAM — NHÓM 14 (VNU-UET)**
