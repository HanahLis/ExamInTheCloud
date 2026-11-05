#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CloudExam Frontend Auto-Build & CloudFront CDN Deployment Script
Đóng gói React SPA và đồng bộ trực tiếp lên AWS S3 + CloudFront CDN.
"""

import os
import sys
import time
import mimetypes
import subprocess
import boto3

# Đảm bảo console Windows hỗ trợ UTF-8 an toàn
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Thiết lập bảng tra cứu MIME Type đầy đủ cho Single Page App
mimetypes.init()
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")

def get_content_type_and_cache(filename: str):
    ext = os.path.splitext(filename)[1].lower()
    ct, _ = mimetypes.guess_type(filename)
    if not ct:
        ct = "binary/octet-stream"

    if ext in [".html"]:
        # Trang index.html không được lưu cache lâu để đảm bảo nhận file JS hash mới tức thì
        return ct, "no-cache, no-store, must-revalidate"
    elif ext in [".js", ".css"]:
        # Các file bundle có hash nội dung (immutable cache 1 năm)
        return ct, "public, max-age=31536000, immutable"
    elif ext in [".svg", ".png", ".jpg", ".jpeg", ".ico", ".webp", ".woff2", ".ttf"]:
        return ct, "public, max-age=86400"
    else:
        return ct, "public, max-age=3600"

def sync_frontend_env(repo_root):
    """Tu dong dong bo file frontend/.env tu Terraform state truoc khi build"""
    tf_state_path = os.path.join(repo_root, "backend", "terraform", "terraform.tfstate")
    if not os.path.exists(tf_state_path):
        return

    try:
        import json
        with open(tf_state_path, "r", encoding="utf-8") as f:
            state = json.load(f)
        outputs = state.get("outputs", {})
        if not outputs:
            return

        api_url = outputs.get("api_gateway_base_url", {}).get("value")
        pool_id = outputs.get("cognito_user_pool_id", {}).get("value")
        client_id = outputs.get("cognito_app_client_id", {}).get("value")
        domain = outputs.get("cognito_domain", {}).get("value")
        id_pool = outputs.get("cognito_identity_pool_id", {}).get("value")
        s3_bucket = outputs.get("s3_bucket_name", {}).get("value")

        if pool_id and client_id:
            env_path = os.path.join(repo_root, "frontend", ".env")
            env_content = f"""VITE_USE_MOCK=false
