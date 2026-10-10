"""
CloudExam - Lambda Face Authentication Handler
Xác thực khuôn mặt thí sinh điểm danh vào ca thi theo đặc tả:
1. Candidate thuộc Session (candidateEmails chứa email thí sinh)
2. Session = RUNNING
3. Face Similarity >= 80% (Amazon Rekognition CompareFaces)
=> Trả về kết quả: PASS / FAIL
"""

import json
import os
import base64
import boto3
from decimal import Decimal
from datetime import datetime, timezone

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")
BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
rekognition = boto3.client("rekognition", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)

candidates_table = dynamodb.Table(f"CloudExam_Candidates_{ENV}")
sessions_table = dynamodb.Table(f"CloudExam_Sessions_{ENV}")

SIMILARITY_THRESHOLD = 80.0

def build_response(status_code: int, body: any):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps(body, ensure_ascii=False)
    }

def get_auth_claims(event):
    try:
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        claims = authorizer.get("claims", {})
        return claims
    except Exception:
        return {}

def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    claims = get_auth_claims(event)
    user_email = claims.get("email")

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return build_response(400, {"error": "Invalid JSON body"})

    session_id = body.get("sessionId")
    captured_image_b64 = body.get("capturedImage") # Base64 chuỗi ảnh chụp từ webcam
    captured_s3_key = body.get("capturedS3Key")    # Hoặc S3 key nếu upload trước

    # Nếu không có email từ token, thử lấy từ request body
    if not user_email:
        user_email = body.get("email")

    if not user_email or not session_id:
        return build_response(400, {
            "status": "FAIL",
            "message": "Thiếu email thí sinh hoặc sessionId."
        })

    print(f"Face Verify Request for candidate: {user_email} in session: {session_id}")

    # =========================================================================
    # BƯỚC 1: Kiểm tra ca thi và trạng thái Session = RUNNING
    # =========================================================================
    session_res = sessions_table.get_item(Key={"id": session_id})
    session_item = session_res.get("Item")
    if not session_item:
        return build_response(404, {
            "status": "FAIL",
            "message": "Không tìm thấy ca thi."
        })

    session_status = session_item.get("status", "")
    if session_status != "RUNNING":
        return build_response(400, {
            "status": "FAIL",
            "message": f"Ca thi chưa bắt đầu hoặc đã kết thúc (Trạng thái hiện tại: {session_status}). Yêu cầu: RUNNING."
        })

    # =========================================================================
    # BƯỚC 2: Kiểm tra Candidate có thuộc danh sách Session không
    # =========================================================================
    allowed_candidates = session_item.get("candidateEmails", [])
    if user_email not in allowed_candidates:
        return build_response(403, {
            "status": "FAIL",
            "message": f"Thí sinh ({user_email}) không nằm trong danh sách được phép tham gia ca thi này."
        })

    # =========================================================================
    # BƯỚC 3: Lấy ảnh mẫu gốc của thí sinh từ DynamoDB / S3
    # =========================================================================
    candidate_res = candidates_table.get_item(Key={"email": user_email})
    candidate_item = candidate_res.get("Item")
    if not candidate_item or not candidate_item.get("faceImageUrl"):
        return build_response(404, {
            "status": "FAIL",
            "message": "Chưa có ảnh khuôn mặt mẫu của thí sinh trong hệ thống. Vui lòng liên hệ Organizer."
        })

    face_image_url = candidate_item.get("faceImageUrl", "")
    
    # Xác định S3 key của ảnh mẫu
    # URL có dạng: https://<bucket>.s3.<region>.amazonaws.com/faces/<filename>
    source_s3_key = ""
    if "faces/" in face_image_url:
        source_s3_key = "faces/" + face_image_url.split("faces/")[1]
    else:
        source_s3_key = face_image_url

    source_image_param = {
        "S3Object": {
            "Bucket": BUCKET_NAME,
            "Name": source_s3_key
        }
    }

    # =========================================================================
    # BƯỚC 4: Chuẩn bị ảnh chụp từ camera (Target Image)
    # =========================================================================
    if captured_image_b64:
        # Tách header base64 nếu có (vd: "data:image/jpeg;base64,...")
        if "," in captured_image_b64:
            captured_image_b64 = captured_image_b64.split(",")[1]
        target_image_bytes = base64.b64decode(captured_image_b64)
        target_image_param = {"Bytes": target_image_bytes}
    elif captured_s3_key:
        target_image_param = {
            "S3Object": {
                "Bucket": BUCKET_NAME,
                "Name": captured_s3_key
            }
        }
    else:
        return build_response(400, {
            "status": "FAIL",
            "message": "Thiếu dữ liệu ảnh khuôn mặt chụp từ webcam."
        })

    # =========================================================================
    # BƯỚC 5: Gọi Amazon Rekognition CompareFaces
    # =========================================================================
    try:
        rek_res = rekognition.compare_faces(
            SourceImage=source_image_param,
            TargetImage=target_image_param,
            SimilarityThreshold=SIMILARITY_THRESHOLD
        )

        face_matches = rek_res.get("FaceMatches", [])
        if not face_matches:
            # Không khớp hoặc độ tương đồng < 80%
            unmatched = rek_res.get("UnmatchedFaces", [])
            return build_response(200, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "message": "Xác thực khuôn mặt thất bại. Độ tương đồng dưới 80% hoặc không nhận diện được khuôn mặt."
            })

        best_match = face_matches[0]
        similarity = float(best_match.get("Similarity", 0.0))

        if similarity >= SIMILARITY_THRESHOLD:
            return build_response(200, {
                "status": "PASS",
                "verified": True,
                "similarity": round(similarity, 2),
                "message": f"Xác thực khuôn mặt thành công ({similarity:.1f}% >= 80%). Cho phép vào thi."
            })
        else:
            return build_response(200, {
                "status": "FAIL",
                "verified": False,
                "similarity": round(similarity, 2),
                "message": f"Độ tương đồng khuôn mặt chưa đạt ({similarity:.1f}% < 80%)."
            })

    except Exception as e:
        print(f"Rekognition CompareFaces Error: {str(e)}")
        return build_response(500, {
            "status": "FAIL",
            "error": "Lỗi khi gọi dịch vụ Amazon Rekognition",
            "details": str(e)
        })
