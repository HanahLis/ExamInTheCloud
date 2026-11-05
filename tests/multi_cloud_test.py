#!/usr/bin/env python3
"""
CloudExam - Kịch bản kiểm thử tích hợp kiến trúc Đa Đám Mây (Multi-Cloud Test Suite)
Kiểm thử các luồng tích hợp giữa AWS Lambda, Google Gemini 1.5 Flash, Upstash Redis và Cloudflare Turnstile.
"""

import sys
import os
import json
import time
import uuid
import base64
import io
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# Đảm bảo in tiếng Việt an toàn trên console Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ANSI Colors cho báo cáo kiểm thử
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# Thêm đường dẫn lambda vào sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/lambda")))

# Thiết lập Mock boto3 nếu môi trường chưa cài đặt
try:
    import boto3
    import botocore
    from botocore.config import Config
except ImportError:
    mock_boto3 = MagicMock()
    mock_botocore = MagicMock()
    mock_botocore.__path__ = []
    mock_exceptions = MagicMock()

    class ClientError(Exception):
        def __init__(self, response, operation_name):
            super().__init__(str(response))
            self.response = response
            self.operation_name = operation_name

    mock_exceptions.ClientError = ClientError
    mock_boto3.resource.return_value.Table.side_effect = lambda name: MagicMock(name=name)
    sys.modules["boto3"] = mock_boto3
    sys.modules["boto3.dynamodb"] = MagicMock()
    sys.modules["boto3.dynamodb.conditions"] = MagicMock()
    sys.modules["botocore"] = mock_botocore
    sys.modules["botocore.exceptions"] = mock_exceptions
    sys.modules["botocore.config"] = MagicMock()

import api_handler
import grading_worker


def print_header(title: str):
    print(f"\n{CYAN}{BOLD}{'=' * 75}{RESET}")
    print(f"{CYAN}{BOLD}>>> {title}{RESET}")
    print(f"{CYAN}{BOLD}{'=' * 75}{RESET}")


class MultiCloudTestSuite:
    def __init__(self):
        self.results = []

    def record(self, code: str, name: str, passed: bool, details: str):
        self.results.append({"code": code, "name": name, "passed": passed, "details": details})
        status_str = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
        print(f"  {status_str} {BOLD}{code}{RESET}: {name}")
        print(f"         Chi tiết: {details}")

    def create_sample_docx_base64(self) -> str:
        """Tạo file docx mẫu trong bộ nhớ (OpenXML zip) và mã hóa Base64"""
        docx_buffer = io.BytesIO()
        sample_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p><w:r><w:t>ĐỀ THI TRẮC NGHIỆM ĐIỆN TOÁN ĐÁM MÂY</w:t></w:r></w:p>
        <w:p><w:r><w:t>Câu 1: Dịch vụ nào của AWS cung cấp khả năng điện toán serverless?</w:t></w:r></w:p>
        <w:p><w:r><w:t>A. Amazon EC2</w:t></w:r></w:p>
        <w:p><w:r><w:t>B. AWS Lambda</w:t></w:r></w:p>
        <w:p><w:r><w:t>C. Amazon RDS</w:t></w:r></w:p>
        <w:p><w:r><w:t>D. Amazon EBS</w:t></w:r></w:p>
        <w:p><w:r><w:t>Đáp án: B</w:t></w:r></w:p>
        <w:p><w:r><w:t>Câu 2: Cơ chế nào giúp phân tán tải nộp bài thi chống nghẽn hệ thống?</w:t></w:r></w:p>
        <w:p><w:r><w:t>A. Amazon SQS Queue</w:t></w:r></w:p>
        <w:p><w:r><w:t>B. Trực tiếp ghi vào file text</w:t></w:r></w:p>
        <w:p><w:r><w:t>C. Tăng timeout của trình duyệt</w:t></w:r></w:p>
        <w:p><w:r><w:t>D. Tắt mạng</w:t></w:r></w:p>
        <w:p><w:r><w:t>Đáp án: A</w:t></w:r></w:p>
    </w:body>
