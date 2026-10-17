#!/usr/bin/env python3
"""
CloudExam - Script tải ảnh thẻ chân dung thí sinh lên Amazon S3 & đồng bộ vào DynamoDB
Phụ trách: Phạm Tuấn Phong (AI Rekognition, Dữ Liệu Ảnh Thẻ & CloudWatch Alarms)

Chức năng:
1. Đọc danh sách thí sinh từ `candidates_seed.json` hoặc từ thư mục ảnh `backend/data/sample_faces/`
2. Tải từng file ảnh thẻ (`faces/{studentCode}.jpg`) lên S3 Bucket `cloudexam-storage-...-dev`
3. Cập nhật trường `faceImageUrl` trong bảng DynamoDB `CloudExam_Candidates_dev`
4. Cập nhật lại đường dẫn S3 vào file `candidates_seed.json` để đồng bộ
5. Hỗ trợ chế độ `--dry-run` và tạo ảnh mẫu thử nghiệm nếu chưa có ảnh chân dung thật

Cách dùng:
    python upload_sample_faces.py [--dry-run] [--dir sample_faces] [--bucket TÊN_BUCKET]
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Cấu hình mặc định
DEFAULT_REGION = os.getenv("AWS_REGION", "ap-southeast-1")
DEFAULT_ENV = os.getenv("ENV", "dev")
DEFAULT_BUCKET = os.getenv("S3_BUCKET_NAME", "cloudexam-storage-409289618109-dev")

def create_sample_placeholder_jpeg(output_path: Path, student_code: str, name: str):
    """
    Tạo ảnh JPEG đơn giản có header chuẩn nếu máy tính chưa có ảnh chân dung thật.
    Sử dụng PIL nếu có, hoặc tạo file JPEG nhị phân tối giản hợp lệ.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGB", (400, 500), color=(220, 235, 252))
        draw = ImageDraw.Draw(img)
        
        # Vẽ khung ảnh thẻ
        draw.rectangle([10, 10, 390, 490], outline=(37, 99, 235), width=3)
        # Vẽ hình tượng trưng khuôn mặt (đầu và thân)
        draw.ellipse([140, 80, 260, 200], fill=(245, 158, 11), outline=(180, 83, 9), width=2) # Đầu
        draw.ellipse([100, 210, 300, 380], fill=(59, 130, 246)) # Thân áo
        
        # Thêm text thông tin
        info_text = f"{student_code}\n{name}"
        draw.text((200, 420), info_text, fill=(30, 41, 59), anchor="mm")
        
        img.save(output_path, "JPEG", quality=90)
        return True
    except ImportError:
        # Tạo file ảnh JPEG tối giản 1x1 pixel hợp lệ
        # FF D8 FF E0 ... FF D9
        minimal_jpeg_bytes = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
            0x00, 0xBF, 0x80, 0xFF, 0xD9
        ])
        with open(output_path, "wb") as f:
            f.write(minimal_jpeg_bytes)
        return False

