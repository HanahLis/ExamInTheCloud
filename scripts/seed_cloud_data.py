#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CloudExam - Comprehensive Cloud Data Seeder
Tự động nạp toàn bộ dữ liệu kiểm thử (Tài khoản, Đề thi mẫu, Thí sinh, Ca thi, Ảnh thẻ mẫu)
lên AWS Cloud (Amazon Cognito, DynamoDB, S3) khi chạy terraform apply.
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from decimal import Decimal

# Đảm bảo console Windows hỗ trợ UTF-8 an toàn
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import boto3
from botocore.exceptions import ClientError

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")

def get_repo_paths():
    repo_root = Path(__file__).resolve().parent.parent
    data_dir = repo_root / "backend" / "data"
    sample_faces_dir = data_dir / "sample_faces"
    tf_dir = repo_root / "backend" / "terraform"
    frontend_dir = repo_root / "frontend"
    return repo_root, data_dir, sample_faces_dir, tf_dir, frontend_dir

def load_terraform_outputs(tf_dir: Path):
    """Đọc thông tin hạ tầng thực tế từ terraform output hoặc terraform.tfstate"""
    outputs = {}
    try:
        res = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=str(tf_dir),
            capture_output=True,
            text=True,
            check=False
        )
        if res.returncode == 0 and res.stdout.strip():
            raw_outputs = json.loads(res.stdout)
            for k, v in raw_outputs.items():
                outputs[k] = v.get("value")
            if outputs:
                return outputs
    except Exception:
        pass

    tfstate_file = tf_dir / "terraform.tfstate"
    if tfstate_file.exists():
        try:
            with open(tfstate_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                raw_outputs = data.get("outputs", {})
                for k, v in raw_outputs.items():
                    outputs[k] = v.get("value")
        except Exception as e:
            print(f"[WARN] Không thể đọc terraform.tfstate: {e}")
    return outputs

def seed_cognito_users(cognito_client, user_pool_id: str):
    """Khởi tạo và xác thực toàn bộ tài khoản thử nghiệm trên AWS Cognito"""
    print(f"\n[+] 1. ĐỒNG BỘ TÀI KHOẢN NGƯỜI DÙNG VÀO COGNITO USER POOL ({user_pool_id})...")
    
    users = [
        {
            "username": "annv@uet.vnu.edu.vn",
            "password": "12345678",
            "name": "PGS. TS. Nguyễn Văn An",
            "role": "Organizer",
            "group": "Organizer",
            "student_code": "GV001"
        },
        {
            "username": "laladoraema@gmail.com",
            "password": "12345678",
            "name": "Giám thị Laladoraema",
            "role": "Organizer",
            "group": "Organizer",
            "student_code": "GT002"
        },
        {
            "username": "24020001@vnu.edu.vn",
            "password": "12345678",
            "name": "Trần Minh Đức",
            "role": "Candidate",
            "group": "Candidate",
            "student_code": "24020001"
        },
        {
            "username": "24020002@vnu.edu.vn",
            "password": "12345678",
            "name": "Lê Thị Mai",
            "role": "Candidate",
            "group": "Candidate",
            "student_code": "24020002"
        },
        {
            "username": "24020003@vnu.edu.vn",
            "password": "12345678",
            "name": "Phạm Hoàng Long",
            "role": "Candidate",
            "group": "Candidate",
            "student_code": "24020003"
        },
        {
            "username": "24020004@vnu.edu.vn",
            "password": "12345678",
            "name": "Vũ Thùy Linh",
            "role": "Candidate",
            "group": "Candidate",
            "student_code": "24020004"
        },
        {
            "username": "24020005@vnu.edu.vn",
            "password": "12345678",
            "name": "Đỗ Quang Huy",
            "role": "Candidate",
            "group": "Candidate",
            "student_code": "24020005"
        },
        {
            "username": "24020006@vnu.edu.vn",
            "password": "12345678",
            "name": "Nguyễn Văn Sáu",
            "role": "Candidate",
            "group": "Candidate",
            "student_code": "24020006"
        },
        {
            "username": "24020007@vnu.edu.vn",
            "password": "12345678",
            "name": "Nguyễn VĂN BẢY",
            "role": "Candidate",
            "group": "Candidate",
            "student_code": "24020007"
        }
    ]

    for u in users:
        email = u["username"]
        pwd = u["password"]
        
        # 1. Thử tạo tài khoản hoặc cập nhật mật khẩu
        try:
            cognito_client.admin_create_user(
                UserPoolId=user_pool_id,
                Username=email,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "name", "Value": u["name"]},
                    {"Name": "custom:tenant_id", "Value": "vn"}
                ],
                MessageAction="SUPPRESS"
            )
            print(f"  + Tạo mới user: {email} ({u['name']})")
        except cognito_client.exceptions.UsernameExistsException:
            print(f"  * User đã tồn tại: {email}")
        except Exception as e:
            print(f"  [WARN] admin_create_user {email}: {e}")

        # 2. Đặt mật khẩu vĩnh viễn (Permanent = True, không bắt đổi mật khẩu khi đăng nhập)
        try:
            cognito_client.admin_set_user_password(
                UserPoolId=user_pool_id,
                Username=email,
                Password=pwd,
                Permanent=True
            )
            print(f"    -> Đã gán mật khẩu vĩnh viễn: {pwd}")
        except Exception as e:
            print(f"    [WARN] Không thể đặt mật khẩu {email}: {e}")

        # 3. Gán nhóm (Group)
        try:
            cognito_client.admin_add_user_to_group(
                UserPoolId=user_pool_id,
                Username=email,
                GroupName=u["group"]
            )
        except Exception:
            pass

    print("[OK] Đồng bộ tài khoản Cognito hoàn tất!")

