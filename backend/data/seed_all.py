#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CloudExam - Script Tổng Hợp Nạp Dữ Liệu Mẫu (Cognito Users + DynamoDB Seed + S3 Faces)
Chạy một lệnh duy nhất để khởi tạo toàn bộ người dùng, dữ liệu thi cử và ảnh thẻ sinh trắc học S3.
"""

import os
import sys
import subprocess

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def run_script(script_name):
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    print(f"\n=======================================================")
    print(f"[*] DANG CHAY: {script_name}...")
    print(f"=======================================================")
    res = subprocess.run([sys.executable, script_path], check=False)
    if res.returncode != 0:
        print(f"[CANH BAO] {script_name} thoat voi ma loi: {res.returncode}")
    else:
        print(f"[OK] {script_name} hoan tat thanh cong!")

def main():
    print("=================================================================")
    print("🚀 KHOI TAO TOAN BO DU LIEU MAU CLOUDEXAM (COGNITO + DYNAMODB + S3)")
    print("=================================================================")
    run_script("seed_cognito.py")
    run_script("seed_dynamodb.py")
    run_script("seed_multitenant.py")
    run_script("upload_sample_faces.py")
    print("\n=================================================================")
    print("🎉 HOAN TAT TOAN BO TIEN TRINH KHOI TAO DU LIEU!")
    print("Ban co the dang nhap ngay bang tai khoan:")
    print("  - Email: annv@uet.vnu.edu.vn")
    print("  - Mat khau: 12345678 (hoac CloudExam@2026)")
    print("=================================================================")

if __name__ == "__main__":
    main()

from flask import Flask
app = Flask(__name__)
@app.route("/")
def index():
    return {"message": "Hello, API!"}
if __name__ == "__main__":
    app.run(host="127.0.0.1", port = 5000, debug=True)
    from flask import Flask, jsonify, request

app = Flask(__name__)

# Dữ liệu sách mẫu
BOOKS = [
    {"id": "b1", "t": "Học Python căn bản"},
    {"id": "b2", "t": "Flask Web Development"},
    {"id": "b3", "t": "Python nâng cao"},
    {"id": "b4", "t": "JavaScript toàn tập"}
]

def find_by_id(book_id):
    for book in BOOKS:
        if book["id"] == book_id:
            return book
    return None

# 1. Path param (string)
@app.route("/books/<book_id>", methods=["GET"])
def get_book(book_id):
    book = find_by_id(book_id)
    if book is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(book), 200

# 2. Path param ép kiểu int
@app.route("/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    return jsonify({"id": item_id}), 200

# 3. Query string (bộ lọc / phân trang)
@app.route("/books", methods=["GET"])
def list_books():
    limit = int(request.args.get("limit", 20))
    q = request.args.get("q", "").strip().lower()
    items = [b for b in BOOKS if q in b["t"].lower()]
    return jsonify({"items": items[:limit]}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)