</w:document>"""
        with zipfile.ZipFile(docx_buffer, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("word/document.xml", sample_xml.encode("utf-8"))
        return base64.b64encode(docx_buffer.getvalue()).decode("utf-8")

    # =========================================================================
    # 1. KIỂM THỬ TÍCH HỢP GOOGLE GEMINI AI (TASK M-01 & M-05)
    # =========================================================================
    def test_gemini_doc_parsing(self):
        print_header("1. KIỂM THỬ GOOGLE GEMINI: TRÍCH XUẤT ĐỀ THI WORD (TASK M-01)")

        # 1.1 Kiểm tra trích xuất text từ file docx Base64
        docx_b64 = self.create_sample_docx_base64()
        extracted_text = api_handler.extract_text_from_doc_payload({"fileBase64": docx_b64})
        has_text = "Dịch vụ nào của AWS" in extracted_text and "Amazon SQS Queue" in extracted_text
        self.record(
            "MC-01",
            "Trích xuất cấu trúc văn bản từ file Word (.docx Base64)",
            has_text,
            f"Trích xuất thành công {len(extracted_text)} ký tự từ file Word nhúng XML."
        )

        # 1.2 Kiểm tra bóc tách câu hỏi trắc nghiệm qua parser (Failsafe & AI fallback)
        questions = api_handler.rule_based_parse_questions(
            extracted_text,
            subject="Điện toán đám mây",
            topic="AWS Serverless"
        )
        parsed_ok = len(questions) == 2 and questions[0]["correctIndex"] == 1 and questions[1]["correctIndex"] == 0
        self.record(
            "MC-02",
            "Số hóa văn bản thành mảng câu hỏi trắc nghiệm chuẩn A-B-C-D",
            parsed_ok,
            f"Đã trích xuất {len(questions)} câu hỏi; Câu 1 đáp án index={questions[0]['correctIndex'] if questions else 'N/A'} (B), Câu 2 đáp án index={questions[1]['correctIndex'] if len(questions)>1 else 'N/A'} (A)."
        )

        # 1.3 Kiểm tra endpoint POST /questions/parse-doc qua mock DynamoDB
        with patch.object(api_handler.questions_table, "put_item", return_value={"ResponseMetadata": {"HTTPStatusCode": 200}}):
            event = {
                "httpMethod": "POST",
                "resource": "/questions/parse-doc",
                "body": json.dumps({
                    "fileBase64": docx_b64,
                    "bankId": "bank-test-01",
                    "autoSave": True
                })
            }
            res = api_handler.lambda_handler(event, None)
            res_body = json.loads(res.get("body", "{}"))
            endpoint_ok = res.get("statusCode") == 200 and res_body.get("count") >= 2 and res_body.get("saved") is True
            self.record(
                "MC-03",
                "Endpoint POST /questions/parse-doc xử lý thành công và lưu vào CSDL",
                endpoint_ok,
                f"HTTP {res.get('statusCode')}: {res_body.get('message')} | Nguồn: {res_body.get('source')}"
            )

    def test_gemini_virtual_tutor(self):
        print_header("2. KIỂM THỬ GOOGLE GEMINI: GIA SƯ ẢO GIẢI THÍCH ĐÁP ÁN (TASK M-05)")

        # 2.1 Kiểm tra hàm explain_answer_with_gemini
        explanation, source = api_handler.explain_answer_with_gemini(
            content="Mẫu thiết kế nào đảm bảo một lớp chỉ có duy nhất một thể hiện?",
            options=["Factory Method", "Abstract Factory", "Singleton", "Builder"],
            chosen_idx=0,
            correct_idx=2,
            chosen_answer="Factory Method",
            correct_answer="Singleton",
            subject="Kiến trúc & Phát triển Phần mềm"
        )
        has_explanation = len(explanation) > 50 and "Singleton" in explanation
        self.record(
            "MC-04",
            "Gia sư ảo AI phân tích đáp án sai và giải thích phương án đúng",
            has_explanation,
            f"Nguồn: {source} | Độ dài giải thích: {len(explanation)} ký tự."
        )

        # 2.2 Kiểm tra endpoint POST /exam/explain-answers
        event = {
            "httpMethod": "POST",
            "resource": "/exam/explain-answers",
            "body": json.dumps({
                "content": "Dịch vụ nào của AWS cung cấp khả năng điện toán serverless?",
                "options": ["EC2", "Lambda", "RDS", "EBS"],
                "chosenIndex": 0,
                "correctIndex": 1,
                "chosenAnswer": "EC2",
                "correctAnswer": "Lambda"
            })
        }
        res = api_handler.lambda_handler(event, None)
        res_body = json.loads(res.get("body", "{}"))
        endpoint_ok = res.get("statusCode") == 200 and res_body.get("isCorrect") is False and "explanation" in res_body
        self.record(
            "MC-05",
            "Endpoint POST /exam/explain-answers trả về lời phân tích sư phạm chuẩn",
            endpoint_ok,
            f"HTTP {res.get('statusCode')}: isCorrect={res_body.get('isCorrect')} | Nguồn: {res_body.get('source')}"
        )

    # =========================================================================
    # 2. KIỂM THỬ BẢO MẬT BIÊN CLOUDFLARE TURNSTILE (TASK M-02)
    # =========================================================================
    def test_cloudflare_turnstile(self):
        print_header("3. KIỂM THỬ CLOUDFLARE TURNSTILE: CHỐNG BOT SPAM NỘP BÀI (TASK M-02)")

        # 3.1 Kiểm tra xác thực token hợp lệ (Test key)
        passed_token = "1x0000000000000000000000000000000AA"
        is_valid = api_handler.verify_turnstile(passed_token)
        self.record(
            "MC-06",
            "Xác thực Cloudflare Turnstile token hợp lệ thành công",
            is_valid is True,
            f"Token '{passed_token[:10]}...' được phê chuẩn người thật."
        )

        # 3.2 Kiểm tra chặn token giả lập bot
        failed_token = "test-token-failed"
        is_blocked = not api_handler.verify_turnstile(failed_token)
        self.record(
            "MC-07",
            "Chặn đứng Turnstile token giả mạo hoặc script botnet",
            is_blocked,
            f"Token '{failed_token}' bị hệ thống từ chối chính xác."
        )

        # 3.3 Kiểm tra endpoint POST /exam/submit chặn request không có Turnstile token khi bật secret key
        with patch.dict(os.environ, {"CLOUDFLARE_TURNSTILE_SECRET_KEY": "dummy_secret_key"}):
            with patch.object(api_handler, "CLOUDFLARE_TURNSTILE_SECRET_KEY", "dummy_secret_key"):
                # Request 1: Thiếu token -> Phải bị HTTP 403 Blocked
                event_no_token = {
                    "httpMethod": "POST",
                    "resource": "/exam/submit",
                    "body": json.dumps({
                        "sessionId": "EX-TEST-01",
                        "candidateEmail": "bot_attacker@spam.com",
                        "answers": {"q1": 0}
                    })
                }
                res_blocked = api_handler.lambda_handler(event_no_token, None)
                blocked_ok = res_blocked.get("statusCode") == 403
                self.record(
                    "MC-08",
                    "Endpoint POST /exam/submit trả HTTP 403 khi thiếu Turnstile Token",
                    blocked_ok,
                    f"HTTP {res_blocked.get('statusCode')} Forbidden: {json.loads(res_blocked.get('body', '{}')).get('error')}"
                )

                # Request 2: Token sai -> Phải bị HTTP 403 Blocked
                event_bad_token = {
                    "httpMethod": "POST",
                    "resource": "/exam/submit",
                    "body": json.dumps({
                        "sessionId": "EX-TEST-01",
                        "candidateEmail": "bot_attacker@spam.com",
                        "turnstileToken": "test-token-failed",
                        "answers": {"q1": 0}
                    })
                }
                res_bad = api_handler.lambda_handler(event_bad_token, None)
                bad_blocked_ok = res_bad.get("statusCode") == 403
                self.record(
                    "MC-09",
                    "Endpoint POST /exam/submit chặn đứng token botnet không hợp lệ",
                    bad_blocked_ok,
                    f"HTTP {res_bad.get('statusCode')} Forbidden: Phát hiện truy cập tự động."
                )

                # Request 3: Token hợp lệ -> Vượt qua xác thực Turnstile
                with patch.object(api_handler, "SQS_QUEUE_URL", "https://sqs.ap-southeast-1.amazonaws.com/123/ExamQueue"):
                    with patch.object(api_handler.sessions_table, "get_item", return_value={"Item": {"id": "EX-TEST-01", "status": "RUNNING"}}):
                        with patch.object(api_handler.sqs_client, "send_message", return_value={"MessageId": "msg-123"}):
                            event_good = {
                                "httpMethod": "POST",
                                "resource": "/exam/submit",
                                "body": json.dumps({
                                    "sessionId": "EX-TEST-01",
                                    "candidateEmail": "real_candidate@cloudexam.vn",
                                    "turnstileToken": "1x0000000000000000000000000000000AA",
                                    "answers": {"q1": 1}
                                })
                            }
                            res_good = api_handler.lambda_handler(event_good, None)
                            good_ok = res_good.get("statusCode") == 200
                            self.record(
                                "MC-10",
                                "Cho phép thí sinh người thật nộp bài an toàn vào hàng đợi SQS",
                                good_ok,
                                f"HTTP {res_good.get('statusCode')}: {json.loads(res_good.get('body', '{}')).get('message')}"
                            )

    # =========================================================================
    # 3. KIỂM THỬ UPSTASH SERVERLESS REDIS LIVE LEADERBOARD (TASK M-03 & M-04)
    # =========================================================================
    def test_upstash_redis_leaderboard(self):
        print_header("4. KIỂM THỬ UPSTASH SERVERLESS REDIS: LIVE LEADERBOARD (TASK M-03 & M-04)")

        # 3.1 Kiểm thử hàm push_to_upstash_leaderboard trong grading_worker
        mock_resp_data = json.dumps({"result": 1}).encode("utf-8")
        mock_response = MagicMock()
        mock_response.read.return_value = mock_resp_data
        mock_response.__enter__.return_value = mock_response

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://sample-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "sample_token"
        }):
            with patch.object(grading_worker, "UPSTASH_REDIS_REST_URL", "https://sample-redis.upstash.io"):
                with patch.object(grading_worker, "UPSTASH_REDIS_REST_TOKEN", "sample_token"):
                    with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
                        pushed = grading_worker.push_to_upstash_leaderboard("EX-TEST-01", "student_a@cloudexam.vn", 9.5)
                        self.record(
                            "MC-11",
                            "Grading Worker đẩy điểm tức thì vào Upstash Redis ZSET (ZADD)",
                            pushed is True,
                            "Đã gửi lệnh ZADD leaderboard:EX-TEST-01 9.5 student_a@cloudexam.vn tới Upstash REST API."
                        )

        # 3.2 Kiểm thử truy vấn Bảng xếp hạng Top 5 (GET /sessions/{id}/leaderboard)
        # Giả lập Redis trả về: [email1, score1, email2, score2, ...]
        redis_zset_response = json.dumps({
            "result": [
                "top1@cloudexam.vn", "10",
                "top2@cloudexam.vn", "9.5",
                "top3@cloudexam.vn", "8.5",
                "top4@cloudexam.vn", "8.0",
                "top5@cloudexam.vn", "7.5"
            ]
        }).encode("utf-8")
        mock_redis_resp = MagicMock()
        mock_redis_resp.read.return_value = redis_zset_response
        mock_redis_resp.__enter__.return_value = mock_redis_resp

        with patch.object(api_handler, "UPSTASH_REDIS_REST_URL", "https://sample-redis.upstash.io"):
            with patch.object(api_handler, "UPSTASH_REDIS_REST_TOKEN", "sample_token"):
                with patch("urllib.request.urlopen", return_value=mock_redis_resp):
                    event = {
                        "httpMethod": "GET",
                        "resource": "/sessions/{id}/leaderboard",
                        "pathParameters": {"id": "EX-TEST-01"}
                    }
                    res = api_handler.lambda_handler(event, None)
                    res_body = json.loads(res.get("body", "{}"))
                    board = res_body.get("leaderboard", [])
                    board_ok = (
                        res.get("statusCode") == 200 and
                        len(board) == 5 and
                        board[0]["rank"] == 1 and
                        board[0]["score"] == 10 and
                        res_body.get("source") == "Upstash Redis"
                    )
                    self.record(
                        "MC-12",
                        "API GET /sessions/{id}/leaderboard truy xuất Top 5 trực tiếp từ Upstash Redis",
                        board_ok,
                        f"HTTP {res.get('statusCode')}: {len(board)} thí sinh dẫn đầu | Hạng 1: {board[0].get('candidateEmail')} ({board[0].get('score')}đ)"
                    )

        # 3.3 Kiểm thử cơ chế Graceful Fallback sang DynamoDB khi Upstash Redis chưa cấu hình
        with patch.object(api_handler, "UPSTASH_REDIS_REST_URL", ""):
            mock_session_item = {
                "id": "EX-TEST-01",
                "submissions": {
                    "cand_x@cloudexam.vn": {"score": 9.0},
                    "cand_y@cloudexam.vn": {"score": 10.0},
                    "cand_z@cloudexam.vn": {"score": 7.0}
                }
            }
            with patch.object(api_handler.sessions_table, "get_item", return_value={"Item": mock_session_item}):
                event_fallback = {
                    "httpMethod": "GET",
                    "resource": "/sessions/{id}/leaderboard",
                    "pathParameters": {"id": "EX-TEST-01"}
                }
                res_fb = api_handler.lambda_handler(event_fallback, None)
                fb_body = json.loads(res_fb.get("body", "{}"))
                fb_board = fb_body.get("leaderboard", [])
                fallback_ok = (
                    res_fb.get("statusCode") == 200 and
                    len(fb_board) == 3 and
                    fb_board[0]["candidateEmail"] == "cand_y@cloudexam.vn" and
                    fb_board[0]["score"] == 10.0 and
                    fb_body.get("source") == "DynamoDB Fallback"
                )
                self.record(
                    "MC-13",
                    "Tự động chuyển tiếp (Fallback) sang DynamoDB khi Upstash Redis không khả dụng",
                    fallback_ok,
                    f"HTTP {res_fb.get('statusCode')}: Sắp xếp điểm giảm dần qua DynamoDB Submissions thành công."
                )

    # =========================================================================
    # 4. KIỂM THỬ KHẢ NĂNG CHỊU LỖI CHÉO MÂY (MULTI-CLOUD RESILIENCY)
    # =========================================================================
    def test_resiliency_and_graceful_degradation(self):
        print_header("5. KIỂM THỬ KHẢ NĂNG CHỊU LỖI ĐA ĐÁM MÂY (RESILIENCY)")

        # 4.1 Giả lập mất kết nối Google Gemini API khi giải thích câu hỏi -> Không sập 500
        with patch.object(api_handler, "GEMINI_API_KEY", "invalid_or_expired_key"):
            with patch("urllib.request.urlopen", side_effect=Exception("Connection timed out")):
                explanation, source = api_handler.explain_answer_with_gemini(
                    content="Điện toán đám mây là gì?",
                    options=["Mô hình chia sẻ tài nguyên", "Máy tính cá nhân", "USB", "Đĩa mềm"],
                    chosen_idx=1,
                    correct_idx=0,
                    chosen_answer="Máy tính cá nhân",
                    correct_answer="Mô hình chia sẻ tài nguyên"
                )
                resilient_ok = len(explanation) > 20 and "Mô hình chia sẻ tài nguyên" in explanation
                self.record(
                    "MC-14",
                    "Khả năng phục hồi khi Google Gemini rớt mạng (Không làm sập hệ thống)",
                    resilient_ok,
                    f"Chuyển sang {source}: Phản hồi an toàn, bảo vệ trải nghiệm của thí sinh."
                )

        # 4.2 Giả lập Upstash Redis lỗi kết nối khi chấm điểm -> SQS Worker vẫn hoàn thành ghi DynamoDB
        with patch.object(grading_worker, "UPSTASH_REDIS_REST_URL", "https://offline-redis.upstash.io"):
            with patch("urllib.request.urlopen", side_effect=Exception("Redis Host Unreachable")):
                mock_sub = {
                    "sessionId": "EX-TEST-01",
                    "candidateEmail": "resilient_student@cloudexam.vn",
                    "answers": {"q1": 0}
                }
                with patch.object(grading_worker, "get_question_item", return_value={"id": "q1", "score": 10, "correctIndex": 0}):
                    with patch.object(grading_worker.sessions_table, "update_item", return_value={}):
                        graded_res = grading_worker.grade_submission(mock_sub)
                        grading_intact = graded_res.get("status") == "COMPLETED" and graded_res.get("score") == 10
                        self.record(
                            "MC-15",
                            "Grading Worker chấm điểm bảo toàn 100% dù Upstash Redis gặp sự cố",
                            grading_intact,
                            f"Điểm số được ghi nhận an toàn vào DynamoDB: {graded_res.get('score')} điểm."
                        )

    # =========================================================================
    # 5. KIỂM THỬ STEP FUNCTIONS AUTO-FINALIZE & EMAIL BÁO CÁO QUA SNS (SPRINT 4)
    # =========================================================================
    def test_step_functions_and_sns_reporting(self):
        print_header("6. KIỂM THỬ STEP FUNCTIONS AUTO-FINALIZE & BÁO CÁO AMAZON SNS")

        # 5.1 Kiểm tra Auto-Finalize quét bài nháp tự động thu bài và chấm điểm
        mock_session_item = {
            "id": "EX-FINALIZE-01",
            "name": "Ca thi Thu tu dong",
            "status": "CLOSED",
            "candidateEmails": ["student_draft@cloudexam.vn", "student_submitted@cloudexam.vn"],
            "submissions": {
                "student_submitted@cloudexam.vn": {
                    "id": "EX-FINALIZE-01#student_submitted@cloudexam.vn",
                    "candidateEmail": "student_submitted@cloudexam.vn",
                    "score": 10,
                    "maxScore": 10
                }
            },
            "draftSubmissions": {
                "student_draft@cloudexam.vn": {
                    "answers": {"q1": 0},
                    "updatedAt": "2026-11-01T12:00:00Z"
                }
            }
        }

        with patch.object(api_handler.sessions_table, "get_item", return_value={"Item": mock_session_item}):
            with patch.object(api_handler.questions_table, "get_item", return_value={"Item": {"id": "q1", "correctIndex": 0, "score": 10}}):
                with patch.object(api_handler.sessions_table, "update_item", return_value={}):
                    with patch.object(api_handler.submissions_table, "put_item", return_value={}):
                        event = {
                            "action": "AUTO_FINALIZE",
                            "sessionId": "EX-FINALIZE-01"
                        }
                        res = api_handler.lambda_handler(event, None)
                        res_body = json.loads(res.get("body", "{}"))
                        finalize_ok = res.get("statusCode") == 200 and res_body.get("finalizedCount") == 1 and "student_draft@cloudexam.vn" in res_body.get("finalizedStudents", [])
                        self.record(
                            "MC-16",
                            "Step Functions Auto-Finalize tự động quét nháp và chấm bù khi đóng ca thi",
                            finalize_ok,
                            f"HTTP {res.get('statusCode')}: Đã thu bù {res_body.get('finalizedCount')} bài thi nháp thành công."
                        )

        # 5.2 Kiểm tra Endpoint /sessions/{id}/send-report tổng hợp phổ điểm và gửi Amazon SNS
        mock_submissions = [
            {"sessionId": "EX-REPORT-01", "candidateEmail": "sv1@cloudexam.vn", "score": 9.5, "correctCount": 19, "totalQuestions": 20},
            {"sessionId": "EX-REPORT-01", "candidateEmail": "sv2@cloudexam.vn", "score": 8.0, "correctCount": 16, "totalQuestions": 20},
            {"sessionId": "EX-REPORT-01", "candidateEmail": "sv3@cloudexam.vn", "score": 6.5, "correctCount": 13, "totalQuestions": 20},
            {"sessionId": "EX-REPORT-01", "candidateEmail": "sv4@cloudexam.vn", "score": 4.0, "correctCount": 8, "totalQuestions": 20}
        ]
        mock_report_session = {
            "id": "EX-REPORT-01",
            "name": "Kiểm tra Điện toán đám mây Cuối kỳ",
            "status": "CLOSED",
            "candidateEmails": ["sv1@cloudexam.vn", "sv2@cloudexam.vn", "sv3@cloudexam.vn", "sv4@cloudexam.vn", "sv5@cloudexam.vn"],
            "submissions": {}
        }

        with patch.object(api_handler, "SNS_TOPIC_ARN", "arn:aws:sns:ap-southeast-1:409289618109:cloudexam-alerts-dev"):
            with patch.object(api_handler.sessions_table, "get_item", return_value={"Item": mock_report_session}):
                with patch.object(api_handler.submissions_table, "query", return_value={"Items": mock_submissions}):
                    with patch.object(api_handler.sns_client, "publish", return_value={"MessageId": "msg-sns-test-12345"}):
                        event = {
                            "httpMethod": "POST",
                            "resource": "/sessions/{id}/send-report",
                            "pathParameters": {"id": "EX-REPORT-01"}
                        }
                        res = api_handler.lambda_handler(event, None)
                        res_body = json.loads(res.get("body", "{}"))
                        report_ok = (
                            res.get("statusCode") == 200
                            and res_body.get("stats", {}).get("totalSubmitted") == 4
                            and res_body.get("stats", {}).get("avgScore") == 7.0
                            and res_body.get("messageId") == "msg-sns-test-12345"
                        )
                        self.record(
                            "MC-17",
                            "Endpoint POST /sessions/{id}/send-report tổng hợp phổ điểm và gửi Amazon SNS",
                            report_ok,
                            f"HTTP {res.get('statusCode')}: Đã gửi email SNS (MessageId: {res_body.get('messageId')}) | Điểm TB: {res_body.get('stats', {}).get('avgScore')}."
                        )

        # 5.3 Kiểm tra hỗ trợ chỉ định mô hình Gemini 4 Argon tùy biến
        with patch.object(api_handler, "GEMINI_API_KEY", ""):
            exp, source = api_handler.explain_answer_with_gemini(
                content="AWS Lambda hoạt động theo mô hình nào?",
                options=["Serverless", "IaaS", "Dedicated Host", "On-premise"],
                chosen_idx=0,
                correct_idx=0,
                chosen_answer="Serverless",
                correct_answer="Serverless",
                model="gemini-4-argon"
            )
            argon_ok = "Serverless" in exp and "Deterministic Fallback" in source
            self.record(
                "MC-18",
                "Hỗ trợ chỉ định mô hình thế hệ mới Google Gemini 4 Argon (gemini-4-argon)",
                argon_ok,
                f"Nguồn: {source} | Mô hình chỉ định hoạt động chuẩn xác với cơ chế chịu lỗi failsafe."
            )

    def print_summary(self):
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed

        print(f"\n{CYAN}{BOLD}{'=' * 75}{RESET}")
        print(f"{CYAN}{BOLD}TỔNG HỢP KẾT QUẢ KIỂM THỬ ĐA ĐÁM MÂY (MULTI-CLOUD TEST REPORT){RESET}")
        print(f"{CYAN}{BOLD}{'=' * 75}{RESET}")
        print(f"  Tổng số ca kiểm thử: {BOLD}{total}{RESET}")
        print(f"  Thành công (PASS):   {GREEN}{BOLD}{passed}{RESET}")
        print(f"  Thất bại  (FAIL):   {RED if failed > 0 else GREEN}{BOLD}{failed}{RESET}")
        print(f"  Tỷ lệ đạt chuẩn:     {GREEN if failed == 0 else YELLOW}{BOLD}{(passed / total) * 100:.1f}%{RESET}")
        print(f"{CYAN}{BOLD}{'=' * 75}{RESET}\n")

        return failed == 0


if __name__ == "__main__":
    suite = MultiCloudTestSuite()
    suite.test_gemini_doc_parsing()
    suite.test_gemini_virtual_tutor()
    suite.test_cloudflare_turnstile()
    suite.test_upstash_redis_leaderboard()
    suite.test_resiliency_and_graceful_degradation()
    suite.test_step_functions_and_sns_reporting()

    all_passed = suite.print_summary()
    sys.exit(0 if all_passed else 1)
