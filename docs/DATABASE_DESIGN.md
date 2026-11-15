# ĐẶC TẢ THIẾT KẾ CƠ SỞ DỮ LIỆU NOSQL (AMAZON DYNAMODB)
**Dự án:** CloudExam - Nền tảng tổ chức thi online trên AWS  
**Thành viên phụ trách:** Phạm Tuấn Phong (DynamoDB + S3)  
**Ngày cập nhật:** 10/10/2026

---

## 1. Tổng quan kiến trúc dữ liệu
Trong mô hình PaaS / Serverless của dự án CloudExam, hệ thống sử dụng **Amazon DynamoDB** làm cơ sở dữ liệu chính.
- **Mô hình:** NoSQL (Key-Value & Document-based).
- **Billing Mode:** `PAY_PER_REQUEST` (On-Demand) – Tối ưu chi phí, không tốn phí duy trì khi không có request, tự động co giãn theo tải của kỳ thi.
- **Tính toàn vẹn & Phân tách:** Dữ liệu text/metadata được lưu trong DynamoDB, trong khi toàn bộ dữ liệu nhị phân (hình ảnh) được lưu trữ trên Amazon S3 và chỉ lưu đường dẫn URL trong DynamoDB.

---

## 2. Danh sách các bảng (Tables)

### 2.1. Bảng `CloudExam_Questions_{env}`
Lưu trữ toàn bộ câu hỏi trong ngân hàng câu hỏi.

| Thuộc tính (Attribute) | Kiểu dữ liệu | Vai trò | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| `id` | String | **Partition Key (PK)** | Định danh duy nhất cho câu hỏi (ví dụ: `q-aws-001`, UUID). |
| `bankId` | String | Secondary Index | ID của ngân hàng câu hỏi chứa câu hỏi này (vd: `bank-cloud-01`). |
| `content` | String | Attribute | Nội dung văn bản của đề bài câu hỏi. |
| `options` | List (Array of Strings) | Attribute | Danh sách 4 đáp án `[A, B, C, D]`. |
| `correctIndex` | Number | Attribute | Vị trí đáp án đúng (từ `0` đến `3`). |
| `score` | Number | Attribute | Điểm số của câu hỏi (mặc định: `1`). |
| `difficulty` | String | Attribute | Độ khó: `EASY`, `MEDIUM`, `HARD`. |
| `imageUrl` | String (Optional) | Attribute | Đường dẫn ảnh minh họa trên S3 (nếu có). |
| `createdAt` | String | Attribute | Thời điểm tạo câu hỏi (ISO 8601 UTC). |

* **Global Secondary Index (GSI):** `BankIdIndex` (PK: `bankId`) – Cho phép truy vấn tất cả các câu hỏi thuộc về một ngân hàng câu hỏi nhanh chóng mà không cần scan toàn bộ bảng.

---

### 2.2. Bảng `CloudExam_Candidates_{env}`
Lưu trữ thông tin thí sinh được phép tham dự thi.

| Thuộc tính (Attribute) | Kiểu dữ liệu | Vai trò | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| `email` | String | **Partition Key (PK)** | Email thí sinh (duy nhất trong hệ thống). |
| `studentCode` | String | Secondary Index | Mã sinh viên (ví dụ: `B21DCCN001`). |
| `name` | String | Attribute | Họ và tên đầy đủ của thí sinh. |
| `className` | String | Attribute | Lớp sinh hoạt / đơn vị. |
| `faceImageUrl` | String | Attribute | Đường dẫn ảnh chân dung gốc trên Amazon S3 để phục vụ AI Rekognition điểm danh. |
| `createdAt` | String | Attribute | Thời điểm thêm thí sinh. |

* **Global Secondary Index (GSI):** `StudentCodeIndex` (PK: `studentCode`) – Cho phép tra cứu thí sinh theo Mã số sinh viên.

---

### 2.3. Bảng `CloudExam_Sessions_{env}`
Lưu trữ thông tin ca thi và các quy định thời gian.

| Thuộc tính (Attribute) | Kiểu dữ liệu | Vai trò | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| `id` | String | **Partition Key (PK)** | Mã ca thi (ví dụ: `EX20261015001`). |
| `name` | String | Attribute | Tên ca thi (ví dụ: `Thi Cuối Kỳ Điện Toán Đám Mây - Ca 1`). |
| `startTime` | String | Attribute | Thời điểm bắt đầu ca thi (ISO 8601). |
| `endTime` | String | Attribute | Thời điểm kết thúc ca thi (ISO 8601). |
| `status` | String | Attribute | Trạng thái: `DRAFT`, `SCHEDULED`, `RUNNING`, `COMPLETED`. |
| `roomPassword` | String | Attribute | Mật khẩu vào phòng thi (cho thí sinh tự nhập tại cổng phòng thi). |
| `questionIds` | List (Array of Strings) | Attribute | Danh sách ID các câu hỏi có trong ca thi. |
| `candidateEmails` | List (Array of Strings) | Attribute | Danh sách email các thí sinh được phép vào ca thi này. |
| `proctorEmails` | List (Array of Strings) | Attribute | Danh sách email cán bộ Giám thị được phân công coi ca thi này. |
| `lockedCandidates` | Map (Object) | Attribute | Map lưu trữ thông tin thiết bị đã khóa `{ email: { deviceFingerprint, lockedAt } }` ngăn chặn thí sinh đăng nhập đồng thời trên máy thứ hai hoặc thi hộ. Giám thị có thể mở khóa qua Bàn Giám thị. |
| `link` | String | Attribute | Đường link tham gia thi ca này (dạng `https://cloudexam.id.vn/?exam={id}`). |

