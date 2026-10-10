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
| `status` | String | Attribute | Trạng thái: `SCHEDULED`, `RUNNING`, `CLOSED`. |
| `questionIds` | List (Array of Strings) | Attribute | Danh sách ID các câu hỏi có trong ca thi. |
| `candidateEmails` | List (Array of Strings) | Attribute | Danh sách email các thí sinh được phép vào ca thi này. |
| `link` | String | Attribute | Đường link tham gia thi ca này. |

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

## 3. Thiết kế mở rộng cho các giai đoạn tiếp theo

Trong các giai đoạn sau (Giai đoạn làm bài & chấm điểm thi):
- Bảng `CloudExam_Submissions`: Lưu bài nộp của thí sinh (`sessionId`, `studentCode`, `answers`, `score`, `submittedAt`).
- Bảng `CloudExam_FaceLogs`: Lưu lịch sử đối sánh khuôn mặt từ Amazon Rekognition (`sessionId`, `studentCode`, `similarityScore`, `status: PASS/FAIL`, `capturedImageUrl`).