VITE_AWS_REGION=ap-southeast-1
VITE_API_BASE_URL={api_url or ''}
VITE_COGNITO_DOMAIN={domain or ''}
VITE_COGNITO_USER_POOL_ID={pool_id}
VITE_COGNITO_CLIENT_ID={client_id}
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
VITE_IDENTITY_POOL_ID={id_pool or ''}
VITE_S3_BUCKET_NAME={s3_bucket or ''}
VITE_GEMINI_MODEL=gemini-3.8-flash
"""
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(env_content)
            print(f"[OK] Da tu dong dong bo frontend/.env tu Terraform state (Client ID: {client_id})")
    except Exception as e:
        print(f"[WARN] Khong the tu dong dong bo .env tu terraform state: {e}")

def get_aws_resources(region="ap-southeast-1"):
    """Lấy tên S3 Bucket và CloudFront Distribution ID"""
    s3_bucket = "cloudexam-frontend-dev"
    dist_id = "E2V9CSVBM0AR0M"
    dist_domain = "d1k0y12z0om7mp.cloudfront.net"

    # Thử lấy từ Terraform state nếu có
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    tf_dir = os.path.join(repo_root, "backend", "terraform")
    tf_state_path = os.path.join(tf_dir, "terraform.tfstate")

    if os.path.exists(tf_state_path):
        try:
            import json
            with open(tf_state_path, "r", encoding="utf-8") as f:
                state = json.load(f)
                outputs = state.get("outputs", {})
                if "cloudfront_distribution_id" in outputs:
                    dist_id = outputs["cloudfront_distribution_id"]["value"]
                if "cloudfront_distribution_domain_name" in outputs:
                    dist_domain = outputs["cloudfront_distribution_domain_name"]["value"]
        except Exception as e:
            print(f"[INFO] Dùng cấu hình CloudFront mặc định: {e}")

    # Fallback tự động dò tìm Distribution ID từ AWS nếu state chưa đồng bộ
    try:
        cf_client = boto3.client("cloudfront")
        dists = cf_client.list_distributions().get("DistributionList", {}).get("Items", [])
        for d in dists:
            comment = d.get("Comment", "")
            if "cloudexam" in comment.lower() or "spa" in comment.lower():
                dist_id = d["Id"]
                dist_domain = d["DomainName"]
                break
    except Exception:
        pass

    return s3_bucket, dist_id, dist_domain

def build_and_deploy():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    frontend_dir = os.path.join(repo_root, "frontend")
    dist_dir = os.path.join(frontend_dir, "dist")

    print("=================================================================")
    print("[*] BAT DAU QUY TRINH BUILD & DEPLOY CLOUDEXAM LEN CLOUDFRONT")
    print("=================================================================")

    # 1. Kiểm tra và Build Frontend
    index_html = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_html) and not os.environ.get("FORCE_BUILD"):
        print(f"\n[+] BUOC 1: Thu muc frontend/dist da co san ban build hop le ({index_html}).")
    else:
        print("\n[+] BUOC 1: Dang bien dich ma nguon Frontend (npm run build)...")
        build_cmd = "npm run build"
        result = subprocess.run(
            build_cmd,
            cwd=frontend_dir,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="ignore"
        )
        if result.returncode != 0:
            if os.path.exists(index_html):
                print("[WARN] npm build that bai nhung da co san ban dist truoc do, tiep tuc su dung.")
            else:
                print("[LOI] Qua trinh build that bai:")
                print(result.stdout)
                sys.exit(1)
        else:
            print("[OK] Da build thanh cong thu muc frontend/dist!")

    # 2. Kết nối AWS S3 và CloudFront
    s3_bucket, dist_id, dist_domain = get_aws_resources()
    print(f"\n[+] BUOC 2: Dong bo tep len AWS S3 Bucket '{s3_bucket}'...")
    s3_client = boto3.client("s3", region_name="ap-southeast-1")

    uploaded_count = 0
    total_bytes = 0

    for root, _, files in os.walk(dist_dir):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, dist_dir).replace("\\", "/")
            ct, cache_control = get_content_type_and_cache(file)

            with open(full_path, "rb") as f:
                data = f.read()
                total_bytes += len(data)

            s3_client.put_object(
                Bucket=s3_bucket,
                Key=rel_path,
                Body=data,
                ContentType=ct,
                CacheControl=cache_control
            )
            uploaded_count += 1
            print(f"  + Upload: /{rel_path} ({len(data)} bytes, Content-Type: {ct})")

    print(f"[OK] Da tai len tong cong {uploaded_count} tep (~{total_bytes // 1024} KB) len S3!")

    # 3. Tạo CloudFront Invalidation
    print(f"\n[+] BUOC 3: Kich hoat CloudFront Cache Invalidation (Distribution: {dist_id})...")
    cf_client = boto3.client("cloudfront")
    try:
        inv_res = cf_client.create_invalidation(
            DistributionId=dist_id,
            InvalidationBatch={
                "Paths": {
                    "Quantity": 1,
                    "Items": ["/*"]
                },
                "CallerReference": f"deploy-{int(time.time())}"
            }
        )
        inv_id = inv_res["Invalidation"]["Id"]
        print(f"[OK] Da phat lenh lam moi Cache CloudFront thanh cong! (Invalidation ID: {inv_id})")
    except Exception as e:
        print(f"[WARN] Khong the tao Invalidation: {e}")

    # 4. Hoàn tất và in URL
    print("\n=================================================================")
    print("[SUCCESS] HOAN THANH TRIEN KHAI CLOUDEXAM LEN AWS CLOUDFRONT CDN!")
    print(f"Website Demo Truc Tuyen: https://{dist_domain}")
    print("=================================================================\n")

if __name__ == "__main__":
    build_and_deploy()
