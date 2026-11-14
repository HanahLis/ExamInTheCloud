#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CloudExam Frontend Auto-Build & CloudFront CDN Deployment Script
Đóng gói React SPA và đồng bộ trực tiếp lên AWS S3 + CloudFront CDN.

Hỗ trợ cả 2 chế độ:
  1. Thư viện Python `boto3` (nếu đã cài đặt qua `pip install boto3`)
  2. Công cụ dòng lệnh `aws` CLI (fallback tự động nếu chưa có boto3)
"""

import os
import sys
import time
import json
import mimetypes
import subprocess

try:
    import boto3
except ImportError:
    boto3 = None

# Đảm bảo console Windows hỗ trợ UTF-8 an toàn
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

mimetypes.init()
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(REPO_ROOT, "frontend")
DIST_DIR = os.path.join(FRONTEND_DIR, "dist")
TF_DIR = os.path.join(REPO_ROOT, "backend", "terraform")


def get_content_type_and_cache(filename: str):
    ext = os.path.splitext(filename)[1].lower()
    ct, _ = mimetypes.guess_type(filename)
    if not ct:
        ct = "binary/octet-stream"

    if ext in [".html"]:
        return ct, "no-cache, no-store, must-revalidate"
    elif ext in [".js", ".css"]:
        return ct, "public, max-age=31536000, immutable"
    elif ext in [".svg", ".png", ".jpg", ".jpeg", ".ico", ".webp", ".woff2", ".ttf"]:
        return ct, "public, max-age=86400"
    else:
        return ct, "public, max-age=3600"


def _tf_outputs() -> dict:
    try:
        raw = subprocess.check_output(
            ["terraform", f"-chdir={TF_DIR}", "output", "-json"],
            text=True, encoding="utf-8", errors="ignore", stderr=subprocess.DEVNULL,
        )
        return json.loads(raw or "{}")
    except Exception:
        return {}


def get_aws_resources():
    """Lấy S3 Bucket, CloudFront Distribution ID/Domain từ env -> terraform -> frontend/.env -> AWS API / CLI."""
    region = os.environ.get("AWS_REGION", "ap-southeast-1")
    s3_bucket = os.environ.get("S3_BUCKET", "")
    dist_id = os.environ.get("CLOUDFRONT_DIST_ID", "")
    dist_domain = os.environ.get("CLOUDFRONT_DOMAIN", "")

    # 1. Đọc từ terraform output
    if not (s3_bucket and dist_id):
        out = _tf_outputs()

        def val(key):
            entry = out.get(key) or {}
            return entry.get("value") or ""

        s3_bucket = s3_bucket or val("frontend_hosting_bucket_name") or val("s3_bucket_name")
        dist_id = dist_id or val("cloudfront_distribution_id")
        dist_domain = dist_domain or val("cloudfront_distribution_domain_name")

    # 2. Đọc từ frontend/.env nếu còn thiếu
    env_file = os.path.join(FRONTEND_DIR, ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("VITE_CLOUDFRONT_URL=") and not dist_domain:
                        dist_domain = line.split("=", 1)[1].strip().replace("https://", "").replace("http://", "").rstrip("/")
                    elif line.startswith("VITE_S3_BUCKET_NAME=") and not s3_bucket:
                        # Storage bucket thường cùng prefix
                        candidate_storage = line.split("=", 1)[1].strip()
                        if "storage" in candidate_storage:
                            s3_bucket = candidate_storage.replace("storage", "frontend")
        except Exception:
            pass

    # Quy ước mặc định nếu chưa có
    if not s3_bucket:
        s3_bucket = "cloudexam-frontend-dev"

    if not dist_domain:
        dist_domain = "cloudexam.id.vn"

    # 3. Tự dò qua boto3 (nếu có) hoặc AWS CLI
    if not dist_id:
        if boto3:
            try:
                cf_client = boto3.client("cloudfront")
                for d in cf_client.list_distributions().get("DistributionList", {}).get("Items", []):
                    dom = d.get("DomainName", "")
                    aliases = (d.get("Aliases") or {}).get("Items", [])
                    comment = (d.get("Comment") or "").lower()
                    if (dist_domain and (dom == dist_domain or dist_domain in aliases)) or "cloudexam" in comment or "spa" in comment:
                        dist_id = d["Id"]
                        break
            except Exception as exc:
                print(f"[INFO] Boto3 khong the tu do CloudFront Distribution: {exc}")
        else:
            try:
                res_cf = subprocess.run(
                    ["aws", "cloudfront", "list-distributions", "--query", "DistributionList.Items[*].{Id:Id,DomainName:DomainName,Aliases:Aliases.Items,Comment:Comment}", "--output", "json"],
                    capture_output=True, text=True, check=False,
                )
                if res_cf.returncode == 0:
                    items = json.loads(res_cf.stdout or "[]")
                    for d in items:
                        dom = d.get("DomainName", "")
                        aliases = d.get("Aliases") or []
                        comment = (d.get("Comment") or "").lower()
                        if (dist_domain and (dom == dist_domain or dist_domain in aliases)) or "cloudexam" in comment or "spa" in comment:
                            dist_id = d["Id"]
                            break
            except Exception:
                pass

    if not dist_id:
        dist_id = "E1Z09LJOHV5ZJ2"
        dist_domain = "cloudexam.id.vn"

    return s3_bucket, dist_id, dist_domain


def build_and_deploy():
    print("=================================================================")
    print("[*] BAT DAU QUY TRINH BUILD & DEPLOY CLOUDEXAM LEN CLOUDFRONT")
    print("=================================================================")

    print("\n[+] BUOC 1: Dang bien dich ma nguon Frontend (npm run build)...")
    result = subprocess.run(
        "npm run build",
        cwd=FRONTEND_DIR,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    if result.returncode != 0:
        if os.path.exists(os.path.join(DIST_DIR, "index.html")):
            print("[WARN] npm build that bai nhung da co san ban dist truoc do, tiep tuc su dung.")
        else:
            print("[LOI] Qua trinh build that bai:")
            print(result.stdout)
            sys.exit(1)
    else:
        print("[OK] Da build thanh cong thu muc frontend/dist voi bien moi truong moi nhat!")

    s3_bucket, dist_id, dist_domain = get_aws_resources()
    region = os.environ.get("AWS_REGION", "ap-southeast-1")

    print(f"\n[+] BUOC 2: Dong bo tep len AWS S3 Bucket '{s3_bucket}' (region {region})...")

    if boto3:
        try:
            s3_client = boto3.client("s3", region_name=region)
            uploaded_count = 0
            total_bytes = 0
            for root, _, files in os.walk(DIST_DIR):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, DIST_DIR).replace("\\", "/")
                    ct, cache_control = get_content_type_and_cache(file)
                    with open(full_path, "rb") as f:
                        data = f.read()
                    total_bytes += len(data)
                    s3_client.put_object(
                        Bucket=s3_bucket,
                        Key=rel_path,
                        Body=data,
                        ContentType=ct,
                        CacheControl=cache_control,
                    )
                    uploaded_count += 1
                    print(f"  + Upload: /{rel_path} ({len(data)} bytes, Content-Type: {ct})")

            print(f"[OK] Da tai len tong cong {uploaded_count} tep (~{total_bytes // 1024} KB) len S3 bang boto3!")
        except Exception as exc:
            print(f"[LOI] Boto3 khong the upload len S3: {exc}")
            print("[*] Dang thu lai bang AWS CLI (aws s3 sync)...")
            res_sync = subprocess.run(["aws", "s3", "sync", DIST_DIR, f"s3://{s3_bucket}", "--delete"], check=False)
            if res_sync.returncode != 0:
                print("[LOI] Khong the tai len S3. Vui long kiem tra AWS credentials (`aws configure`).")
                sys.exit(1)
    else:
        print("[INFO] Thu vien 'boto3' chua duoc cai dat. Tu dong su dung cong cu 'aws' CLI...")
        res_sync = subprocess.run(["aws", "s3", "sync", DIST_DIR, f"s3://{s3_bucket}", "--delete"], check=False)
        if res_sync.returncode != 0:
            print("[LOI] Khong the tai len S3 qua AWS CLI.")
            print("[HUONG DAN] Ban co the cai dat boto3 bang lenh: pip install boto3")
            print("            Hoac kiem tra lai quyen AWS bang lenh: aws configure")
            sys.exit(1)
        print("[OK] Da dong bo thanh cong thu muc dist len S3 bang AWS CLI!")

    print(f"\n[+] BUOC 3: Kich hoat CloudFront Cache Invalidation (Distribution: {dist_id or 'Auto'})...")
    if dist_id:
        if boto3:
            try:
                cf_client = boto3.client("cloudfront")
                inv_res = cf_client.create_invalidation(
                    DistributionId=dist_id,
                    InvalidationBatch={
                        "Paths": {"Quantity": 1, "Items": ["/*"]},
                        "CallerReference": f"deploy-{int(time.time())}",
                    },
                )
                print(f"[OK] Da lam moi Cache CloudFront! (Invalidation ID: {inv_res['Invalidation']['Id']})")
            except Exception as exc:
                print(f"[WARN] Boto3 khong the tao Invalidation: {exc}")
                subprocess.run(["aws", "cloudfront", "create-invalidation", "--distribution-id", dist_id, "--paths", "/*"], check=False)
        else:
            res_inv = subprocess.run(["aws", "cloudfront", "create-invalidation", "--distribution-id", dist_id, "--paths", "/*"], check=False)
            if res_inv.returncode == 0:
                print(f"[OK] Da lam moi Cache CloudFront thanh cong bang AWS CLI!")
            else:
                print(f"[WARN] Khong the tao Invalidation qua AWS CLI.")
    else:
        print("[WARN] Khong tim thay CloudFront Distribution ID. Bo qua buoc Invalidation.")

    print("\n=================================================================")
    print("[SUCCESS] HOAN THANH TRIEN KHAI CLOUDEXAM LEN AWS CLOUDFRONT CDN!")
    print(f"Website: {os.environ.get('CLOUDFRONT_URL', 'https://' + (dist_domain or 'd3nihfuct5nxta.cloudfront.net'))}")
    print("=================================================================\n")


if __name__ == "__main__":
    build_and_deploy()
