#!/usr/bin/env python3
"""
CloudExam - Script Nạp Dữ Liệu Mẫu Đa Quốc Gia / Đa Tenant (Multi-Tenant Seed Data)
Phụ trách: Phạm Tuấn Phong (24021596) — Task P-02

Mục tiêu:
1. Tạo dữ liệu mẫu phân tách an toàn giữa Việt Nam (cloudexam.vn) và Lào (edulao.la)
2. Sử dụng tiền tố Tenant Key:
   - Tenant VN: prefix `TENANT#VN#`
   - Tenant LA: prefix `TENANT#LA#`
3. Nạp đầy đủ 4 bảng DynamoDB:
   - CloudExam_QuestionBanks_dev
   - CloudExam_Questions_dev
   - CloudExam_Candidates_dev
   - CloudExam_Sessions_dev
4. Hỗ trợ chế độ `--dry-run` để kiểm thử cấu trúc dữ liệu không cần kết nối AWS.

Cách chạy:
    python seed_multitenant.py [--dry-run] [--region ap-southeast-1] [--env dev]
"""

import os
import sys
import json
import argparse
from pathlib import Path

DEFAULT_REGION = os.getenv("AWS_REGION", "ap-southeast-1")
DEFAULT_ENV = os.getenv("ENV", "dev")

# ==============================================================================
# DỮ LIỆU MẪU ĐA QUỐC GIA (VIỆT NAM & LÀO)
# ==============================================================================

