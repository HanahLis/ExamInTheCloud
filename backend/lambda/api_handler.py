"""
CloudExam - Lambda Core API Handler
Xử lý các nghiệp vụ REST API cho Questions, Candidates, Sessions, Exam Submission.
Tích hợp Cognito Authorizer (RBAC qua cognito:groups claim).
"""

import json
import os
import uuid
import boto3
from decimal import Decimal
from datetime import datetime, timezone

# Khởi tạo DynamoDB Resource
REGION = os.getenv("AWS_REGION", "ap-southeast-1")
ENV = os.getenv("ENV", "dev")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
questions_table = dynamodb.Table(f"CloudExam_Questions_{ENV}")
candidates_table = dynamodb.Table(f"CloudExam_Candidates_{ENV}")
sessions_table = dynamodb.Table(f"CloudExam_Sessions_{ENV}")
question_banks_table = dynamodb.Table(f"CloudExam_QuestionBanks_{ENV}")

# Helper chuyển đổi Decimal của DynamoDB sang int/float/str cho JSON
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def build_response(status_code: int, body: any):
    """Tạo HTTP Response chuẩn kèm CORS headers"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def get_auth_claims(event):
    """Trích xuất claims từ Cognito Authorizer"""
    try:
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        claims = authorizer.get("claims", {})
        email = claims.get("email", "")
        # cognito:groups có thể là chuỗi "Admin,Organizer" hoặc list
        raw_groups = claims.get("cognito:groups", "")
        if isinstance(raw_groups, list):
            groups = raw_groups
        elif isinstance(raw_groups, str) and raw_groups:
            groups = [g.strip() for g in raw_groups.split(",")]
        else:
            groups = []
        return {"email": email, "groups": groups}
    except Exception:
        return {"email": "", "groups": []}

def check_permission(claims, allowed_groups):
    """Kiểm tra quyền truy cập dựa trên Cognito Group (RBAC)"""
    user_groups = claims.get("groups", [])
    if any(g in allowed_groups for g in user_groups):
        return True
    return False

def lambda_handler(event, context):
    http_method = event.get("httpMethod", "")
    resource_path = event.get("resource", "")
    path_parameters = event.get("pathParameters") or {}
    query_parameters = event.get("queryStringParameters") or {}
    
    # Preflight CORS OPTIONS
    if http_method == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    claims = get_auth_claims(event)
    print(f"Incoming Request: {http_method} {resource_path} | User: {claims.get('email')} | Groups: {claims.get('groups')}")

    try:
        body = json.loads(event.get("body") or "{}") if event.get("body") else {}
    except Exception:
        body = {}

    try:
        # =========================================================================
        # 1. /questions API (Ngân hàng câu hỏi)
        # =========================================================================
        if resource_path == "/questions":
            if http_method == "GET":
                # Thí sinh hoặc Organizer đều có thể đọc câu hỏi (thí sinh khi trong phòng thi)
                scan_res = questions_table.scan()
                items = scan_res.get("Items", [])
                return build_response(200, items)

            elif http_method == "POST":
                # Chỉ Organizer hoặc Admin mới được tạo câu hỏi
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Chỉ Organizer hoặc Admin mới có quyền tạo câu hỏi."})
                
                question_id = str(uuid.uuid4())
                item = {
                    "id": question_id,
                    "bankId": body.get("bankId", "bank-default"),
                    "content": body.get("content", ""),
                    "options": body.get("options", []),
                    "correctIndex": body.get("correctIndex", 0),
                    "score": Decimal(str(body.get("score", 1))),
                    "difficulty": body.get("difficulty", "EASY"),
                    "imageUrl": body.get("imageUrl", ""),
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                questions_table.put_item(Item=item)
                return build_response(201, item)

        elif resource_path == "/questions/{id}":
            q_id = path_parameters.get("id")
            if http_method == "GET":
                res = questions_table.get_item(Key={"id": q_id})
                item = res.get("Item")
                if not item:
                    return build_response(404, {"error": "Câu hỏi không tồn tại"})
                return build_response(200, item)

            elif http_method == "PUT":
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Chỉ Organizer hoặc Admin mới có quyền sửa câu hỏi."})
                
                # Cập nhật các trường
                update_expr = "SET content = :c, #opt = :o, correctIndex = :ci, score = :s, difficulty = :d, imageUrl = :img"
                expr_names = {"#opt": "options"}
                expr_vals = {
                    ":c": body.get("content", ""),
                    ":o": body.get("options", []),
                    ":ci": body.get("correctIndex", 0),
                    ":s": Decimal(str(body.get("score", 1))),
                    ":d": body.get("difficulty", "EASY"),
                    ":img": body.get("imageUrl", "")
                }
                questions_table.update_item(
                    Key={"id": q_id},
                    UpdateExpression=update_expr,
                    ExpressionAttributeNames=expr_names,
                    ExpressionAttributeValues=expr_vals
                )
                return build_response(200, {"message": "Cập nhật thành công", "id": q_id})

            elif http_method == "DELETE":
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Chỉ Organizer hoặc Admin mới có quyền xóa câu hỏi."})
                
                questions_table.delete_item(Key={"id": q_id})
                return build_response(200, {"message": "Xóa câu hỏi thành công", "id": q_id})

        # =========================================================================
        # 2. /candidates API (Quản lý thí sinh)
        # =========================================================================
        elif resource_path == "/candidates":
            if http_method == "GET":
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Không có quyền xem danh sách thí sinh."})
                
                scan_res = candidates_table.scan()
                return build_response(200, scan_res.get("Items", []))

            elif http_method == "POST":
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Không có quyền thêm thí sinh."})
                
                candidate_email = body.get("email")
                if not candidate_email:
                    return build_response(400, {"error": "Thiếu email thí sinh."})
                
                item = {
                    "email": candidate_email,
                    "studentCode": body.get("studentCode", ""),
                    "name": body.get("name", ""),
                    "className": body.get("className", ""),
                    "faceImageUrl": body.get("faceImageUrl", ""),
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                candidates_table.put_item(Item=item)
                return build_response(201, item)

        elif resource_path == "/candidates/{email}":
            c_email = path_parameters.get("email")
            if http_method == "GET":
                res = candidates_table.get_item(Key={"email": c_email})
                item = res.get("Item")
                if not item:
                    return build_response(404, {"error": "Thí sinh không tồn tại"})
                return build_response(200, item)

            elif http_method == "DELETE":
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Không có quyền xóa thí sinh."})
                
                candidates_table.delete_item(Key={"email": c_email})
                return build_response(200, {"message": "Xóa thí sinh thành công", "email": c_email})

        # =========================================================================
        # 3. /sessions API (Quản lý ca thi)
        # =========================================================================
        elif resource_path == "/sessions":
            if http_method == "GET":
                scan_res = sessions_table.scan()
                return build_response(200, scan_res.get("Items", []))

            elif http_method == "POST":
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Không có quyền tạo ca thi."})
                
                session_id = body.get("id") or f"EX{datetime.now().strftime('%Y%m%d%H%M%S')}"
                item = {
                    "id": session_id,
                    "name": body.get("name", "Ca thi trực tuyến"),
                    "startTime": body.get("startTime", ""),
                    "endTime": body.get("endTime", ""),
                    "status": body.get("status", "SCHEDULED"),
                    "questionIds": body.get("questionIds", []),
                    "candidateEmails": body.get("candidateEmails", []),
                    "link": f"https://cloudexam.vn/exam/{session_id}",
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                sessions_table.put_item(Item=item)
                return build_response(201, item)

        elif resource_path == "/sessions/{id}":
            s_id = path_parameters.get("id")
            if http_method == "GET":
                res = sessions_table.get_item(Key={"id": s_id})
                item = res.get("Item")
                if not item:
                    return build_response(404, {"error": "Ca thi không tồn tại"})
                return build_response(200, item)

            elif http_method == "PUT":
                if not check_permission(claims, ["Admin", "Organizer"]):
                    return build_response(403, {"error": "Forbidden: Không có quyền cập nhật ca thi."})
                
                status = body.get("status")
                sessions_table.update_item(
                    Key={"id": s_id},
                    UpdateExpression="SET #st = :s",
                    ExpressionAttributeNames={"#st": "status"},
                    ExpressionAttributeValues={":s": status}
                )
                return build_response(200, {"message": "Cập nhật ca thi thành công", "id": s_id, "status": status})

        # =========================================================================
        # 4. /exam/submit API (Nộp bài thi)
        # =========================================================================
        elif resource_path == "/exam/submit" and http_method == "POST":
            user_email = claims.get("email")
            session_id = body.get("sessionId")
            answers = body.get("answers", {})  # { questionId: chosenIndex }

            if not session_id or not user_email:
                return build_response(400, {"error": "Thiếu sessionId hoặc thông tin thí sinh."})

            # Tính điểm cơ bản
            total_score = Decimal("0")
            for q_id, chosen_idx in answers.items():
                q_res = questions_table.get_item(Key={"id": q_id})
                q_item = q_res.get("Item")
                if q_item and q_item.get("correctIndex") == chosen_idx:
                    total_score += Decimal(str(q_item.get("score", 1)))

            result_item = {
                "id": f"{session_id}#{user_email}",
                "sessionId": session_id,
                "candidateEmail": user_email,
                "score": total_score,
                "submittedAt": datetime.now(timezone.utc).isoformat(),
                "status": "COMPLETED"
            }
            return build_response(200, {
                "message": "Nộp bài thành công",
                "result": result_item
            })

        return build_response(404, {"error": f"Endpoint không hỗ trợ: {http_method} {resource_path}"})

    except Exception as e:
        print(f"Error handling request: {str(e)}")
        return build_response(500, {"error": "Internal Server Error", "details": str(e)})
