#!/usr/bin/env python3
"""
CloudExam - Script dọn dẹp sạch sẽ toàn bộ tài nguyên CloudExam trên AWS
Xóa an toàn các tài nguyên mang tiền tố 'cloudexam' / 'CloudExam'
Bảo toàn tuyệt đối: IAM Users (manh), Access Keys, Default VPC và Network gốc của AWS
"""

import sys
import io
import time
import boto3

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

REGION = "ap-southeast-1"
print(f"[*] Bat dau don dep tai nguyen CloudExam tai Region: {REGION}")

# 1. S3 BUCKETS
s3 = boto3.client("s3", region_name=REGION)
s3_res = boto3.resource("s3", region_name=REGION)
try:
    buckets = s3.list_buckets().get("Buckets", [])
    for b in buckets:
        b_name = b["Name"]
        if "cloudexam" in b_name.lower():
            print(f"[-] Dang xoa rong va huy S3 Bucket: {b_name}...")
            bucket = s3_res.Bucket(b_name)
            try:
                bucket.object_versions.delete()
            except Exception:
                pass
            try:
                bucket.objects.all().delete()
            except Exception:
                pass
            s3.delete_bucket(Bucket=b_name)
            print(f"[OK] Da xoa S3 Bucket: {b_name}")
except Exception as e:
    print(f"[!] Loi khi don S3: {e}")

# 2. DYNAMODB TABLES
dynamodb = boto3.client("dynamodb", region_name=REGION)
try:
    tables = dynamodb.list_tables().get("TableNames", [])
    for t in tables:
        if "cloudexam" in t.lower():
            print(f"[-] Dang xoa bang DynamoDB: {t}...")
            dynamodb.delete_table(TableName=t)
            print(f"[OK] Da gui lenh xoa bang DynamoDB: {t}")
except Exception as e:
    print(f"[!] Loi khi don DynamoDB: {e}")

# 3. LAMBDA FUNCTIONS
lam = boto3.client("lambda", region_name=REGION)
try:
    funcs = lam.list_functions().get("Functions", [])
    for f in funcs:
        f_name = f["FunctionName"]
        if "cloudexam" in f_name.lower():
            print(f"[-] Dang xoa Lambda Function: {f_name}...")
            lam.delete_function(FunctionName=f_name)
            print(f"[OK] Da xoa Lambda: {f_name}")
except Exception as e:
    print(f"[!] Loi khi don Lambda: {e}")

# 4. SQS QUEUES
sqs = boto3.client("sqs", region_name=REGION)
try:
    queues = sqs.list_queues().get("QueueUrls", [])
    for q_url in queues:
        if "cloudexam" in q_url.lower():
            print(f"[-] Dang xoa SQS Queue: {q_url}...")
            sqs.delete_queue(QueueUrl=q_url)
            print(f"[OK] Da xoa SQS: {q_url}")
except Exception as e:
    print(f"[!] Loi khi don SQS: {e}")

# 5. API GATEWAYS
apigw = boto3.client("apigateway", region_name=REGION)
try:
    apis = apigw.get_rest_apis().get("items", [])
    for a in apis:
        a_name = a.get("name", "")
        if "cloudexam" in a_name.lower():
            a_id = a["id"]
            print(f"[-] Dang xoa API Gateway: {a_name} ({a_id})...")
            apigw.delete_rest_api(restApiId=a_id)
            print(f"[OK] Da xoa API Gateway: {a_name}")
except Exception as e:
    print(f"[!] Loi khi don API Gateway: {e}")

# 6. COGNITO USER POOLS
cognito_idp = boto3.client("cognito-idp", region_name=REGION)
try:
    pools = cognito_idp.list_user_pools(MaxResults=20).get("UserPools", [])
    for p in pools:
        p_name = p.get("Name", "")
        if "cloudexam" in p_name.lower():
            p_id = p["Id"]
            print(f"[-] Dang xoa Cognito User Pool: {p_name} ({p_id})...")
            # Xoa domain truoc neu co
            try:
                desc = cognito_idp.describe_user_pool(UserPoolId=p_id)
                domain = desc.get("UserPool", {}).get("Domain")
                if domain:
                    cognito_idp.delete_user_pool_domain(Domain=domain, UserPoolId=p_id)
            except Exception:
                pass
            cognito_idp.delete_user_pool(UserPoolId=p_id)
            print(f"[OK] Da xoa User Pool: {p_name}")
except Exception as e:
    print(f"[!] Loi khi don Cognito User Pools: {e}")

# 7. COGNITO IDENTITY POOLS
cognito_id = boto3.client("cognito-identity", region_name=REGION)
try:
    id_pools = cognito_id.list_identity_pools(MaxResults=20).get("IdentityPools", [])
    for ip in id_pools:
        ip_name = ip.get("IdentityPoolName", "")
        if "cloudexam" in ip_name.lower():
            ip_id = ip["IdentityPoolId"]
            print(f"[-] Dang xoa Cognito Identity Pool: {ip_name} ({ip_id})...")
            cognito_id.delete_identity_pool(IdentityPoolId=ip_id)
            print(f"[OK] Da xoa Identity Pool: {ip_name}")
except Exception as e:
    print(f"[!] Loi khi don Identity Pool: {e}")

# 8. SNS TOPICS
sns = boto3.client("sns", region_name=REGION)
try:
    topics = sns.list_topics().get("Topics", [])
    for t in topics:
        t_arn = t["TopicArn"]
        if "cloudexam" in t_arn.lower():
            print(f"[-] Dang xoa SNS Topic: {t_arn}...")
            sns.delete_topic(TopicArn=t_arn)
            print(f"[OK] Da xoa SNS: {t_arn}")
except Exception as e:
    print(f"[!] Loi khi don SNS: {e}")

# 9. IAM ROLES (Chi xoa cac Role cua du an CloudExam, KHONG xoa IAM User manh hoac Root)
iam = boto3.client("iam")
try:
    roles = iam.list_roles().get("Roles", [])
    for r in roles:
        r_name = r["RoleName"]
        if r_name.lower().startswith("cloudexam-") or "cloudexam" in r_name.lower():
            # Bo qua neu la user role/account quan tri
            if r_name.lower() in ["manh", "administrator", "root"]:
                continue
            print(f"[-] Dang go policy va xoa IAM Role: {r_name}...")
            # Go inline policies
            try:
                policies = iam.list_role_policies(RoleName=r_name).get("PolicyNames", [])
                for p in policies:
                    iam.delete_role_policy(RoleName=r_name, PolicyName=p)
            except Exception as pe:
                print(f"    [!] Loi go inline policy: {pe}")
            # Go attached managed policies
            try:
                attached = iam.list_attached_role_policies(RoleName=r_name).get("AttachedPolicies", [])
                for ap in attached:
                    iam.detach_role_policy(RoleName=r_name, PolicyArn=ap["PolicyArn"])
            except Exception as ape:
                print(f"    [!] Loi go attached policy: {ape}")
            # Xoa role
            try:
                iam.delete_role(RoleName=r_name)
                print(f"[OK] Da xoa IAM Role: {r_name}")
            except Exception as re:
                print(f"    [!] Loi xoa role: {re}")
except Exception as e:
    print(f"[!] Loi khi don IAM Roles: {e}")

print("\n[SUCCESS] Da don dep sach se toan bo tai nguyen CloudExam cu tren AWS!")
print("[*] Bay gio ban co the chay: cd backend/terraform && terraform apply -auto-approve")
