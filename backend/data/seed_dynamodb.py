"""
Script nạp dữ liệu mẫu (Seed Data) vào các bảng DynamoDB cho dự án CloudExam.
Phụ trách: Phong (DynamoDB + S3)

Cách chạy:
    pip install boto3
    python seed_dynamodb.py
"""

import json
import os
import boto3

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")

dynamodb = boto3.resource("dynamodb", region_name=REGION)

def load_json(filename):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def seed_questions():
    table_name = f"CloudExam_Questions_{ENV}"
    table = dynamodb.Table(table_name)
    data = load_json("questions_seed.json")
    print(f"--> Đang nạp {len(data)} câu hỏi vào bảng {table_name}...")
    for item in data:
        table.put_item(Item=item)
    print("    [Xong] Nạp câu hỏi thành công.")

def seed_candidates():
    table_name = f"CloudExam_Candidates_{ENV}"
    table = dynamodb.Table(table_name)
    data = load_json("candidates_seed.json")
    print(f"--> Đang nạp {len(data)} thí sinh vào bảng {table_name}...")
    for item in data:
        table.put_item(Item=item)
    print("    [Xong] Nạp thí sinh thành công.")

def seed_sessions():
    table_name = f"CloudExam_Sessions_{ENV}"
    table = dynamodb.Table(table_name)
    data = load_json("sessions_seed.json")
    print(f"--> Đang nạp {len(data)} ca thi vào bảng {table_name}...")
    for item in data:
        table.put_item(Item=item)
    print("    [Xong] Nạp ca thi thành công.")

if __name__ == "__main__":
    print(f"=== Bắt đầu nạp dữ liệu mẫu vào DynamoDB (Region: {REGION}, Env: {ENV}) ===")
    try:
        seed_questions()
        seed_candidates()
        seed_sessions()
        print("=== TẤT CẢ DỮ LIỆU ĐÃ ĐƯỢC NẠP THÀNH CÔNG ===")
    except Exception as e:
        print(f"[LỖI]: {e}")
        print("Vui lòng kiểm tra AWS credentials và tên bảng DynamoDB.")

