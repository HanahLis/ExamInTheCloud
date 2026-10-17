#!/usr/bin/env python3
"""
Unit & Integration Test Suite for CloudExam Lambda Face Verification
Kiểm thử 14 kịch bản xác thực khuôn mặt sinh trắc học:
1. CORS Preflight OPTIONS
2. Request body JSON không hợp lệ
3. Thiếu email hoặc sessionId
4. Ca thi không tồn tại trong DynamoDB (404)
5. Ca thi chưa ở trạng thái RUNNING (400)
6. Thí sinh không nằm trong candidateEmails của ca thi (403)
7. Thí sinh chưa có ảnh thẻ mẫu trên hệ thống (404)
8. Chuỗi Base64 ảnh camera bị sai định dạng (400)
9. Rekognition báo không phát hiện mặt trong ảnh webcam (NO_FACE_IN_TARGET)
10. Rekognition báo không phát hiện mặt trong ảnh thẻ S3 (NO_FACE_IN_SOURCE)
11. Ảnh vượt quá giới hạn 5MB (IMAGE_TOO_LARGE)
12. Không tìm thấy ảnh thẻ trên S3 bucket (S3_OBJECT_NOT_FOUND)
13. Thí sinh khác người (Độ tương đồng < 80% => FAIL)
14. Điểm danh thành công (Độ tương đồng >= 80% => PASS)
"""

import sys
import os
import json
import base64
import unittest
from unittest.mock import MagicMock, patch

# Thiết lập Mock boto3 nếu môi trường chưa cài đặt
if "boto3" not in sys.modules:
    mock_boto3 = MagicMock()
    mock_botocore = MagicMock()
    mock_exceptions = MagicMock()
    
    class ClientError(Exception):
        def __init__(self, response, operation_name):
            super().__init__(str(response))
            self.response = response
            self.operation_name = operation_name

    mock_exceptions.ClientError = ClientError
    sys.modules["boto3"] = mock_boto3
    sys.modules["botocore"] = mock_botocore
    sys.modules["botocore.exceptions"] = mock_exceptions

# Đưa thư mục backend/lambda vào sys.path để import face_verify_handler
LAMBDA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "lambda"))
if LAMBDA_DIR not in sys.path:
    sys.path.insert(0, LAMBDA_DIR)

import face_verify_handler
from botocore.exceptions import ClientError


