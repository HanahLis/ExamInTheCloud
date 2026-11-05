#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CloudExam - Script tạo và đồng bộ người dùng mẫu vào AWS Cognito User Pool
Tạo tài khoản Giảng viên (annv@uet.vnu.edu.vn) và các Thí sinh mẫu với mật khẩu CloudExam@2026
"""

import os
import sys
import json
import boto3

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "CloudExam@2026")

def get_cognito_pool_id():
    """Lấy User Pool ID từ Terraform State hoặc file frontend/.env"""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    # 1. Thử từ terraform.tfstate
    tf_state = os.path.join(repo_root, "backend", "terraform", "terraform.tfstate")
    if os.path.exists(tf_state):
        try:
            with open(tf_state, "r", encoding="utf-8") as f:
                state = json.load(f)
                val = state.get("outputs", {}).get("cognito_user_pool_id", {}).get("value")
                if val:
                    return val
        except Exception:
            pass

    # 2. Thử từ frontend/.env
    env_path = os.path.join(repo_root, "frontend", ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("VITE_COGNITO_USER_POOL_ID="):
                        val = line.strip().split("=", 1)[1]
                        if val:
                            return val
        except Exception:
            pass

    # 3. Fallback lấy User Pool đầu tiên tìm thấy trên AWS
    cognito = boto3.client("cognito-idp", region_name=REGION)
    pools = cognito.list_user_pools(MaxResults=10).get("UserPools", [])
    for p in pools:
        if "cloudexam" in p.get("Name", "").lower():
            return p["Id"]

    return None

def seed_users():
    pool_id = get_cognito_pool_id()
    if not pool_id:
        print("[LOI] Khong tim thay Cognito User Pool ID!")
        sys.exit(1)

    print(f"=== Bat dau nap nguoi dung mau vao Cognito User Pool: {pool_id} (Region: {REGION}) ===")
    cognito = boto3.client("cognito-idp", region_name=REGION)

    # Đảm bảo các group đã tồn tại
    groups = ["Admin", "Organizer", "Candidate"]
    for g in groups:
        try:
            cognito.create_group(UserPoolId=pool_id, GroupName=g, Description=f"Group {g}")
        except cognito.exceptions.GroupExistsException:
            pass
        except Exception as e:
            print(f"  [WARN] Khong the tao group {g}: {e}")

    # Đọc danh sách thí sinh từ candidates_seed.json
    candidates_file = os.path.join(os.path.dirname(__file__), "candidates_seed.json")
    candidates_list = []
    if os.path.exists(candidates_file):
        with open(candidates_file, "r", encoding="utf-8") as f:
            candidates_list = json.load(f)

    # Danh sách người dùng cần tạo
    users = []

    # Giảng viên & Admin
    users.append({
        "email": "annv@uet.vnu.edu.vn",
        "name": "PGS. TS. Nguyen Van An",
        "studentCode": "GV001",
        "groups": ["Organizer", "Admin"]
    })
    users.append({
        "email": "tranducmanh2006@gmail.com",
        "name": "Tran Duc Manh",
        "studentCode": "24021561",
        "groups": ["Organizer", "Admin"]
    })

    # Thí sinh
    for c in candidates_list:
        email = c.get("email", "").strip().lower()
        if not email or any(u["email"] == email for u in users):
            continue
        users.append({
            "email": email,
            "name": c.get("name", ""),
            "studentCode": c.get("studentCode", ""),
            "groups": ["Candidate"]
        })

    created_count = 0
    for u in users:
        email = u["email"]
        name = u["name"]
        code = u["studentCode"]
        user_groups = u["groups"]

        try:
            # 1. Tạo user hoặc bỏ qua nếu đã có
            try:
                attrs = [
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "name", "Value": name},
                ]
                if code:
                    attrs.append({"Name": "custom:student_code", "Value": code})

                cognito.admin_create_user(
                    UserPoolId=pool_id,
                    Username=email,
                    UserAttributes=attrs,
                    MessageAction="SUPPRESS"
                )
                print(f"[+] Tao tai khoan: {email} ({name})")
            except cognito.exceptions.UsernameExistsException:
                print(f"[i] Tai khoan da ton tai: {email}")

            # 2. Đặt mật khẩu vĩnh viễn (Permanent)
            cognito.admin_set_user_password(
                UserPoolId=pool_id,
                Username=email,
                Password=PASSWORD,
                Permanent=True
            )

            # 3. Gán vào User Groups
            for g in user_groups:
                try:
                    cognito.admin_add_user_to_group(
                        UserPoolId=pool_id,
                        Username=email,
                        GroupName=g
                    )
                except Exception:
                    pass

            created_count += 1
        except Exception as e:
            print(f"[!] Loi khi tao {email}: {e}")

    print(f"\n[OK] Da hoan tat nap {created_count}/{len(users)} tai khoan vao Cognito!")
    print(f"Mat khau mac dinh cho tat ca tai khoan: {PASSWORD} (hoac 12345678 tren giao dien)")

if __name__ == "__main__":
    seed_users()
