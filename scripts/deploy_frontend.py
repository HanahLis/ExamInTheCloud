#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CloudExam Frontend Auto-Build & CloudFront CDN Deployment Script
Đóng gói React SPA và đồng bộ trực tiếp lên AWS S3 + CloudFront CDN.

Thông số hạ tầng được lấy theo thứ tự ưu tiên:
  1. Biến môi trường do Terraform truyền vào (S3_BUCKET, CLOUDFRONT_DIST_ID, CLOUDFRONT_DOMAIN)
  2. `terraform output -json` của stack backend/terraform
  3. Tự dò qua AWS API (boto3)
Không hardcode bất kỳ ID tài nguyên nào.
"""

import os
import sys
import time
import json
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
    except Exception as exc:
        print(f"[INFO] Không đọc được terraform output: {exc}")
        return {}


def get_aws_resources():
    """Lấy S3 Bucket, CloudFront Distribution ID/Domain từ env -> terraform output -> AWS API."""
    region = os.environ.get("AWS_REGION", "ap-southeast-1")
    s3_bucket = os.environ.get("S3_BUCKET", "")
    dist_id = os.environ.get("CLOUDFRONT_DIST_ID", "")
    dist_domain = os.environ.get("CLOUDFRONT_DOMAIN", "")

    if not (s3_bucket and dist_id):
        out = _tf_outputs()

        def val(key):
            entry = out.get(key) or {}
            return entry.get("value") or ""

        s3_bucket = s3_bucket or val("frontend_hosting_bucket_name") or val("s3_bucket_name")
        dist_id = dist_id or val("cloudfront_distribution_id")
        dist_domain = dist_domain or val("cloudfront_distribution_domain_name")

    if not (s3_bucket and dist_id):
        try:
            s3_client = boto3.client("s3", region_name=region)
            for b in s3_client.list_buckets().get("Buckets", []):
                name = b.get("Name", "")
                if name.startswith("cloudexam-frontend-"):
                    s3_bucket = name
                    break

            cf_client = boto3.client("cloudfront")
            for d in cf_client.list_distributions().get("DistributionList", {}).get("Items", []):
                aliases = (d.get("Aliases") or {}).get("Items", [])
                comment = (d.get("Comment") or "").lower()
                if dist_domain and dist_domain in aliases:
                    dist_id, dist_domain = d["Id"], d["DomainName"]
                    break
                if "cloudexam" in comment or "spa" in comment:
                    dist_id, dist_domain = d["Id"], d["DomainName"]
                    break
        except Exception as exc:
            print(f"[WARN] Không tự dò được tài nguyên AWS: {exc}")

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
    if not s3_bucket or not dist_id:
        print("[LOI] Khong xac dinh duoc S3 bucket hoac CloudFront distribution ID.")
        sys.exit(1)

    region = os.environ.get("AWS_REGION", "ap-southeast-1")
    print(f"\n[+] BUOC 2: Dong bo tep len AWS S3 Bucket '{s3_bucket}' (region {region})...")
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

    print(f"[OK] Da tai len tong cong {uploaded_count} tep (~{total_bytes // 1024} KB) len S3!")

    print(f"\n[+] BUOC 3: Kich hoat CloudFront Cache Invalidation (Distribution: {dist_id})...")
    cf_client = boto3.client("cloudfront")
    try:
        inv_res = cf_client.create_invalidation(
            DistributionId=dist_id,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": ["/*"]},
                "CallerReference": f"deploy-{int(time.time())}",
            },
        )
        print(f"[OK] Da lam moi Cache CloudFront! (Invalidation ID: {inv_res['Invalidation']['Id']})")
    except Exception as exc:
        print(f"[WARN] Khong the tao Invalidation: {exc}")

    print("\n=================================================================")
    print("[SUCCESS] HOAN THANH TRIEN KHAI CLOUDEXAM LEN AWS CLOUDFRONT CDN!")
    print(f"Website: {os.environ.get('CLOUDFRONT_URL', 'https://' + (dist_domain or ''))} (CDN: https://{dist_domain})")
    print("=================================================================\n")


if __name__ == "__main__":
    build_and_deploy()