def seed_s3_faces(s3_client, bucket_name: str, sample_faces_dir: Path):
    """Tải toàn bộ ảnh chân dung thẻ sinh viên lên S3 để phục vụ Amazon Rekognition"""
    print(f"\n[+] 2. TẢI ẢNH CHÂN DUNG THÍ SINH LÊN S3 ({bucket_name}/faces/)...")
    if not sample_faces_dir.exists():
        print(f"[WARN] Không tìm thấy thư mục {sample_faces_dir}")
        return

    jpg_files = list(sample_faces_dir.glob("*.jpg"))
    for f in jpg_files:
        s3_key = f"faces/{f.name}"
        try:
            with open(f, "rb") as data:
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=s3_key,
                    Body=data,
                    ContentType="image/jpeg"
                )
            print(f"  + S3 Upload: {s3_key} ({f.stat().st_size} bytes)")
        except Exception as e:
            print(f"  [WARN] Lỗi upload {s3_key}: {e}")

    # Tạo thêm alias cho các mã sinh viên kiểm thử phổ biến
    aliases = [
        ("annv.jpg", "faces/GV001.jpg"),
        ("24020001.jpg", "faces/24021501.jpg"),
        ("24020001.jpg", "faces/24021561.jpg"),
        ("24020001.jpg", "faces/tran.dm24.jpg")
    ]
    for src, dst in aliases:
        src_path = sample_faces_dir / src
        if src_path.exists():
            try:
                with open(src_path, "rb") as data:
                    s3_client.put_object(
                        Bucket=bucket_name,
                        Key=dst,
                        Body=data,
                        ContentType="image/jpeg"
                    )
                print(f"  + S3 Alias: {dst} (sao chép từ {src})")
            except Exception as e:
                print(f"  [WARN] Lỗi alias {dst}: {e}")

    print("[OK] Tải ảnh chân dung thí sinh lên S3 hoàn tất!")