---

### 2.4. Bảng `CloudExam_QuestionBanks_{env}`
Lưu thông tin các ngân hàng đề thi.

| Thuộc tính | Kiểu dữ liệu | Vai trò | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| `id` | String | **Partition Key (PK)** | Mã ngân hàng câu hỏi. |
| `name` | String | Attribute | Tên ngân hàng (ví dụ: `Trắc nghiệm Cloud AWS 2026`). |
| `description` | String | Attribute | Mô tả chi tiết. |
| `ownerId` | String | Attribute | ID của Organizer tạo ngân hàng. |

---

### 2.5. Bảng `CloudExam_Submissions_{env}` (Mới cập nhật)
Lưu kết quả chấm thi tự động từ Lambda Grading Worker (tiêu thụ từ Amazon SQS).

| Thuộc tính (Attribute) | Kiểu dữ liệu | Vai trò | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| `id` | String | **Partition Key (PK)** | ID bài nộp (UUID duy nhất). |
| `sessionId` | String | GSI Hash Key | Mã ca thi (ví dụ: `SESSION_STAMPEDE_01`). |
| `candidateEmail` | String | Attribute | Email thí sinh nộp bài. |
| `score` | Number | GSI Range Key | Điểm số đạt được (phục vụ sắp xếp bảng điểm). |
| `maxScore` | Number | Attribute | Điểm tối đa của đề thi. |
| `correctCount` | Number | Attribute | Số câu trả lời đúng. |
| `totalQuestions` | Number | Attribute | Tổng số câu hỏi trong bài thi. |
| `answers` | Map | Attribute | Chi tiết câu trả lời của thí sinh. |
| `submittedAt` | String | Attribute | Thời điểm nộp bài (ISO 8601 UTC). |
| `status` | String | Attribute | Trạng thái bài nộp (`COMPLETED`, `QUEUED`). |

* **Global Secondary Index (GSI):** `SessionResultsIndex` (PK: `sessionId`, SK: `score` DESC) – Cho phép truy xuất ngay lập tức danh sách điểm số giảm dần của một ca thi mà không cần Scan bảng.

---

## 3. Kiến trúc CSDL Đa Quốc Gia (Multi-Tenancy Architecture)

Nhằm phục vụ kỳ thi đa quốc gia (Việt Nam `cloudexam.vn` và Lào `edulao.la`), hệ thống áp dụng mô hình **Single-Table Multi-Tenancy**:
* **Cơ chế phân tách dữ liệu:** Tiền tố phân vùng (Partition Key Prefix) theo mã quốc gia ISO:
  - Thí sinh / Đề thi Việt Nam: `TENANT#VN#{entityId}` (ví dụ: `TENANT#VN#bank-cloud-01`, `TENANT#VN#q-aws-001`).
  - Thí sinh / Đề thi Lào: `TENANT#LA#{entityId}` (ví dụ: `TENANT#LA#bank-cloud-lao`, `TENANT#LA#q-aws-001`).
* **Lợi ích kiến trúc:**
  - Tiết kiệm 100% chi phí quản trị đa database, duy trì hạn mức $0 FinOps Free Tier.
  - Cô lập an toàn tuyệt đối dữ liệu giữa các quốc gia ở mức truy vấn DynamoDB KeyCondition.

---

## 4. Chống Thảm họa Đa Vùng (Multi-Region Disaster Recovery)

* **DynamoDB Global Tables:** Cơ sở dữ liệu được cấu hình đồng bộ tự động 2 chiều giữa **Singapore (`ap-southeast-1`)** và **Jakarta (`ap-southeast-3`)**.
* **Chỉ số RPO / RTO:**
  - **RPO (Recovery Point Objective):** $< 1$ giây (Độ trễ nhân bản của mạng trục AWS).
  - **RTO (Recovery Time Objective):** $< 2$ phút (Tự động kích hoạt qua Route 53 DNS Failover).

---

## 5. Tích hợp Bộ nhớ đệm Upstash Serverless Redis (Live Leaderboard)

Để tránh tiêu tốn đơn vị đọc (RCU) của DynamoDB khi hàng trăm thí sinh liên tục truy vấn bảng xếp hạng trực tiếp trong phòng thi:
* **Mô hình kết hợp:** DynamoDB đóng vai trò nguồn chân lý (Source of Truth), trong khi **Upstash Redis** lưu trữ bảng xếp hạng thời gian thực thông qua kiểu dữ liệu Sorted Set (`ZADD leaderboard:{sessionId} {score} {candidateEmail}`).
* **Độ trễ truy vấn:** $< 5$ mili-giây, chi phí duy trì 0.00 USD (nằm trong 10.000 lệnh/ngày miễn phí).