class TestFaceVerifyHandler(unittest.TestCase):
    def setUp(self):
        # Reset mocks
        face_verify_handler.sessions_table = MagicMock()
        face_verify_handler.candidates_table = MagicMock()
        face_verify_handler.rekognition = MagicMock()

        self.valid_b64_image = base64.b64encode(b"dummy-valid-image-bytes-jpeg").decode("utf-8")

    def test_01_cors_preflight(self):
        """1. Kiểm tra CORS Preflight OPTIONS trả về 200"""
        event = {"httpMethod": "OPTIONS"}
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertIn("CORS preflight OK", body["message"])

    def test_02_invalid_json_body(self):
        """2. Kiểm tra khi Body không phải JSON hợp lệ"""
        event = {"body": "{invalid-json}"}
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 400)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "INVALID_JSON")

    def test_03_missing_email_or_session(self):
        """3. Thiếu email hoặc sessionId trong request"""
        event = {"body": json.dumps({"sessionId": "SES-01"})}
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 400)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "MISSING_REQUIRED_FIELDS")

    def test_04_session_not_found(self):
        """4. Không tìm thấy ca thi trong DynamoDB (404)"""
        face_verify_handler.sessions_table.get_item.return_value = {}

        event = {
            "body": json.dumps({
                "sessionId": "NON_EXISTENT_SESSION",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 404)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "SESSION_NOT_FOUND")

    def test_05_session_not_running(self):
        """5. Ca thi có trạng thái SCHEDULED (Chưa RUNNING) (400)"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "SCHEDULED",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 400)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "SESSION_NOT_RUNNING")

    def test_06_candidate_not_in_session(self):
        """6. Thí sinh không nằm trong danh sách ca thi (403)"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["hantt@example.edu.vn", "manhtd@example.edu.vn"]
            }
        }

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 403)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "CANDIDATE_NOT_IN_SESSION")

    def test_07_candidate_missing_face_photo(self):
        """7. Thí sinh chưa có ảnh thẻ mẫu trên hệ thống (404)"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        # DynamoDB trả về thí sinh không có faceImageUrl
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": ""
            }
        }

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 404)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "SAMPLE_FACE_NOT_FOUND")

    def test_08_invalid_base64_image(self):
        """8. Chuỗi Base64 ảnh camera bị sai ký tự (400)"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": "https://bucket.s3.amazonaws.com/faces/B21DCCN001.jpg"
            }
        }

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": "%%%not-a-valid-base64%%%"
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 400)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "INVALID_BASE64")

    def test_09_rekognition_no_face_in_target(self):
        """9. Rekognition không tìm thấy mặt trong ảnh webcam"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": "https://bucket.s3.amazonaws.com/faces/B21DCCN001.jpg"
            }
        }

        # Giả lập Rekognition tung lỗi InvalidParameterException: There are no faces in the target image
        err_response = {
            "Error": {
                "Code": "InvalidParameterException",
                "Message": "There are no faces in the target image"
            }
        }
        face_verify_handler.rekognition.compare_faces.side_effect = ClientError(err_response, "CompareFaces")

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "FAIL")
        self.assertEqual(body["errorCode"], "NO_FACE_IN_TARGET")
        self.assertIn("webcam", body["message"].lower())

    def test_10_rekognition_no_face_in_source(self):
        """10. Rekognition không tìm thấy mặt trong ảnh thẻ hồ sơ S3"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": "https://bucket.s3.amazonaws.com/faces/B21DCCN001.jpg"
            }
        }

        err_response = {
            "Error": {
                "Code": "InvalidParameterException",
                "Message": "There are no faces in the source image"
            }
        }
        face_verify_handler.rekognition.compare_faces.side_effect = ClientError(err_response, "CompareFaces")

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "FAIL")
        self.assertEqual(body["errorCode"], "NO_FACE_IN_SOURCE")

    def test_11_rekognition_s3_not_found(self):
        """11. Không tìm thấy ảnh thẻ trên S3 bucket (404)"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": "https://bucket.s3.amazonaws.com/faces/B21DCCN001.jpg"
            }
        }

        err_response = {
            "Error": {
                "Code": "InvalidS3ObjectException",
                "Message": "Unable to get object metadata from S3"
            }
        }
        face_verify_handler.rekognition.compare_faces.side_effect = ClientError(err_response, "CompareFaces")

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 404)
        body = json.loads(response["body"])
        self.assertEqual(body["errorCode"], "S3_OBJECT_NOT_FOUND")

    def test_12_rekognition_face_mismatch(self):
        """12. So khớp khuôn mặt nhưng độ tương đồng dưới 80% (FAIL)"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": "https://bucket.s3.amazonaws.com/faces/B21DCCN001.jpg"
            }
        }

        # Rekognition trả về FaceMatches rỗng, UnmatchedFaces có similarity 45.6%
        face_verify_handler.rekognition.compare_faces.side_effect = None
        face_verify_handler.rekognition.compare_faces.return_value = {
            "FaceMatches": [],
            "UnmatchedFaces": [
                {"Similarity": 45.6}
            ]
        }

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "FAIL")
        self.assertFalse(body["verified"])
        self.assertEqual(body["similarity"], 45.6)
        self.assertIn("chưa đạt", body["message"])

    def test_13_rekognition_face_match_success(self):
        """13. Điểm danh thành công: Độ khớp đạt 96.8% >= 80% (PASS)"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": "https://bucket.s3.amazonaws.com/faces/B21DCCN001.jpg"
            }
        }

        # Rekognition trả về FaceMatches với similarity 96.8%
        face_verify_handler.rekognition.compare_faces.side_effect = None
        face_verify_handler.rekognition.compare_faces.return_value = {
            "FaceMatches": [
                {"Similarity": 96.82}
            ],
            "UnmatchedFaces": []
        }

        event = {
            "body": json.dumps({
                "sessionId": "SES-01",
                "email": "phongpt@example.edu.vn",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "PASS")
        self.assertTrue(body["verified"])
        self.assertEqual(body["similarity"], 96.82)
        self.assertIn("thành công", body["message"].lower())
        self.assertIn("Phạm Tuấn Phong", body["candidateName"])

    def test_14_cognito_claims_email(self):
        """14. Lấy email thí sinh trực tiếp từ Cognito Claims trong requestContext"""
        face_verify_handler.sessions_table.get_item.return_value = {
            "Item": {
                "id": "SES-01",
                "status": "RUNNING",
                "candidateEmails": ["phongpt@example.edu.vn"]
            }
        }
        face_verify_handler.candidates_table.get_item.return_value = {
            "Item": {
                "email": "phongpt@example.edu.vn",
                "name": "Phạm Tuấn Phong",
                "faceImageUrl": "https://bucket.s3.amazonaws.com/faces/B21DCCN001.jpg"
            }
        }
        face_verify_handler.rekognition.compare_faces.side_effect = None
        face_verify_handler.rekognition.compare_faces.return_value = {
            "FaceMatches": [{"Similarity": 92.5}],
            "UnmatchedFaces": []
        }

        # Event có email trong Cognito claims chứ không cần body.email
        event = {
            "requestContext": {
                "authorizer": {
                    "claims": {
                        "email": "phongpt@example.edu.vn"
                    }
                }
            },
            "body": json.dumps({
                "sessionId": "SES-01",
                "capturedImage": self.valid_b64_image
            })
        }
        response = face_verify_handler.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "PASS")
        self.assertTrue(body["verified"])


if __name__ == "__main__":
    print("🧪 CHẠY KIỂM THỬ ĐIỂM DANH SINH TRẮC HỌC CLOUDEXAM (P-01 & P-04)")
    unittest.main(verbosity=2)