MULTITENANT_DATA = {
    "question_banks": [
        {
            "id": "TENANT#VN#bank-cloud-01",
            "tenantId": "VN",
            "name": "Ngân hàng đề Kiến trúc AWS Cloud (Việt Nam)",
            "subject": "Điện toán đám mây",
            "description": "Ngân hàng đề thi chuẩn bị cho chứng chỉ AWS Certified Solutions Architect tại Việt Nam.",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#bank-cloud-lao",
            "tenantId": "LA",
            "name": "ທະນາຄານຄໍາຖາມ Cloud Computing (EduLao)",
            "subject": "ຄອມພິວເຕີຄລາວ (Cloud Computing)",
            "description": "ຊຸດຄໍາຖາມທົດສອບຄວາມຮູ້ພື້ນຖານ AWS Cloud ສໍາລັບນັກສຶກສາມະຫາວິທະຍາໄລແຫ່ງຊາດລາວ (NUOL).",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "questions": [
        # --- CÂU HỎI VIỆT NAM (TENANT#VN#) ---
        {
            "id": "TENANT#VN#q-aws-001",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Dịch vụ nào của AWS cung cấp khả năng tự động so khớp khuôn mặt thí sinh với ngưỡng tương đồng >= 80%?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Rekognition",
                "Amazon Textract",
                "Amazon Comprehend",
                "Amazon SageMaker"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Rekognition",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "EASY",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-002",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Kiến trúc Serverless giúp hệ thống đạt tiêu chí FinOps $0 Free Tier bằng cơ chế nào sau đây?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Luôn giữ máy chủ EC2 chạy ngầm 24/7",
                "Pay-as-you-go: Chỉ trả tiền khi có request, không tốn chi phí khi phòng thi không hoạt động",
                "Bắt buộc mua gói tài nguyên trả trước Reserved Instances 3 năm",
                "Sử dụng cụm Kubernetes EKS đa vùng"
            ],
            "correctIndex": 1,
            "correctAnswer": "Pay-as-you-go: Chỉ trả tiền khi có request, không tốn chi phí khi phòng thi không hoạt động",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-003",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Để bảo vệ hệ thống trước tình trạng hàng trăm sinh viên nộp bài cùng lúc vào giây cuối cùng, CloudExam sử dụng dịch vụ gì làm bộ đệm?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon S3 Glacier",
                "Amazon SQS (Simple Queue Service) & DLQ",
                "Amazon Aurora Read Replica",
                "AWS Route 53"
            ],
            "correctIndex": 1,
            "correctAnswer": "Amazon SQS (Simple Queue Service) & DLQ",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#VN#q-aws-004",
            "tenantId": "VN",
            "bankId": "TENANT#VN#bank-cloud-01",
            "content": "Khi xảy ra sự cố đứt cáp biển tại Singapore, cơ chế Zero-ClickOps tự động chuyển DNS sang Jakarta bằng dịch vụ nào?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Route 53 DNS Failover Routing Policy & Health Check",
                "AWS CloudFormation",
                "Amazon CloudWatch Log Insights",
                "Amazon EventBridge"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Route 53 DNS Failover Routing Policy & Health Check",
            "score": 2.5,
            "subject": "Điện toán đám mây",
            "difficulty": "HARD",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- CÂU HỎI LÀO (TENANT#LA#) ---
        {
            "id": "TENANT#LA#q-aws-001",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ບໍລິການໃດຂອງ AWS ທີ່ໃຊ້ໃນການກວດສອບໃບໜ້າຂອງຜູ້ສອບເສັງແບບອັດຕະໂນມັດ (Biometric Face Verification)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon Rekognition",
                "Amazon Polly",
                "Amazon Translate",
                "Amazon Lex"
            ],
            "correctIndex": 0,
            "correctAnswer": "Amazon Rekognition",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "EASY",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-002",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ຖານຂໍ້ມູນໃດຂອງ AWS ທີ່ເປັນ NoSQL Serverless ແລະ ເກັບຄ່າບໍລິການຕາມການໃຊ້ງານຕົວຈິງ (On-Demand)?",
            "type": "SINGLE_CHOICE",
            "options": [
                "Amazon RDS PostgreSQL",
                "Amazon DynamoDB",
                "Amazon Redshift",
                "Amazon ElastiCache"
            ],
            "correctIndex": 1,
            "correctAnswer": "Amazon DynamoDB",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-003",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "ເມື່ອເກີດເຫດສຸກເສີນຢູ່ສູນຂໍ້ມູນສິງກະໂປ, ລະບົບ EduLao ຈະປ່ຽນເສັ້ນທາງໄປຫາສູນຂໍ້ມູນໃດ?",
            "type": "SINGLE_CHOICE",
            "options": [
                "ap-southeast-3 (Jakarta, ອິນໂດເນເຊຍ)",
                "us-east-1 (N. Virginia)",
                "eu-central-1 (Frankfurt)",
                "ap-northeast-1 (Tokyo)"
            ],
            "correctIndex": 0,
            "correctAnswer": "ap-southeast-3 (Jakarta, ອິນໂດເນເຊຍ)",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "HARD",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "id": "TENANT#LA#q-aws-004",
            "tenantId": "LA",
            "bankId": "TENANT#LA#bank-cloud-lao",
            "content": "Cloudflare Turnstile ມີໜ້າທີ່ຫຼັກອັນໃດໃນລະບົບຫ້ອງສອບເສັງ EduLao?",
            "type": "SINGLE_CHOICE",
            "options": [
                "ປ້ອງກັນ Botnet ແລະ Script ອັດຕະໂນມັດໂດຍບໍ່ຕ້ອງກົດເລືອກຮູບພາບ (Invisible CAPTCHA)",
                "ແປພາສາອັດຕະໂນມັດ",
                "ບັນທຶກສຽງໃນຫ້ອງສອບເສັງ",
                "ສ້າງບົດສອບເສັງແບບສຸ່ມ"
            ],
            "correctIndex": 0,
            "correctAnswer": "ປ້ອງກັນ Botnet ແລະ Script ອັດຕະໂນມັດໂດຍບໍ່ຕ້ອງກົດເລືອກຮູບພາບ (Invisible CAPTCHA)",
            "score": 2.5,
            "subject": "ຄອມພິວເຕີຄລາວ",
            "difficulty": "MEDIUM",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "candidates": [
        # --- THÍ SINH VIỆT NAM (TENANT#VN#) ---
        {
            "email": "phongpt@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021596",
            "name": "Phạm Tuấn Phong",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN001.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "manhtd@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021561",
            "name": "Trần Đức Mạnh",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN002.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "tannp@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24021620",
            "name": "Nguyễn Phúc Tấn",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN003.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "hantt@cloudexam.vn",
            "tenantId": "VN",
            "studentCode": "VN24020115",
            "name": "Nguyễn Thị Ngọc Hà",
            "className": "D21CQCN01-VN",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/B21DCCN004.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- THÍ SINH LÀO (TENANT#LA#) ---
        {
            "email": "somphone@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-001",
            "name": "Somphone Phomvihane",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA001.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "keomany@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-002",
            "name": "Keomany Vongsavanh",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA002.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        },
        {
            "email": "anousone@edulao.la",
            "tenantId": "LA",
            "studentCode": "LA2026-003",
            "name": "Anousone Sayasane",
            "className": "NUOL-CS-01",
            "faceImageUrl": "https://cloudexam-storage-409289618109-dev.s3.ap-southeast-1.amazonaws.com/faces/LA003.jpg",
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ],
    "sessions": [
        # --- CA THI VIỆT NAM (TENANT#VN#) ---
        {
            "id": "TENANT#VN#SES-VN-2026",
            "tenantId": "VN",
            "name": "Kỳ thi Khảo sát Năng lực AWS Cloud Việt Nam 2026",
            "status": "RUNNING",
            "startTime": "2026-10-23T08:00:00Z",
            "endTime": "2026-10-23T18:00:00Z",
            "durationMinutes": 45,
            "questionIds": [
                "TENANT#VN#q-aws-001",
                "TENANT#VN#q-aws-002",
                "TENANT#VN#q-aws-003",
                "TENANT#VN#q-aws-004"
            ],
            "candidateEmails": [
                "phongpt@cloudexam.vn",
                "manhtd@cloudexam.vn",
                "tannp@cloudexam.vn",
                "hantt@cloudexam.vn"
            ],
            "createdAt": "2026-10-23T08:00:00Z"
        },
        # --- CA THI LÀO (TENANT#LA#) ---
        {
            "id": "TENANT#LA#SES-LA-2026",
            "tenantId": "LA",
            "name": "ການສອບເສັງ CloudExam Lao 2026 (EduLao)",
            "status": "RUNNING",
            "startTime": "2026-10-23T08:00:00Z",
            "endTime": "2026-10-23T18:00:00Z",
            "durationMinutes": 45,
            "questionIds": [
                "TENANT#LA#q-aws-001",
                "TENANT#LA#q-aws-002",
                "TENANT#LA#q-aws-003",
                "TENANT#LA#q-aws-004"
            ],
            "candidateEmails": [
                "somphone@edulao.la",
                "keomany@edulao.la",
                "anousone@edulao.la"
            ],
            "createdAt": "2026-10-23T08:00:00Z"
        }
    ]
}

def main():
    parser = argparse.ArgumentParser(description="Seed multi-tenant data for Vietnam and Laos into DynamoDB.")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm hiển thị cấu trúc dữ liệu, không ghi lên AWS")
    parser.add_argument("--region", default=DEFAULT_REGION, help="AWS Region (mặc định: ap-southeast-1)")
    parser.add_argument("--env", default=DEFAULT_ENV, help="Môi trường (dev, staging, prod)")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    output_backup = script_dir / "multitenant_seed.json"

    # Lưu backup JSON
    with open(output_backup, "w", encoding="utf-8") as f:
        json.dump(MULTITENANT_DATA, f, ensure_ascii=False, indent=2)

    print("=================================================================")
    print("🌏 CLOUDEXAM - NẠP DỮ LIỆU ĐA QUỐC GIA (VIỆT NAM & LÀO)")
    print("=================================================================")
    print(f"📍 Region: {args.region} | Môi trường: {args.env}")
    print(f"🇻🇳 Tenant Việt Nam: 4 thí sinh, 1 ngân hàng, 4 câu hỏi, 1 ca thi")
    print(f"🇱🇦 Tenant Lào:      3 thí sinh, 1 ngân hàng, 4 câu hỏi, 1 ca thi")
    print(f"📁 Tệp sao lưu:      {output_backup.name}")
    print(f"🔍 Chế độ Dry-Run:   {'BẬT (Chỉ kiểm tra cấu trúc dữ liệu)' if args.dry_run else 'TẮT (Ghi lên AWS DynamoDB)'}")
    print("-----------------------------------------------------------------")

    if args.dry_run:
        print("\n✅ [DRY-RUN THÀNH CÔNG] Dữ liệu mẫu Multi-Tenant hợp lệ:")
        print(f"   • Question Banks: {len(MULTITENANT_DATA['question_banks'])} bản ghi")
        print(f"   • Questions:      {len(MULTITENANT_DATA['questions'])} bản ghi")
        print(f"   • Candidates:     {len(MULTITENANT_DATA['candidates'])} bản ghi")
        print(f"   • Sessions:       {len(MULTITENANT_DATA['sessions'])} bản ghi")
        print("\n👉 Cấu trúc dữ liệu đã được lưu an toàn tại backend/data/multitenant_seed.json.")
        return

    try:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=args.region)

        tables = {
            "question_banks": dynamodb.Table(f"CloudExam_QuestionBanks_{args.env}"),
            "questions": dynamodb.Table(f"CloudExam_Questions_{args.env}"),
            "candidates": dynamodb.Table(f"CloudExam_Candidates_{args.env}"),
            "sessions": dynamodb.Table(f"CloudExam_Sessions_{args.env}"),
        }

        for table_key, items in MULTITENANT_DATA.items():
            table = tables[table_key]
            print(f"--> Đang nạp {len(items)} bản ghi vào bảng {table.name}...")
            for item in items:
                table.put_item(Item=item)
            print(f"    [Xong] Bảng {table.name} đã được cập nhật.")

        print("\n=================================================================")
        print("🎉 NẠP THÀNH CÔNG DỮ LIỆU MULTI-TENANT LÊN AWS DYNAMODB!")
        print("=================================================================")

    except Exception as e:
        print(f"\n❌ Lỗi khi nạp dữ liệu DynamoDB: {e}")
        print("👉 Gợi ý: Kiểm tra AWS Credentials hoặc chạy với cờ `--dry-run`.")
        sys.exit(1)

if __name__ == "__main__":
    main()