def seed_dynamodb_data(dynamodb_resource, bucket_name: str):
    """Nạp ngân hàng đề thi mẫu, câu hỏi chuyên sâu AWS, danh sách thí sinh và ca thi"""
    print(f"\n[+] 3. NẠP DỮ LIỆU ĐỀ THI VÀ CA THI VÀO AMAZON DYNAMODB...")
    
    # 1. Ngân hàng câu hỏi (Question Banks)
    qb_table = dynamodb_resource.Table(f"CloudExam_QuestionBanks_{ENV}")
    banks = [
        {
            "id": "bank-cloud-01",
            "name": "Ngân hàng đề Kiến trúc AWS Cloud & Microservices",
            "subject": "Điện toán đám mây & Kiến trúc hệ thống",
            "description": "Bộ đề thi chuẩn hóa kiểm tra năng lực thiết kế hệ thống trên AWS và kiến trúc Microservices",
            "ownerEmail": "annv@uet.vnu.edu.vn",
            "createdBy": "annv@uet.vnu.edu.vn",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "bank-se-arch-01",
            "name": "Kiến trúc & Thiết kế Phần mềm Nâng cao",
            "subject": "Kiến trúc Phần mềm",
            "description": "Các mô hình SOA, EDA, CQRS, Event Sourcing và Microservices",
            "ownerEmail": "annv@uet.vnu.edu.vn",
            "createdBy": "annv@uet.vnu.edu.vn",
            "createdAt": "2026-10-20T00:00:00Z"
        }
    ]
    for b in banks:
        try:
            qb_table.put_item(Item=b)
            print(f"  + Ngân hàng đề: {b['name']} ({b['id']})")
        except Exception as e:
            print(f"  [WARN] Lỗi ghi QuestionBank {b['id']}: {e}")

    # 2. Danh sách câu hỏi mẫu chuẩn hóa (10 câu chuyên sâu AWS + 5 câu Microservices)
    q_table = dynamodb_resource.Table(f"CloudExam_Questions_{ENV}")
    questions = [
        {
            "id": "q-aws-001",
            "questionId": "q-aws-001",
            "bankId": "bank-cloud-01",
            "content": "Dịch vụ nào của AWS cung cấp khả năng tự động so khớp khuôn mặt thí sinh với ngưỡng tương đồng >= 80% phục vụ điểm danh bảo mật?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Rekognition",
                "Amazon Textract",
                "Amazon Comprehend",
                "Amazon SageMaker"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Rekognition",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Trí tuệ nhân tạo & Thị giác máy tính",
            "difficulty": "EASY",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-002",
            "questionId": "q-aws-002",
            "bankId": "bank-cloud-01",
            "content": "Để bảo vệ hệ thống khỏi tình trạng quá tải khi hàng ngàn thí sinh cùng bấm nộp bài vào giây cuối cùng, CloudExam áp dụng mẫu hình kiến trúc nào?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Queue-Based Load Leveling kết hợp Amazon SQS và Lambda Worker",
                "Tăng kích thước dung lượng máy chủ lên loại lớn nhất",
                "Từ chối tiếp nhận các yêu cầu gửi sau giây thứ 50",
                "Lưu toàn bộ bài thi trực tiếp vào LocalStorage trình duyệt mà không gửi lên Cloud"
            ],
            "correctIndex": 0,
            "correctAnswer": "Queue-Based Load Leveling kết hợp Amazon SQS và Lambda Worker",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Hàng đợi thông điệp & Chịu tải cao",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-003",
            "questionId": "q-aws-003",
            "bankId": "bank-cloud-01",
            "content": "Trong kiến trúc phi máy chủ (Serverless), dịch vụ cơ sở dữ liệu NoSQL nào cung cấp độ trễ phản hồi đơn vị mili-giây và tự động co giãn theo tải?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon DynamoDB",
                "Amazon RDS PostgreSQL",
                "Amazon Redshift",
                "Amazon Athena"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon DynamoDB",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Cơ sở dữ liệu NoSQL",
            "difficulty": "EASY",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-004",
            "questionId": "q-aws-004",
            "bankId": "bank-cloud-01",
            "content": "Để phân phối nội dung tĩnh của ứng dụng React SPA tới người dùng toàn cầu với độ trễ thấp nhất và hỗ trợ giao thức HTTPS qua CDN, AWS sử dụng dịch vụ gì?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon CloudFront kết hợp S3 Origin Access Control (OAC)",
                "Elastic Load Balancing (ALB)",
                "AWS Direct Connect",
                "Amazon Route 53 Traffic Flow"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon CloudFront kết hợp S3 Origin Access Control (OAC)",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Mạng phân phối nội dung (CDN)",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-005",
            "questionId": "q-aws-005",
            "bankId": "bank-cloud-01",
            "content": "Thành phần nào của AWS giúp điều phối vòng đời ca thi (mở ca, đếm ngược thời gian, tự động đóng ca thi và thu hồi bài nháp) theo luồng trạng thái?",
            "type": "SINGLE_CHOICE",
            "options": [
                "AWS Step Functions State Machine",
                "Amazon EventBridge Cron",
                "Amazon EC2 Auto Scaling",
                "AWS Systems Manager Run Command"
            ],
            "correctIndex": 0,
            "correctAnswer": "AWS Step Functions State Machine",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Điều phối tiến trình phi máy chủ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-006",
            "questionId": "q-aws-006",
            "bankId": "bank-cloud-01",
            "content": "Giải pháp bảo mật nào tại tầng biên (Edge) của AWS có chức năng kiểm soát Rate Limiting và ngăn chặn các cuộc tấn công SQL Injection, Cross-Site Scripting (XSS)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "AWS WAFv2 Web ACL",
                "AWS Shield Standard",
                "Amazon GuardDuty",
                "AWS Network Firewall"
            ],
            "correctIndex": 0,
            "correctAnswer": "AWS WAFv2 Web ACL",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Tường lửa ứng dụng web & An toàn thông tin",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-007",
            "questionId": "q-aws-007",
            "bankId": "bank-cloud-01",
            "content": "Khi thí sinh cần tải trực tiếp ảnh bài thi hoặc ảnh khuôn mặt lên Amazon S3 mà không làm nghẽn băng thông của API Gateway và Lambda, cơ chế nào được áp dụng?",
            "type": "SINGLE_CHOICE",
            "options": [
                "S3 Presigned URL (Mô hình Direct-to-Storage)",
                "Truyền dữ liệu dạng Base64 qua REST API body",
                "Cấp toàn quyền IAM Administrator cho trình duyệt của thí sinh",
                "Mở cổng FTP công khai trên S3 bucket"
            ],
            "correctIndex": 0,
            "correctAnswer": "S3 Presigned URL (Mô hình Direct-to-Storage)",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Lưu trữ đối tượng an toàn",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-008",
            "questionId": "q-aws-008",
            "bankId": "bank-cloud-01",
            "content": "Amazon Simple Notification Service (Amazon SNS) trong hệ thống CloudExam đóng vai trò chính là gì?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Gửi email báo cáo phân tích phổ điểm và cảnh báo gian lận cho Giảng viên",
                "Lưu trữ dữ liệu bài làm của thí sinh",
                "Biên dịch mã nguồn JavaScript của trang web",
                "Quản lý chứng chỉ SSL/TLS"
            ],
            "correctIndex": 0,
            "correctAnswer": "Gửi email báo cáo phân tích phổ điểm và cảnh báo gian lận cho Giảng viên",
            "score": Decimal("1"),
            "subject": "Điện toán đám mây",
            "topic": "Thông báo đa kênh Pub/Sub",
            "difficulty": "EASY",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-009",
            "questionId": "q-aws-009",
            "bankId": "bank-cloud-01",
            "content": "Trong mô hình Kiến trúc Hướng Dịch vụ (SOA) và Microservices, đặc điểm nào sau đây là quan trọng nhất?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Các dịch vụ có tính kết nối lỏng (Loosely Coupled) và giao tiếp qua giao thức chuẩn",
                "Tất cả dịch vụ phải chia sẻ chung một bảng cơ sở dữ liệu quan hệ duy nhất",
                "Toàn bộ ứng dụng phải được đóng gói và triển khai đồng thời trong một tệp thực thi",
                "Không được phép phân tán các dịch vụ trên nhiều máy chủ khác nhau"
            ],
            "correctIndex": 0,
            "correctAnswer": "Các dịch vụ có tính kết nối lỏng (Loosely Coupled) và giao tiếp qua giao thức chuẩn",
            "score": Decimal("1"),
            "subject": "Kiến trúc Phần mềm",
            "topic": "Kiến trúc hướng dịch vụ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "id": "q-aws-010",
            "questionId": "q-aws-010",
            "bankId": "bank-cloud-01",
            "content": "Thành phần nào đóng vai trò điều phối thông điệp bất đồng bộ và giảm sự phụ thuộc trực tiếp giữa các dịch vụ trong kiến trúc hướng sự kiện (EDA)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Message Broker (như Amazon SQS, Amazon SNS hoặc Apache Kafka)",
                "Trình thông dịch mã nguồn phía Client",
                "Cổng giao tiếp phần cứng COM Port",
                "Hệ thống quản lý tệp tin cục bộ (Local File System)"
            ],
            "correctIndex": 0,
            "correctAnswer": "Message Broker (như Amazon SQS, Amazon SNS hoặc Apache Kafka)",
            "score": Decimal("1"),
            "subject": "Kiến trúc Phần mềm",
            "topic": "Event-Driven Architecture",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-20T00:00:00Z"
        }
    ]

    for q in questions:
        q["ownerEmail"] = "annv@uet.vnu.edu.vn"
        q["createdBy"] = "annv@uet.vnu.edu.vn"
        try:
            q_table.put_item(Item=q)
            print(f"  + Câu hỏi: {q['id']} - {q['content'][:60]}...")
        except Exception as e:
            print(f"  [WARN] Lỗi ghi Question {q['id']}: {e}")

    # 3. Danh sách Thí sinh mẫu kèm đường dẫn ảnh chân dung chuẩn
    cand_table = dynamodb_resource.Table(f"CloudExam_Candidates_{ENV}")
    candidates = [
        {
            "email": "24020001@vnu.edu.vn",
            "name": "Trần Minh Đức",
            "className": "QH-2024-I/CQ-CN1",
            "studentCode": "24020001",
            "faceImageUrl": f"https://{bucket_name}.s3.{REGION}.amazonaws.com/faces/24020001.jpg",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "email": "24020002@vnu.edu.vn",
            "name": "Lê Thị Mai",
            "className": "QH-2024-I/CQ-CN1",
            "studentCode": "24020002",
            "faceImageUrl": f"https://{bucket_name}.s3.{REGION}.amazonaws.com/faces/24020002.jpg",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "email": "24020003@vnu.edu.vn",
            "name": "Phạm Hoàng Long",
            "className": "QH-2024-I/CQ-CN1",
            "studentCode": "24020003",
            "faceImageUrl": f"https://{bucket_name}.s3.{REGION}.amazonaws.com/faces/24020003.jpg",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "email": "24020004@vnu.edu.vn",
            "name": "Vũ Thùy Linh",
            "className": "QH-2024-I/CQ-CN1",
            "studentCode": "24020004",
            "faceImageUrl": f"https://{bucket_name}.s3.{REGION}.amazonaws.com/faces/24020004.jpg",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "email": "24020005@vnu.edu.vn",
            "name": "Đỗ Quang Huy",
            "className": "QH-2024-I/CQ-CN2",
            "studentCode": "24020005",
            "faceImageUrl": f"https://{bucket_name}.s3.{REGION}.amazonaws.com/faces/24020005.jpg",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "email": "24020006@vnu.edu.vn",
            "name": "Nguyễn Văn Sáu",
            "className": "k69i-it7",
            "studentCode": "24020006",
            "faceImageUrl": f"https://{bucket_name}.s3.{REGION}.amazonaws.com/faces/24020006.jpg",
            "createdAt": "2026-10-20T00:00:00Z"
        },
        {
            "email": "24020007@vnu.edu.vn",
            "name": "Nguyễn VĂN BẢY",
            "className": "K69I-IT6",
            "studentCode": "24020007",
            "faceImageUrl": f"https://{bucket_name}.s3.{REGION}.amazonaws.com/faces/24020007.jpg",
            "createdAt": "2026-10-20T00:00:00Z"
        }
    ]

    for c in candidates:
        c["ownerEmail"] = "annv@uet.vnu.edu.vn"
        c["createdBy"] = "annv@uet.vnu.edu.vn"
        c["ownerEmails"] = ["annv@uet.vnu.edu.vn"]
        try:
            cand_table.put_item(Item=c)
            print(f"  + Thí sinh: {c['name']} ({c['studentCode']}) - {c['email']}")
        except Exception as e:
            print(f"  [WARN] Lỗi ghi Candidate {c['email']}: {e}")

    # 4. Ca thi kiểm thử đang chạy (RUNNING) với thời hạn vô hạn (Hết hạn năm 2027)
    sess_table = dynamodb_resource.Table(f"CloudExam_Sessions_{ENV}")
    cand_emails = [c["email"] for c in candidates]
    q_ids = [q["id"] for q in questions]
    
    session = {
        "id": "EX-VNU-2026-01",
        "name": "Thi Đánh Giá Năng Lực: Kiến trúc & Phát triển Phần mềm",
        "startTime": "2026-10-01T00:00:00.000Z",
        "endTime": "2027-12-31T23:59:59.000Z",
        "status": "RUNNING",
        "questionIds": q_ids,
        "candidateEmails": cand_emails,
        "durationMinutes": 90,
        "ownerEmail": "annv@uet.vnu.edu.vn",
        "createdBy": "annv@uet.vnu.edu.vn",
        "createdAt": "2026-10-20T00:00:00.000Z"
    }

    try:
        sess_table.put_item(Item=session)
        print(f"  + Ca thi đang chạy: {session['name']} ({session['id']})")
        print(f"    - Số lượng câu hỏi: {len(q_ids)} câu")
        print(f"    - Số lượng thí sinh: {len(cand_emails)} thí sinh")
        print(f"    - Trạng thái: RUNNING (Thời hạn mở tới 2027)")
    except Exception as e:
        print(f"  [WARN] Lỗi ghi Session {session['id']}: {e}")

    print("[OK] Nạp dữ liệu DynamoDB hoàn tất!")

