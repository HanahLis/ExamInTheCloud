# Hướng Dẫn Chuẩn Bị Ảnh Thẻ Chân Dung Thí Sinh Cho AWS Rekognition

Thư mục này dùng để chứa file ảnh thẻ chân dung gốc của các thí sinh dự thi (được nạp vào Amazon S3 prefix `faces/{studentCode}.jpg`).

## 1. Quy ước đặt tên file
Đặt tên file ảnh chính xác theo **Mã Sinh Viên / Mã Thí Sinh** (chữ in hoa) với đuôi mở rộng `.jpg` hoặc `.jpeg`:

* `B21DCCN001.jpg` — Phạm Tuấn Phong
* `B21DCCN002.jpg` — Trần Đức Mạnh
* `B21DCCN003.jpg` — Nguyễn Phúc Tấn
* `B21DCCN004.jpg` — Nguyễn Thị Thu Hà

## 2. Tiêu chuẩn ảnh chân dung để Amazon Rekognition đạt độ khớp cao (≥ 80%):
1. **Góc chụp:** Chụp trực diện, mắt nhìn thẳng vào ống kính máy ảnh (giống ảnh làm CCCD / Thẻ sinh viên).
2. **Ánh sáng:** Đủ sáng, không bị bóng tối phủ nửa mặt, không chụp ngược sáng.
3. **Kích thước:** Tối thiểu 400x500 px, dung lượng dưới 5MB.
4. **Khuôn mặt:** Không đeo kính râm, không đeo khẩu trang, khuôn mặt chiếm khoảng 50% - 70% khung hình.

## 3. Lệnh nạp ảnh lên Amazon S3 & DynamoDB
Sau khi thả ảnh vào thư mục này, chạy lệnh:

```bash
# Kiểm tra trước (Dry-Run)
python upload_sample_faces.py --dry-run

# Nạp thật lên S3 và cập nhật DynamoDB
python upload_sample_faces.py
```

