#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CloudExam Custom Domain Integration Tool (cloudexam.id.vn)
Kiểm tra trạng thái chứng chỉ SSL ACM (us-east-1), bản ghi DNS Route 53,
và tự động gắn tên miền cloudexam.id.vn vào AWS CloudFront CDN.
"""

import sys
import time
import boto3

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

DOMAIN_NAME = "cloudexam.id.vn"
CERT_ARN = "arn:aws:acm:us-east-1:409289618109:certificate/b01bb65b-1206-4100-b13f-c3732a99098f"
HOSTED_ZONE_ID = "Z04590411E0KO977GCCEN"
NAMESERVERS = [
    "ns-157.awsdns-19.com",
    "ns-580.awsdns-08.net",
    "ns-1101.awsdns-09.org",
    "ns-1793.awsdns-32.co.uk"
]

def check_and_attach():
    print("=================================================================")
    print(f"[*] KIỂM TRA & TÍCH HỢP TÊN MIỀN {DOMAIN_NAME} VÀO CLOUDFRONT")
    print("=================================================================\n")

    acm = boto3.client("acm", region_name="us-east-1")
    cf = boto3.client("cloudfront")

    # 1. Kiểm tra trạng thái SSL Certificate trên ACM
    try:
        cert_desc = acm.describe_certificate(CertificateArn=CERT_ARN)
        status = cert_desc["Certificate"]["Status"]
        print(f"[+] Trạng thái SSL Certificate (ACM us-east-1): {status}")
    except Exception as e:
        print(f"[LỖI] Không thể kiểm tra chứng chỉ ACM: {e}")
        return

    val_options = cert_desc["Certificate"].get("DomainValidationOptions", [])
    cname_record = None
    for opt in val_options:
        rr = opt.get("ResourceRecord")
        if rr:
            cname_record = rr
            break

    # 2. Tìm CloudFront Distribution hiện tại
    dist_id = None
    dist_domain = None
    try:
        dists = cf.list_distributions().get("DistributionList", {}).get("Items", [])
        for d in dists:
            origins = d.get("Origins", {}).get("Items", [])
            for o in origins:
                if "frontend" in o.get("DomainName", ""):
                    dist_id = d["Id"]
                    dist_domain = d["DomainName"]
                    break
            if dist_id:
                break
        if not dist_id and dists:
            dist_id = dists[0]["Id"]
            dist_domain = dists[0]["DomainName"]
    except Exception as e:
        print(f"[WARN] Lỗi khi quét CloudFront Distribution: {e}")

    print(f"[+] CloudFront Distribution ID: {dist_id} ({dist_domain})")

    # 3. Nếu chứng chỉ đã ISSUED -> Tự động gắn Domain vào CloudFront
    if status == "ISSUED":
        print("\n[OK] Chứng chỉ SSL đã được cấp duyệt thành công!")
        if dist_id:
            print(f"[+] Đang cấu hình CNAME {DOMAIN_NAME} vào CloudFront {dist_id}...")
            try:
                config_resp = cf.get_distribution_config(Id=dist_id)
                cfg = config_resp["DistributionConfig"]
                etag = config_resp["ETag"]

                cfg["Aliases"] = {
                    "Quantity": 2,
                    "Items": [DOMAIN_NAME, f"www.{DOMAIN_NAME}"]
                }
                cfg["ViewerCertificate"] = {
                    "ACMCertificateArn": CERT_ARN,
                    "SSLSupportMethod": "sni-only",
                    "MinimumProtocolVersion": "TLSv1.2_2021",
                    "Certificate": CERT_ARN,
                    "CertificateSource": "acm"
                }

                cf.update_distribution(
                    Id=dist_id,
                    IfMatch=etag,
                    DistributionConfig=cfg
                )
                print(f"[SUCCESS] Đã gắn thành công {DOMAIN_NAME} vào CloudFront!")
                print(f"👉 Người dùng có thể truy cập qua: https://{DOMAIN_NAME}")
            except Exception as e:
                print(f"[WARN] Không thể cập nhật CloudFront distribution: {e}")
        return

    # 4. Nếu PENDING_VALIDATION -> Hướng dẫn chi tiết cho người dùng
    print(f"\n[!] Chứng chỉ đang ở trạng thái: {status}")
    print("Để hoàn tất gắn tên miền, bạn chỉ cần thực hiện 1 trong 2 cách sau:")
    print("-----------------------------------------------------------------")
    print("CÁCH 1 (Khuyên dùng - Nhanh nhất):")
    print("Vào trang quản lý tên miền (nhà đăng ký nơi bạn mua tên miền cloudexam.id.vn)")
    print("Đổi cặp NameServer (NS) sang 4 máy chủ AWS Route 53 sau:")
    for ns in NAMESERVERS:
        print(f"   • {ns}")
    print("\nCÁCH 2: Giữ nguyên DNS hiện tại và thêm 2 bản ghi CNAME:")
    if cname_record:
        print(f"   1. CNAME Xác thực SSL:")
        print(f"      - Tên (Host):   {cname_record['Name']}")
        print(f"      - Giá trị (Value): {cname_record['Value']}")
    print(f"   2. CNAME Trỏ Website về CloudFront:")
    print(f"      - Tên (Host):   @ (hoặc {DOMAIN_NAME})")
    print(f"      - Giá trị (Value): {dist_domain or 'd348qj9kq5myb9.cloudfront.net'}")
    print("-----------------------------------------------------------------")
    print("Sau khi trỏ xong DNS, hãy chạy lại script: python scripts/setup_domain.py")
    print("Hệ thống sẽ tự động liên kết tên miền vào CloudFront ngay khi AWS xác thực xong!")

if __name__ == "__main__":
    check_and_attach()

