#!/usr/bin/env python3
"""
CloudExam - Script Tạo Lưu Lượng Nộp Bài Thật Lên Amazon SQS Trên AWS Live
Phục vụ lấy minh chứng đồ thị hấp thụ tải (Spike) trên AWS CloudWatch / SQS Console.
"""

import boto3
import json
import uuid
import time
from datetime import datetime, timezone

REGION = "ap-southeast-1"
QUEUE_NAME = "cloudexam-exam-submission-queue-dev"
NUM_MESSAGES = 100  # Số bài nộp gửi lên để tạo đỉnh nhọn đồ thị

def main():
    print(f"🚀 Đang kết nối tới AWS SQS tại vùng {REGION}...")
    sqs = boto3.client("sqs", region_name=REGION)
    
    # 1. Lấy URL của hàng đợi
    try:
        res = sqs.get_queue_url(QueueName=QUEUE_NAME)
        queue_url = res["QueueUrl"]
        print(f"✅ Đã tìm thấy hàng đợi: {queue_url}")
    except Exception as e:
        print(f"❌ Không tìm thấy hàng đợi {QUEUE_NAME}: {e}")
        return

    print(f"\n📦 Bắt đầu bơm {NUM_MESSAGES} bài nộp vào SQS để tạo đỉnh nhọn tải...")
    start_time = time.time()
    
    # 2. Gửi các message theo đợt (batch) để tốc độ đẩy lên cực nhanh trong < 3 giây
    entries = []
    sent_count = 0
    
    for i in range(1, NUM_MESSAGES + 1):
        sub_id = str(uuid.uuid4())
        payload = {
            "submissionId": sub_id,
            "sessionId": "SES101",
            "candidateEmail": f"student_loadtest_{i:03d}@vnu.edu.vn",
            "answers": {f"q_{j}": (j % 4) for j in range(1, 21)},
            "submittedAt": datetime.now(timezone.utc).isoformat()
        }
        
        entries.append({
            "Id": str(i),
            "MessageBody": json.dumps(payload),
            "MessageAttributes": {
                "SessionId": {"DataType": "String", "StringValue": "SES101"},
                "CandidateEmail": {"DataType": "String", "StringValue": payload["candidateEmail"]}
            }
        })
        
        # SQS send_message_batch giới hạn tối đa 10 messages mỗi lần gọi
        if len(entries) == 10:
            sqs.send_message_batch(QueueUrl=queue_url, Entries=entries)
            sent_count += len(entries)
            print(f"   --> Đã gửi: {sent_count}/{NUM_MESSAGES} bài nộp vào SQS...")
            entries = []
            
    if entries:
        sqs.send_message_batch(QueueUrl=queue_url, Entries=entries)
        sent_count += len(entries)
        print(f"   --> Đã gửi: {sent_count}/{NUM_MESSAGES} bài nộp vào SQS...")

    total_time = round(time.time() - start_time, 2)
    print(f"\n🎉 HOÀN TẤT! Đã gửi thành công {sent_count} bài nộp vào SQS trong {total_time} giây!")
    print(f"👉 Bây giờ bạn hãy mở lại AWS Console, đợi 1-2 phút và F5 đồ thị CloudWatch để thấy đỉnh nhọn!")

if __name__ == "__main__":
    main()
