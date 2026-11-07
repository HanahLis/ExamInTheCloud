import sys
import time
import os

# Add backend lambda to sys.path
sys.path.insert(0, os.path.abspath("backend/lambda"))

from api_handler import (
    clean_gemini_json_response,
    normalize_gemini_model,
    parse_questions_with_gemini,
    explain_answer_with_gemini,
    rule_based_parse_questions,
)

passed_count = 0
total_count = 0

def assert_test(name, condition, details=""):
    global passed_count, total_count
    total_count += 1
    if condition:
        passed_count += 1
        print(f"  [PASS] {name} - {details}")
    else:
        print(f"  [FAIL] {name} - {details}")

print("===========================================================================")
print(">>> KIỂM THỬ TÍNH NĂNG GOOGLE GEMINI AI VÀ CƠ CHẾ TỐI ƯU HÓA")
print("===========================================================================")

# 1. Kiểm thử clean_gemini_json_response
print("\n1. Kiểm thử bộ bóc tách JSON siêu bền (clean_gemini_json_response):")

test_json_clean = '[{"content": "Câu 1", "options": ["A", "B"], "correctIndex": 0}]'
res1 = clean_gemini_json_response(test_json_clean)
assert_test("JSON Array thuần", isinstance(res1, list) and len(res1) == 1, f"len={len(res1) if res1 else 0}")

test_json_markdown = '```json\n[{"content": "Câu 1", "options": ["A", "B"], "correctIndex": 0}]\n```'
res2 = clean_gemini_json_response(test_json_markdown)
assert_test("JSON bọc trong Markdown Code Fence", isinstance(res2, list) and len(res2) == 1)

test_json_convo = 'Dưới đây là danh sách câu hỏi:\n```json\n[{"content": "Câu 1", "options": ["A", "B"], "correctIndex": 0}]\n```\nChúc bạn thi tốt!'
res3 = clean_gemini_json_response(test_json_convo)
assert_test("JSON có lời thoại bao quanh", isinstance(res3, list) and len(res3) == 1)

test_json_obj = '{"questions": [{"content": "Câu 1", "options": ["A", "B"], "correctIndex": 0}]}'
res4 = clean_gemini_json_response(test_json_obj)
assert_test("JSON bọc trong Object questions", isinstance(res4, dict) and "questions" in res4)

res5 = clean_gemini_json_response("Đây là văn bản lỗi, không có JSON")
assert_test("Xử lý lỗi văn bản không phải JSON", res5 is None)


# 2. Kiểm thử chuẩn hóa Model (normalize_gemini_model)
print("\n2. Kiểm thử Chuẩn hóa tên mô hình (normalize_gemini_model):")
assert_test("gemini-3.8-flash -> gemini-2.0-flash", normalize_gemini_model("gemini-3.8-flash") == "gemini-2.0-flash")
assert_test("gemini-4-argon -> gemini-2.0-flash", normalize_gemini_model("gemini-4-argon") == "gemini-2.0-flash")
assert_test("gemini-1.5-flash giữ nguyên", normalize_gemini_model("gemini-1.5-flash") == "gemini-1.5-flash")
assert_test("gemini-1.5-pro giữ nguyên", normalize_gemini_model("gemini-1.5-pro") == "gemini-1.5-pro")
assert_test("gemini-2.0-flash-lite giữ nguyên", normalize_gemini_model("gemini-2.0-flash-lite") == "gemini-2.0-flash-lite")
assert_test("Chuỗi rỗng -> gemini-2.0-flash", normalize_gemini_model("") == "gemini-2.0-flash")


# 3. Kiểm thử Tối ưu hóa độ trễ khi Key không hợp lệ (Fast-Failover < 1s)
print("\n3. Kiểm thử Tối ưu hóa độ trễ chuyển tiếp Fallback (Fast Failover):")
start_time = time.time()
questions, source = parse_questions_with_gemini(
    "Câu 1: Điện toán đám mây là gì?\nA. Dịch vụ lưu trữ qua Internet\nB. Máy tính bàn\nC. Đĩa mềm\nD. RAM\nĐáp án: A",
    subject="Cloud Computing",
    topic="Overview",
    model="gemini-2.0-flash",
    api_key="AQ.InvalidKeyTest"
)
elapsed = time.time() - start_time
assert_test("Thời gian chuyển đổi Fallback < 1.5s", elapsed < 1.5, f"Thời gian thực tế: {elapsed:.3f}s")
assert_test("Trích xuất câu hỏi đầy đủ khi Fallback", len(questions) >= 1 and questions[0]["correctIndex"] == 0, f"Số câu: {len(questions)}")
assert_test("Nguồn chỉ định rõ lỗi model", "Fallback" in source, f"Nguồn: {source}")


# 4. Kiểm thử Sinh đề theo chủ đề & số lượng (Rule-based Fallback Generator)
print("\n4. Kiểm thử Bộ sinh câu hỏi dự phòng đa môn học:")
prompt_req = "Tạo 5 câu hỏi về Bảo mật đám mây và IAM"
q_gen = rule_based_parse_questions(prompt_req, subject="An toàn bảo mật", topic="IAM")
assert_test("Sinh đủ 5 câu hỏi yêu cầu", len(q_gen) >= 5, f"Sinh được: {len(q_gen)} câu")
for idx, q in enumerate(q_gen[:3]):
    has_opts = isinstance(q.get("options"), list) and len(q.get("options")) == 4
    has_ans = q.get("correctAnswer") in q.get("options")
    assert_test(f"Câu {idx+1} chuẩn cấu trúc 4 phương án", has_opts and has_ans)


# 5. Kiểm thử Gia sư ảo AI giải thích câu sai
print("\n5. Kiểm thử AI Gia sư ảo sư phạm:")
exp, exp_src = explain_answer_with_gemini(
    content="AWS Lambda thuộc loại mô hình điện toán đám mây nào?",
    options=["IaaS", "PaaS", "SaaS", "Serverless / FaaS"],
    chosen_idx=0,
    correct_idx=3,
    chosen_answer="IaaS",
    correct_answer="Serverless / FaaS",
    subject="Điện toán đám mây",
    model="gemini-2.0-flash"
)
assert_test("Gia sư ảo phân tích đúng đáp án đúng và điểm sai", "Serverless / FaaS" in exp and "IaaS" in exp)
assert_test("Nguồn giải thích chuẩn xác", "Fallback" in exp_src or "Google Gemini" in exp_src, f"Nguồn: {exp_src}")

print("\n===========================================================================")
print(f"KẾT QUẢ: Đạt {passed_count}/{total_count} kiểm thử ({(passed_count/total_count)*100:.1f}%)")
print("===========================================================================")

if passed_count == total_count:
    sys.exit(0)
else:
    sys.exit(1)
