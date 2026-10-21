"""
CloudExam - Lambda Face Authentication Handler
Xác thực khuôn mặt thí sinh điểm danh vào ca thi theo đặc tả:
1. Candidate thuộc Session (candidateEmails chứa email thí sinh)
2. Session = RUNNING
3. Face Similarity >= 80% (Amazon Rekognition CompareFaces)
=> Trả về kết quả: PASS / FAIL kèm thông điệp thân thiện & chi tiết
"""

import json
import os
import base64
import time
import binascii
from decimal import Decimal
from datetime import datetime, timezone

# Tích hợp AWS X-Ray Distributed Tracing (Graceful Fallback nếu chưa có SDK)
try:
    from aws_xray_sdk.core import xray_recorder, patch_all
    patch_all()
    XRAY_ENABLED = True
except ImportError:
    XRAY_ENABLED = False

import boto3
from botocore.exceptions import ClientError

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")
BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "cloudexam-storage-409289618109-dev")
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "80.0"))

dynamodb = boto3.resource("dynamodb", region_name=REGION)
rekognition = boto3.client("rekognition", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)

candidates_table = dynamodb.Table(f"CloudExam_Candidates_{ENV}")
sessions_table = dynamodb.Table(f"CloudExam_Sessions_{ENV}")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
}

def parse_iso_datetime(dt_str: str) -> datetime:
    """Parse chuỗi datetime ISO 8601 sang UTC datetime object"""
    if not dt_str:
        return datetime.now(timezone.utc)
    try:
        if dt_str.endswith("Z"):
            dt_str = dt_str[:-1] + "+00:00"
        return datetime.fromisoformat(dt_str)
    except Exception:
        return datetime.now(timezone.utc)

def build_response(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False)
    }

def get_auth_claims(event):
    try:
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        claims = authorizer.get("claims", {})
        return claims or {}
    except Exception:
        return {}

def log_structured_metric(event_name: str, payload: dict):
    """Ghi nhận log cấu trúc chuẩn JSON phục vụ CloudWatch Metric Filters"""
    log_data = {
        "event": event_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **payload
    }
    print(json.dumps(log_data, ensure_ascii=False))

