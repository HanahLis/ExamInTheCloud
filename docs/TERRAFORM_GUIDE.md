# HƯỚNG DẪN THỰC HÀNH TERRAFORM CHO PHONG (NEWBIE GUIDE)
**Dành cho:** Phạm Tuấn Phong  
**Vai trò:** Quản trị Cơ sở dữ liệu & Lưu trữ (DynamoDB + S3) bằng Terraform (IaC)  
**Tài khoản AWS:** `409289618109` | User: `phong`

---

## 1. Cài đặt công cụ trên máy Mac

Mở ứng dụng **Terminal** trên Mac và chạy các lệnh sau:

### Bước 1.1: Cài đặt Terraform & AWS CLI qua Homebrew
```bash
brew install terraform awscli
```

Kiểm tra sau khi cài đặt xong:
```bash
terraform -version
aws --version
```

---

## 2. Lấy Access Key từ AWS Console

Để Terraform trên máy tính của bạn có quyền giao tiếp và tạo tài nguyên trên AWS, bạn cần tạo một cặp khóa **Access Key ID** và **Secret Access Key**.

1. Đăng nhập vào AWS Console bằng tài khoản IAM của bạn:
   👉 Link: `https://409289618109.signin.aws.amazon.com/console`
   - **Account ID:** `409289618109`
   - **Username:** `phong`
   - **Password:** `phamtuanphong123@`
2. Sau khi vào màn hình chính AWS, bấm vào tên tài khoản **phong** ở góc trên cùng bên phải $\rightarrow$ Chọn **Security credentials**.
3. Cuộn xuống phần **Access keys** $\rightarrow$ Bấm nút **Create access key**.
4. Chọn mục đích: **Command Line Interface (CLI)** $\rightarrow$ Tích vào ô xác nhận *"I understand..."* $\rightarrow$ Bấm **Next** $\rightarrow$ Bấm **Create access key**.
5. Màn hình sẽ hiện ra:
   - **Access key**: (Một chuỗi khoảng 20 ký tự, vd: `AKIA...`)
   - **Secret access key**: (Một chuỗi khoảng 40 ký tự bí mật)
   *(Hãy bấm nút **Download .csv file** hoặc copy lưu vào một nơi an toàn trên máy, không gửi cho ai).*

---

## 3. Cấu hình thông tin đăng nhập trên Terminal

Tại Terminal của máy Mac, gõ lệnh:
```bash
aws configure
```

Hệ thống sẽ hỏi 4 thông tin, bạn dán thông tin của mình vào:
- `AWS Access Key ID [None]:` *(Dán Access Key vừa tạo ở bước 2)*
- `AWS Secret Access Key [None]:` *(Dán Secret Access Key vừa tạo ở bước 2)*
- `Default region name [None]:` gõ `ap-southeast-1` *(Singapore)*
- `Default output format [None]:` gõ `json`

Kiểm tra kết nối AWS thành công:
```bash
aws sts get-caller-identity
```
*(Nếu hiện ra đúng `arn:aws:iam::409289618109:user/phong` là bạn đã kết nối thành công 100%)*

---

## 4. Chạy Terraform để tự động tạo S3 và DynamoDB

Di chuyển vào thư mục terraform trong dự án:
```bash
cd /Users/tuanphong/Downloads/ExamInTheCloud/backend/terraform
```

### Bước 4.1: Khởi tạo Terraform (Init)
Tải các thư viện AWS Provider:
```bash
terraform init
```

### Bước 4.2: Xem trước kế hoạch triển khai (Plan)
Terraform sẽ phân tích code và liệt kê chính xác những gì sắp tạo:
```bash
terraform plan
```

### Bước 4.3: Triển khai lên AWS (Apply)
Tạo tài nguyên thật trên mây AWS:
```bash
terraform apply
```
*Khi hệ thống hỏi: `Enter a value:`, bạn gõ `yes` và nhấn Enter.*  
Chỉ sau khoảng 20-30 giây, toàn bộ S3 Bucket và 4 bảng DynamoDB sẽ được tạo xong trên AWS!

---

## 5. Nạp dữ liệu mẫu vào DynamoDB (Seed Data)

Sau khi bảng đã được tạo xong bằng Terraform, bạn di chuyển vào thư mục `backend/data` để đẩy dữ liệu mẫu lên:
```bash
cd /Users/tuanphong/Downloads/ExamInTheCloud/backend/data
python3 seed_dynamodb.py
```
*(Nếu máy báo thiếu `boto3`, chạy `pip3 install boto3` rồi chạy lại).*

---

## 6. Kiểm tra kết quả trên AWS Console

Đăng nhập vào AWS Console để chiêm ngưỡng sản phẩm của mình:
1. Gõ tìm kiếm **DynamoDB** trên thanh tìm kiếm của AWS $\rightarrow$ Chọn **Tables** $\rightarrow$ Bạn sẽ thấy 4 bảng: `CloudExam_Questions_dev`, `CloudExam_Candidates_dev`, `CloudExam_Sessions_dev`, `CloudExam_QuestionBanks_dev` kèm theo các dòng dữ liệu mẫu vừa nạp!
2. Gõ tìm kiếm **S3** $\rightarrow$ Bạn sẽ thấy bucket `cloudexam-storage-409289618109-dev` đã được tạo kèm cấu hình CORS chuẩn.

---

## 7. Cách trả lời và trình bày trước Giảng viên khi bảo vệ đề tài

Khi thầy cô hỏi:
- **Thầy cô hỏi:** *"Em phụ trách phần nào trong nhóm?"*
  - **Phong trả lời:** *"Dạ em phụ trách thiết kế và quản trị tầng Dữ liệu (Database) và Lưu trữ (Storage) của hệ thống, bao gồm Amazon DynamoDB và Amazon S3."*
- **Thầy cô hỏi:** *"Tại sao hệ thống lại chọn DynamoDB thay vì MySQL/PostgreSQL?"*
  - **Phong trả lời:** *"Vì hệ thống đi theo mô hình Serverless và PaaS. DynamoDB là NoSQL có khả năng chịu tải hàng nghìn thí sinh nộp bài cùng lúc với độ trễ mili-giây mà không cần quản trị máy chủ cơ sở dữ liệu. Em áp dụng cơ chế Billing On-demand (Pay-per-request) giúp tối ưu hóa chi phí khi không có kỳ thi."*
- **Thầy cô hỏi:** *"Em tạo tài nguyên trên AWS như thế nào?"*
  - **Phong trả lời:** *"Em không bấm chuột thủ công mà áp dụng phương pháp Infrastructure as Code (IaC) thông qua Terraform. Toàn bộ S3 bucket, CORS, và các bảng DynamoDB được quản lý tường minh bằng code trong thư mục `backend/terraform`, có thể tự động triển khai và thu hồi bất cứ lúc nào."*

