# ĐẶC TẢ LƯU TRỮ VÀ CẤU HÌNH CLOUD STORAGE (AMAZON S3)
**Dự án:** CloudExam - Nền tảng tổ chức thi online trên AWS  
**Thành viên phụ trách:** Phạm Tuấn Phong (DynamoDB + S3)  
**Ngày cập nhật:** 10/10/2026

---

## 1. Mục đích sử dụng Amazon S3
Trong hệ thống CloudExam, **Amazon S3** đóng vai trò là giải pháp lưu trữ đối tượng (Object Storage):
1. **Lưu trữ ảnh câu hỏi:** Các hình ảnh đính kèm minh họa đề thi (sơ đồ kiến trúc, đồ thị, hình học...).
2. **Lưu trữ ảnh khuôn mặt thí sinh:** Ảnh chân dung mẫu của thí sinh được tải lên khi tạo danh sách và ảnh chụp thực tế từ camera khi điểm danh vào phòng thi.

Việc tách hoàn toàn dữ liệu ảnh sang Amazon S3 thay vì lưu trực tiếp vào database giúp:
- Giảm dung lượng và chi phí đọc/ghi trên DynamoDB.
- Tận dụng băng thông phân phối tải lớn của AWS.
- Dễ dàng tích hợp với dịch vụ AI **Amazon Rekognition** (truy xuất trực tiếp ảnh từ S3 Bucket để so sánh).

---

## 2. Cấu trúc thư mục & Naming Convention

Tên Bucket (Global Unique): `cloudexam-storage-409289618109-dev`

```text
cloudexam-storage-409289618109-dev/
├── questions/                  <-- Thư mục chứa ảnh câu hỏi
│   ├── q-aws-001.png
│   └── 1728551234-a8f9b.jpg
└── faces/                      <-- Thư mục chứa ảnh khuôn mặt thí sinh
    ├── B21DCCN001.jpg
    └── 1728555678-x1y2z.png
```

### Quy ước đặt Object Key (Tên đường dẫn):
- **Ảnh câu hỏi:** `questions/{timestamp}-{random-hash}.{ext}` hoặc `questions/{questionId}.{ext}`
- **Ảnh khuôn mặt:** `faces/{studentCode}.{ext}` hoặc `faces/{timestamp}-{random-hash}.{ext}`

Đường dẫn URL trả về để lưu vào DynamoDB:
```text
https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/questions/q-aws-001.png
```

---

## 3. Cấu hình bảo mật & Tương tác

### 3.1. Cấu hình CORS (Cross-Origin Resource Sharing)
Cho phép trình duyệt Web React (ở `http://localhost:5173` hoặc trên AWS Amplify) có thể gửi request `PUT`/`POST` ảnh trực tiếp lên S3:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://cloudexam.id.vn",
      "https://*.cloudexam.id.vn",
      "https://*.amplifyapp.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3.2. Bucket Policy (Chính sách truy cập)
Cho phép quyền đọc công khai (`s3:GetObject`) đối với các file ảnh để Frontend có thể hiển thị ảnh trong thẻ `<img>` của bài thi:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::cloudexam-storage-409289618109-dev/*"
    }
  ]
}
```

---

## 4. Tích hợp với Amazon Rekognition
Khi thí sinh vào phòng thi, ảnh camera chụp trực tiếp sẽ được gửi đến backend. Lambda function sẽ gọi API `CompareFaces` của AWS Rekognition:
- **SourceImage:** Ảnh mẫu của thí sinh lưu tại `s3://cloudexam-storage-409289618109-dev/faces/{studentCode}.jpg`
- **TargetImage:** Ảnh chụp từ webcam của thí sinh lúc bắt đầu thi
- Ngưỡng tương đồng (Similarity Threshold): `>= 80%` $\rightarrow$ Đạt yêu cầu và cho phép vào thi.

---

## 5. Tối ưu Chi phí FinOps & Vòng đời Dữ liệu (S3 Lifecycle)

Nhằm đảm bảo tôn chỉ **0.00 USD chi phí lưu trữ**, hệ thống kích hoạt các luật quản trị vòng đời đối tượng tự động trong `backend/terraform/s3.tf`:
1. **Xóa tự động ảnh tạm webcam (`temp/`):** Các ảnh chụp đối soát webcam phục vụ điểm danh chỉ được lưu tạm thời và tự động xóa vĩnh viễn sau **24 giờ** (`expiration { days = 1 }`).
2. **Hủy bỏ Multipart Upload dở dang:** Tự động thu hồi và giải phóng dung lượng các phân mảnh upload chưa hoàn tất sau **1 ngày** (`abort_incomplete_multipart_upload_days = 1`).
3. **Bảo vệ Website Hosting Bucket với CloudFront OAC:** Bucket chứa mã nguồn Frontend SPA (`cloudexam-frontend-dev`) chặn 100% Public Access (`block_public_acls = true`, `block_public_policy = true`), chỉ cho phép CloudFront Service Principal ký SigV4 qua **Origin Access Control (OAC)** truy cập.