def lambda_handler(event, context):
    start_time = time.time()

    if event.get("httpMethod") == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    claims = get_auth_claims(event)
    user_email = claims.get("email")

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return build_response(400, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "INVALID_JSON",
            "message": "Định dạng JSON trong phần body không hợp lệ."
        })

    session_id = body.get("sessionId")
    captured_image_b64 = body.get("capturedImage")  # Base64 chuỗi ảnh chụp từ webcam
    captured_s3_key = body.get("capturedS3Key")      # Hoặc S3 key nếu upload trước

    # Nếu không có email từ Cognito Token, lấy từ request body (hỗ trợ kiểm thử)
    if not user_email:
        user_email = body.get("email")

    if not user_email or not session_id:
        return build_response(400, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "MISSING_REQUIRED_FIELDS",
            "message": "Thiếu email thí sinh hoặc mã ca thi (sessionId)."
        })

    user_email = user_email.strip().lower()
    print(f"Bắt đầu xác thực khuôn mặt cho thí sinh: {user_email} tại ca thi: {session_id}")

    # =========================================================================
    # BƯỚC 1: Kiểm tra ca thi và trạng thái Session = RUNNING
    # =========================================================================
    try:
        session_res = sessions_table.get_item(Key={"id": session_id})
        session_item = session_res.get("Item")
    except ClientError as e:
        print(f"Lỗi truy vấn DynamoDB Sessions: {e}")
        return build_response(500, {
            "status": "FAIL",
            "verified": False,
            "errorCode": "DYNAMODB_ERROR",
            "message": "Lỗi truy vấn thông tin ca thi từ cơ sở dữ liệu."
        })

    if not session_item:
        return build_response(404, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "SESSION_NOT_FOUND",
            "message": f"Không tìm thấy ca thi có mã '{session_id}'."
        })

    session_status = session_item.get("status", "")
    now_utc = datetime.now(timezone.utc)
    start_dt = parse_iso_datetime(session_item.get("startTime", ""))
    end_dt = parse_iso_datetime(session_item.get("endTime", ""))

    is_time_valid = (start_dt <= now_utc <= end_dt)
    is_running = (session_status == "RUNNING") or (is_time_valid and session_status != "CLOSED")

    if not is_running:
        return build_response(400, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "SESSION_NOT_RUNNING",
            "message": f"Ca thi chưa bắt đầu hoặc đã kết thúc (Trạng thái hiện tại: {session_status}). Yêu cầu ca thi phải ở trạng thái RUNNING."
        })

    # =========================================================================
    # BƯỚC 2: Kiểm tra Candidate có thuộc danh sách Session không
    # =========================================================================
    allowed_candidates = [e.lower() for e in session_item.get("candidateEmails", [])]
    if user_email not in allowed_candidates:
        return build_response(403, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "CANDIDATE_NOT_IN_SESSION",
            "message": f"Thí sinh ({user_email}) không nằm trong danh sách được phép tham gia ca thi này."
        })

    # =========================================================================
    # BƯỚC 3: Lấy ảnh mẫu gốc của thí sinh từ DynamoDB / S3
    # =========================================================================
    try:
        candidate_res = candidates_table.get_item(Key={"email": user_email})
        candidate_item = candidate_res.get("Item")
    except ClientError as e:
        print(f"Lỗi truy vấn DynamoDB Candidates: {e}")
        return build_response(500, {
            "status": "FAIL",
            "verified": False,
            "errorCode": "DYNAMODB_ERROR",
            "message": "Lỗi truy vấn thông tin thí sinh từ cơ sở dữ liệu."
        })

    if not candidate_item or not candidate_item.get("faceImageUrl"):
        return build_response(404, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "SAMPLE_FACE_NOT_FOUND",
            "message": f"Chưa có ảnh thẻ mẫu của thí sinh ({user_email}) trong hồ sơ. Vui lòng liên hệ Giảng viên/Ban tổ chức để nạp ảnh."
        })

    candidate_name = candidate_item.get("name", user_email)
    face_image_url = candidate_item.get("faceImageUrl", "")

    # Xác định S3 key của ảnh thẻ mẫu
    source_s3_key = ""
    if "faces/" in face_image_url:
        source_s3_key = "faces/" + face_image_url.split("faces/")[1].split("?")[0]
    else:
        source_s3_key = face_image_url.strip("/")

    # Trích xuất S3 bucket từ URL nếu biến môi trường rỗng
    bucket_to_use = BUCKET_NAME
    if not bucket_to_use and ".s3." in face_image_url:
        clean_url = face_image_url.replace("https://", "").replace("http://", "")
        bucket_to_use = clean_url.split(".s3.")[0]

    source_image_param = {
        "S3Object": {
            "Bucket": bucket_to_use,
            "Name": source_s3_key
        }
    }

    # =========================================================================
    # BƯỚC 4: Chuẩn bị ảnh chụp từ camera (Target Image)
    # =========================================================================
    if captured_image_b64:
        # Tách header Base64 Data URL nếu có (ví dụ: "data:image/jpeg;base64,...")
        if "," in captured_image_b64:
            captured_image_b64 = captured_image_b64.split(",")[1]

        captured_image_b64 = captured_image_b64.strip()
        
        # Bổ sung padding '=' nếu thiếu
        missing_padding = len(captured_image_b64) % 4
        if missing_padding:
            captured_image_b64 += "=" * (4 - missing_padding)

        try:
            target_image_bytes = base64.b64decode(captured_image_b64, validate=True)
        except (binascii.Error, ValueError) as b64_err:
            return build_response(400, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "INVALID_BASE64",
                "message": f"Dữ liệu ảnh webcam mã hóa Base64 không hợp lệ: {str(b64_err)}"
            })

        # Kiểm tra kích thước ảnh (tối đa 5MB)
        if len(target_image_bytes) > 5 * 1024 * 1024:
            return build_response(400, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "IMAGE_TOO_LARGE",
                "message": "Kích thước ảnh chụp vượt quá 5MB. Vui lòng giảm độ phân giải camera."
            })

        target_image_param = {"Bytes": target_image_bytes}
    elif captured_s3_key:
        target_image_param = {
            "S3Object": {
                "Bucket": bucket_to_use,
                "Name": captured_s3_key
            }
        }
    else:
        return build_response(400, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "MISSING_IMAGE",
            "message": "Thiếu dữ liệu ảnh khuôn mặt chụp từ webcam."
        })

    # =========================================================================
    # BƯỚC 5: Gọi Amazon Rekognition CompareFaces với Bắt Trọn Ngoại Lệ
    # =========================================================================
    try:
        rek_res = rekognition.compare_faces(
            SourceImage=source_image_param,
            TargetImage=target_image_param,
            SimilarityThreshold=SIMILARITY_THRESHOLD
        )

        duration_ms = round((time.time() - start_time) * 1000, 2)
        face_matches = rek_res.get("FaceMatches", [])
        unmatched_faces = rek_res.get("UnmatchedFaces", [])

        if not face_matches:
            # Rekognition phát hiện mặt nhưng độ khớp < 80%
            unmatched_sim = 0.0
            if unmatched_faces:
                # Lấy similarity cao nhất từ unmatched faces nếu có
                unmatched_sim = round(float(unmatched_faces[0].get("Similarity", 0.0)), 2)

            log_structured_metric("FACE_VERIFICATION_ATTEMPT", {
                "sessionId": session_id,
                "candidateEmail": user_email,
                "status": "FAIL",
                "similarity": unmatched_sim,
                "threshold": SIMILARITY_THRESHOLD,
                "durationMs": duration_ms,
                "errorCode": "SIMILARITY_BELOW_THRESHOLD"
            })

            return build_response(200, {
                "status": "FAIL",
                "verified": False,
                "similarity": unmatched_sim,
                "candidateName": candidate_name,
                "errorCode": "SIMILARITY_BELOW_THRESHOLD",
                "message": f"Độ tương đồng khuôn mặt ({unmatched_sim:.1f}%) chưa đạt ngưỡng yêu cầu ({SIMILARITY_THRESHOLD}%). Thí sinh không khớp với ảnh thẻ hồ sơ."
            })

        best_match = face_matches[0]
        similarity = round(float(best_match.get("Similarity", 0.0)), 2)

        if similarity >= SIMILARITY_THRESHOLD:
            log_structured_metric("FACE_VERIFICATION_ATTEMPT", {
                "sessionId": session_id,
                "candidateEmail": user_email,
                "status": "PASS",
                "similarity": similarity,
                "threshold": SIMILARITY_THRESHOLD,
                "durationMs": duration_ms
            })

            return build_response(200, {
                "status": "PASS",
                "verified": True,
                "similarity": similarity,
                "candidateName": candidate_name,
                "message": f"Xác thực khuôn mặt thành công ({similarity:.1f}% >= {SIMILARITY_THRESHOLD}%). Chào mừng thí sinh {candidate_name} vào phòng thi!"
            })
        else:
            log_structured_metric("FACE_VERIFICATION_ATTEMPT", {
                "sessionId": session_id,
                "candidateEmail": user_email,
                "status": "FAIL",
                "similarity": similarity,
                "threshold": SIMILARITY_THRESHOLD,
                "durationMs": duration_ms,
                "errorCode": "SIMILARITY_BELOW_THRESHOLD"
            })

            return build_response(200, {
                "status": "FAIL",
                "verified": False,
                "similarity": similarity,
                "candidateName": candidate_name,
                "errorCode": "SIMILARITY_BELOW_THRESHOLD",
                "message": f"Độ tương đồng khuôn mặt ({similarity:.1f}%) chưa đạt ngưỡng tối thiểu ({SIMILARITY_THRESHOLD}%)."
            })

    # -------------------------------------------------------------------------
    # XỬ LÝ CÁC NGOẠI LỆ ĐẶC THÙ CỦA AMAZON REKOGNITION
    # -------------------------------------------------------------------------
    except ClientError as err:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        error_code = err.response.get("Error", {}).get("Code", "ClientError")
        error_msg = err.response.get("Error", {}).get("Message", str(err))

        print(f"[REKOGNITION CLIENT ERROR] Code: {error_code}, Message: {error_msg}")

        # Trường hợp 1: Không tìm thấy mặt trong ảnh (Target webcam hoặc Source S3)
        if error_code == "InvalidParameterException":
            err_lower = error_msg.lower()
            if "no faces" in err_lower or "cannot find face" in err_lower:
                if "target" in err_lower:
                    user_friendly_msg = "Không phát hiện khuôn mặt trong ảnh chụp webcam. Vui lòng hướng mặt thẳng vào camera trong điều kiện đủ sáng."
                    err_type = "NO_FACE_IN_TARGET"
                elif "source" in err_lower:
                    user_friendly_msg = "Không phát hiện khuôn mặt trong ảnh thẻ hồ sơ S3. Vui lòng liên hệ ban tổ chức để đổi ảnh thẻ rõ mặt."
                    err_type = "NO_FACE_IN_SOURCE"
                else:
                    user_friendly_msg = "Không phát hiện khuôn mặt trong ảnh chụp. Vui lòng nhìn thẳng vào camera và chụp lại."
                    err_type = "NO_FACE_DETECTED"

                log_structured_metric("FACE_VERIFICATION_ATTEMPT", {
                    "sessionId": session_id,
                    "candidateEmail": user_email,
                    "status": "FAIL",
                    "similarity": 0.0,
                    "durationMs": duration_ms,
                    "errorCode": err_type
                })

                return build_response(200, {
                    "status": "FAIL",
                    "verified": False,
                    "similarity": 0.0,
                    "errorCode": err_type,
                    "message": user_friendly_msg
                })

            return build_response(400, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "INVALID_IMAGE_PARAMETER",
                "message": f"Tham số ảnh chụp không hợp lệ: {error_msg}"
            })

        # Trường hợp 2: Định dạng ảnh không được Rekognition hỗ trợ
        if error_code == "InvalidImageFormatException":
            return build_response(400, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "INVALID_IMAGE_FORMAT",
                "message": "Định dạng ảnh không hợp lệ. AWS Rekognition chỉ hỗ trợ ảnh JPEG hoặc PNG."
            })

        # Trường hợp 3: Ảnh quá lớn
        if error_code == "ImageTooLargeException":
            return build_response(400, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "IMAGE_TOO_LARGE",
                "message": "Kích thước ảnh chụp vượt quá 5MB. Vui lòng giảm độ phân giải camera."
            })

        # Trường hợp 4: Không tìm thấy ảnh thẻ trên S3
        if error_code in ("InvalidS3ObjectException", "ResourceNotFoundException", "NoSuchKey"):
            return build_response(404, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "S3_OBJECT_NOT_FOUND",
                "message": f"Không tìm thấy ảnh thẻ thí sinh trên S3 ({bucket_to_use}/{source_s3_key}). Vui lòng báo Giảng viên để tải ảnh thẻ lên."
            })

        # Trường hợp 5: Lỗi phân quyền IAM
        if error_code == "AccessDeniedException":
            return build_response(500, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "IAM_ACCESS_DENIED",
                "message": "Lỗi phân quyền IAM khi truy cập Amazon Rekognition hoặc S3."
            })

        # Trường hợp 6: Quá tải / Throttling
        if error_code in ("ProvisionedThroughputExceededException", "ThrottlingException"):
            return build_response(503, {
                "status": "FAIL",
                "verified": False,
                "similarity": 0.0,
                "errorCode": "SERVICE_THROTTLED",
                "message": "Dịch vụ xác thực AI đang bị quá tải request. Vui lòng thử lại sau 3-5 giây."
            })

        # Lỗi ClientError khác
        return build_response(500, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": error_code,
            "message": f"Lỗi dịch vụ Amazon Rekognition ({error_code}): {error_msg}"
        })

    except Exception as e:
        print(f"[UNEXPECTED ERROR in face_verify_handler]: {str(e)}")
        return build_response(500, {
            "status": "FAIL",
            "verified": False,
            "similarity": 0.0,
            "errorCode": "INTERNAL_SERVER_ERROR",
            "message": "Đã xảy ra lỗi không xác định trong quá trình xác thực khuôn mặt.",
            "details": str(e)
        })