def main():
    parser = argparse.ArgumentParser(description="Upload sample face images to S3 and sync with DynamoDB.")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm không upload lên AWS")
    parser.add_argument("--dir", default="sample_faces", help="Thư mục chứa ảnh thẻ thí sinh")
    parser.add_argument("--bucket", default=DEFAULT_BUCKET, help="Tên S3 Bucket lưu trữ ảnh")
    parser.add_argument("--region", default=DEFAULT_REGION, help="AWS Region (mặc định: ap-southeast-1)")
    parser.add_argument("--env", default=DEFAULT_ENV, help="Môi trường (dev, staging, prod)")
    parser.add_argument("--sync-seed-json", action="store_true", default=True, help="Đồng bộ URL S3 vào candidates_seed.json")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    faces_dir = script_dir / args.dir
    faces_dir.mkdir(parents=True, exist_ok=True)

    seed_file = script_dir / "candidates_seed.json"
    if not seed_file.exists():
        print(f"❌ Không tìm thấy file seed thí sinh tại: {seed_file}")
        sys.exit(1)

    with open(seed_file, "r", encoding="utf-8") as f:
        candidates = json.load(f)

    print(f"=================================================================")
    print(f"🚀 CLOUDEXAM - SCRIPT NẠP ẢNH THẺ THÍ SINH VÀO S3 & DYNAMODB")
    print(f"=================================================================")
    print(f"📍 Region: {args.region} | Môi trường: {args.env}")
    print(f"🪣 Target S3 Bucket: {args.bucket}")
    print(f"📁 Thư mục ảnh thẻ: {faces_dir}")
    print(f"👥 Tổng số thí sinh: {len(candidates)}")
    print(f"🔍 Chế độ Dry-Run: {'BẬT (Chỉ kiểm tra, không upload)' if args.dry_run else 'TẮT (Upload thật lên AWS)'}")
    print(f"-----------------------------------------------------------------")

    # Khởi tạo boto3 clients nếu không ở chế độ dry-run
    s3_client = None
    dynamodb = None
    candidates_table = None

    if not args.dry_run:
        try:
            import boto3
            s3_client = boto3.client("s3", region_name=args.region)
            dynamodb = boto3.resource("dynamodb", region_name=args.region)
            table_name = f"CloudExam_Candidates_{args.env}"
            candidates_table = dynamodb.Table(table_name)
        except Exception as e:
            print(f"⚠️ Không thể khởi tạo AWS Client: {e}")
            print("👉 Bạn vẫn có thể chạy với cờ `--dry-run` để chuẩn bị ảnh thẻ mẫu.")
            sys.exit(1)

    updated_count = 0
    updated_candidates = []

    for cand in candidates:
        student_code = cand.get("studentCode")
        email = cand.get("email")
        name = cand.get("name")

        # Tìm file ảnh thẻ trong thư mục (hỗ trợ .jpg, .jpeg, .png)
        img_file = None
        for ext in (".jpg", ".jpeg", ".png"):
            check_file = faces_dir / f"{student_code}{ext}"
            if check_file.exists():
                img_file = check_file
                break

        # Nếu chưa có ảnh trong thư mục, tự động tạo ảnh mẫu placeholder
        if not img_file or not img_file.exists():
            img_file = faces_dir / f"{student_code}.jpg"
            print(f"⚠️ Chưa có ảnh thật cho thí sinh {student_code} ({name}). Đang tạo ảnh placeholder...")
            create_sample_placeholder_jpeg(img_file, student_code, name)

        s3_key = f"faces/{student_code}.jpg"
        s3_url = f"https://{args.bucket}.s3.{args.region}.amazonaws.com/{s3_key}"

        print(f"\n👤 Thí sinh: {name} ({student_code} - {email})")
        print(f"   📂 Tệp nguồn: {img_file.name} ({img_file.stat().st_size} bytes)")
        print(f"   ☁️ S3 Destination: s3://{args.bucket}/{s3_key}")
        print(f"   🔗 S3 Public URL: {s3_url}")

        if args.dry_run:
            print("   [DRY-RUN] Bỏ qua thao tác upload S3 và update DynamoDB.")
        else:
            try:
                # 1. Tải ảnh lên S3
                with open(img_file, "rb") as data_file:
                    s3_client.put_object(
                        Bucket=args.bucket,
                        Key=s3_key,
                        Body=data_file,
                        ContentType="image/jpeg"
                    )
                print("   ✅ Upload S3 thành công!")

                # 2. Cập nhật DynamoDB
                candidates_table.update_item(
                    Key={"email": email},
                    UpdateExpression="SET faceImageUrl = :url",
                    ExpressionAttributeValues={":url": s3_url}
                )
                print(f"   ✅ Đã cập nhật faceImageUrl vào bảng DynamoDB!")
                updated_count += 1
            except Exception as e:
                print(f"   ❌ Lỗi khi tải ảnh hoặc cập nhật DynamoDB: {e}")

        cand_copy = dict(cand)
        cand_copy["faceImageUrl"] = s3_url
        updated_candidates.append(cand_copy)

    # Đồng bộ lại candidates_seed.json
    if args.sync_seed_json:
        try:
            with open(seed_file, "w", encoding="utf-8") as f:
                json.dump(updated_candidates, f, ensure_ascii=False, indent=2)
            print(f"\n✅ Đã đồng bộ URL S3 mới vào file: {seed_file.name}")
        except Exception as e:
            print(f"⚠️ Không thể cập nhật candidates_seed.json: {e}")

    print(f"\n=================================================================")
    print(f"🎉 HOÀN TẤT: Đã xử lý {len(candidates)} thí sinh.")
    if not args.dry_run:
        print(f"⭐ Số lượng bản ghi cập nhật thành công lên AWS: {updated_count}/{len(candidates)}")
    print(f"💡 Hướng dẫn: Đặt ảnh thẻ thật vào thư mục: `{faces_dir.relative_to(script_dir.parent.parent)}/`")
    print(f"   Tên file đặt theo Mã sinh viên: B21DCCN001.jpg, B21DCCN002.jpg,...")
    print(f"=================================================================")

if __name__ == "__main__":
    main()