def update_frontend_env_file(frontend_dir: Path, outputs: dict, cognito_client=None, user_pool_id: str = ""):
    """Cập nhật tự động tệp frontend/.env với các output mới nhất từ AWS"""
    env_file = frontend_dir / ".env"
    print(f"\n[+] 4. CẬP NHẬT TỆP CẤU HÌNH FRONTEND (.env)...")
    
    # 1. Đọc các giá trị đang có trong file .env (được tạo bởi local_file.frontend_env của Terraform)
    existing_env = {}
    if env_file.exists():
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        existing_env[k.strip()] = v.strip()
        except Exception:
            pass

    api_url = outputs.get("api_gateway_base_url") or existing_env.get("VITE_API_BASE_URL") or "https://de4nmzai6f.execute-api.ap-southeast-1.amazonaws.com/dev"
    user_pool_id = outputs.get("cognito_user_pool_id") or user_pool_id or existing_env.get("VITE_COGNITO_USER_POOL_ID") or "ap-southeast-1_VpTwkt2il"
    app_client_id = outputs.get("cognito_app_client_id") or existing_env.get("VITE_COGNITO_CLIENT_ID")

    # Dò tìm App Client ID thực tế từ AWS nếu outputs và existing_env chưa có
    if not app_client_id and cognito_client and user_pool_id:
        try:
            clis = cognito_client.list_user_pool_clients(UserPoolId=user_pool_id, MaxResults=10).get("UserPoolClients", [])
            for c in clis:
                if "web-client" in c.get("ClientName", "").lower():
                    app_client_id = c["ClientId"]
                    break
            if not app_client_id and clis:
                app_client_id = clis[0]["ClientId"]
        except Exception as e:
            print(f"[WARN] Không thể tìm App Client từ AWS SDK: {e}")

    identity_pool_id = outputs.get("cognito_identity_pool_id") or existing_env.get("VITE_IDENTITY_POOL_ID") or "ap-southeast-1:49174f21-1d09-48e5-9a9e-661fd2cf0baa"
    s3_bucket = outputs.get("s3_bucket_name") or existing_env.get("VITE_S3_BUCKET_NAME") or "cloudexam-storage-409289618109-dev"
    cf_domain = outputs.get("cloudfront_distribution_domain_name")
    if not cf_domain and existing_env.get("VITE_CLOUDFRONT_URL"):
        cf_domain = existing_env["VITE_CLOUDFRONT_URL"].replace("https://", "").replace("http://", "")
    if not cf_domain:
        cf_domain = "dw1cx1i04s8fe.cloudfront.net"
    cf_url = f"https://{cf_domain}"

    # Giữ lại Gemini API Key hiện tại nếu đã có trong .env (mặc định để trống)
    existing_key = existing_env.get("VITE_GEMINI_API_KEY", "")

    cognito_domain = outputs.get("cognito_domain") or existing_env.get("VITE_COGNITO_DOMAIN") or f"https://cloudexam-auth-{REGION}.auth.{REGION}.amazoncognito.com"

    content = f"""# ==============================================================================
# CLOUDEXAM FRONTEND ENVIRONMENT CONFIGURATION (.env)
# Tự động cập nhật bởi seed_cloud_data.py khi terraform apply
# ==============================================================================

# Chế độ kết nối AWS thật (false: gọi trực tiếp API Gateway; true: giả lập mock)
VITE_USE_MOCK=false

# AWS Region triển khai
VITE_AWS_REGION={REGION}

# URL API Gateway REST API
VITE_API_BASE_URL={api_url}

# Tên miền AWS Cognito Hosted UI
VITE_COGNITO_DOMAIN={cognito_domain}

# ID của Cognito User Pool
VITE_COGNITO_USER_POOL_ID={user_pool_id}

# Client ID của Cognito App Client SPA
VITE_COGNITO_CLIENT_ID={app_client_id}

# URL Callback sau khi xác thực
VITE_COGNITO_REDIRECT_URI={cf_url}/callback

# Cognito Identity Pool ID
VITE_IDENTITY_POOL_ID={identity_pool_id}

# Tên S3 Bucket lưu trữ ảnh thẻ và sơ đồ
VITE_S3_BUCKET_NAME={s3_bucket}

# CloudFront Website URL
VITE_CLOUDFRONT_URL={cf_url}

# ==============================================================================
# CẤU HÌNH GOOGLE GEMINI AI (Trích xuất đề thi & Gia sư ảo AI)
# ==============================================================================
VITE_GEMINI_API_KEY={existing_key}
VITE_GEMINI_MODEL=gemini-3.8-flash
"""
    try:
        with open(env_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[OK] Đã cập nhật {env_file} thành công!")

        # Đồng thời cập nhật .env.local cho môi trường dev localhost
        env_local = frontend_dir / ".env.local"
        content_local = content.replace(f"VITE_COGNITO_REDIRECT_URI={cf_url}/callback", "VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback")
        with open(env_local, "w", encoding="utf-8") as f:
            f.write(content_local)
        print(f"[OK] Đã cập nhật {env_local} thành công!")
    except Exception as e:
        print(f"[WARN] Không thể ghi .env: {e}")

def main():
    print("=================================================================")
    print("[*] KHỞI CHẠY NẠP DỮ LIỆU ĐÁM MÂY TỰ ĐỘNG (CLOUDEXAM SEEDER)")
    print("=================================================================")

    repo_root, data_dir, sample_faces_dir, tf_dir, frontend_dir = get_repo_paths()
    outputs = load_terraform_outputs(tf_dir)
    
    # Đọc từ existing_env nếu có (do Terraform local_file.frontend_env vừa tạo)
    env_file = frontend_dir / ".env"
    existing_env = {}
    if env_file.exists():
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        existing_env[k.strip()] = v.strip()
        except Exception:
            pass

    s3_bucket = outputs.get("s3_bucket_name") or existing_env.get("VITE_S3_BUCKET_NAME") or f"cloudexam-storage-409289618109-{ENV}"
    user_pool_id = outputs.get("cognito_user_pool_id") or existing_env.get("VITE_COGNITO_USER_POOL_ID") or ""
    
    # Khởi tạo boto3 clients
    cognito_client = boto3.client("cognito-idp", region_name=REGION)
    s3_client = boto3.client("s3", region_name=REGION)
    dynamodb = boto3.resource("dynamodb", region_name=REGION)

    # Nếu chưa có user_pool_id trong outputs, tự động tìm kiếm trong Region
    if not user_pool_id:
        try:
            pools = cognito_client.list_user_pools(MaxResults=10).get("UserPools", [])
            for p in pools:
                if "cloudexam" in p["Name"].lower():
                    user_pool_id = p["Id"]
                    print(f"[INFO] Tìm thấy Cognito User Pool: {user_pool_id} ({p['Name']})")
                    break
        except Exception as e:
            print(f"[WARN] Không thể tìm User Pool: {e}")

    # 1. Nạp tài khoản Cognito
    if user_pool_id:
        seed_cognito_users(cognito_client, user_pool_id)
    else:
        print("[WARN] Chưa phát hiện Cognito User Pool. Bỏ qua bước nạp tài khoản.")

    # 2. Tải ảnh chân dung thí sinh lên S3
    seed_s3_faces(s3_client, s3_bucket, sample_faces_dir)

    # 3. Nạp ngân hàng đề, câu hỏi, thí sinh và ca thi vào DynamoDB
    seed_dynamodb_data(dynamodb, s3_bucket)

    # 4. Cập nhật frontend/.env
    update_frontend_env_file(frontend_dir, outputs, cognito_client=cognito_client, user_pool_id=user_pool_id)

    print("\n=================================================================")
    print("[SUCCESS] ĐÃ NẠP TOÀN BỘ DỮ LIỆU KIỂM THỬ THÀNH CÔNG LÊN AWS CLOUD!")
    print("Tài khoản Giảng viên: annv@uet.vnu.edu.vn (MK: 12345678)")
    print("Tài khoản Thí sinh:   24020001@vnu.edu.vn - 24020007@vnu.edu.vn (MK: 12345678)")
    print("Ca thi trực tuyến:    EX-VNU-2026-01 (Trạng thái: RUNNING)")
    print("=================================================================\n")

if __name__ == "__main__":
    main()
