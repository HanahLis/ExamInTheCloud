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
