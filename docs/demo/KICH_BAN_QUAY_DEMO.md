# Kịch bản quay demo CloudExam

Tài liệu này là danh sách cảnh quay để bạn tự thao tác và ghi màn hình. Không cần lời bình, không cần dựng hiệu ứng.

## 1. Thông số video

| Hạng mục | Giá trị |
|---|---|
| Độ phân giải | 1920×1080, 25 hoặc 30 fps |
| Phạm vi quay | Toàn màn hình trình duyệt, không quay desktop |
| Âm thanh | Tắt micro, video không tiếng |
| Ảnh tĩnh | Giữ nguyên khung, không zoom, không pan |
| Footage thô | Khoảng 6 phút |
| Bản dựng cuối | Cắt còn khoảng 4:30, chỉ cắt, không hiệu ứng |

## 2. Dữ liệu và tài khoản (kiểm tra ngày 15/11/2026)

| Vai trò | Tài khoản | Mật khẩu |
|---|---|---|
| Giảng viên | annv@uet.vnu.edu.vn | 12345678 |
| Giám thị | laladoraema@gmail.com | 12345678 |
| Thí sinh | tranducmanh2006@gmail.com (Trần Đức Mạnh) | mã phòng 240616 |

- Trang chủ: https://cloudexam.id.vn
- Ca thi sẵn có: EX-MWGR9M4W, tên "Thi cuối kỳ Điện toán đám mây — SES101", đang RUNNING đến 07:44 ngày 15/11.
- Link ca thi: https://cloudexam.id.vn/?exam=EX-MWGR9M4W
- Ngân hàng SES101: 50 câu, đã bóc tách từ `backend/data/sample_exam_ses101.docx`.
- Ảnh hồ sơ thí sinh: `faces/24021561.jpg` (khớp khuôn mặt bạn).
- Bảng xếp hạng ca EX-MWGR9M4W đang có 5 người (Trần Đức Mạnh hạng 1, 50/50).

Lưu ý trạng thái hiện tại:

- Tài khoản Trần Đức Mạnh đã được mở khóa thiết bị và đã có bài nộp; bài nộp mới sẽ thay thế kết quả cũ trên ca thi. Nếu bị khóa lại sau khi điểm danh thử, vào Bàn Giám thị bấm "Mở khóa máy".
- Nếu quay sau 07:44 ngày 15/11, ca EX-MWGR9M4W hết hạn. Khi đó dùng phương án B ở cảnh S4: tạo ca mới ngay trong lúc quay.

## 3. Chuẩn bị trước khi bấm quay

- [ ] Chrome sạch: tắt extension, ẩn bookmark bar, zoom 100%, tắt thông báo hệ thống.
- [ ] Cửa sổ 1: Chrome thường, đăng nhập sẵn tài khoản giảng viên.
- [ ] Cửa sổ 2: ẩn danh, để trống cho thí sinh.
- [ ] Cửa sổ 3 (tùy chọn): profile Chrome khác, dùng cho cảnh chặn thiết bị thứ hai.
- [ ] Mở sẵn thư mục chứa `backend/data/sample_exam_ses101.docx`.
- [ ] Webcam hoạt động, đã cấp quyền cho cloudexam.id.vn. Ngồi cách camera 50–70 cm, ánh sáng chiếu từ phía trước, không để cửa sổ sáng ngược sau lưng.
- [ ] AWS Console đăng nhập sẵn, region ap-southeast-1, mở trước các tab:
  - SQS Queues: `cloudexam-exam-submission-queue-dev` và `cloudexam-exam-submission-dlq-dev`
  - Step Functions: `cloudexam-exam-lifecycle-v2-dev`, tab Executions
  - CloudWatch: Alarms
  - Logs Insights (chỉ mở nếu dùng cảnh S10b)
  - Cost Explorer
- [ ] Đóng chat, email, cửa sổ có token hay khóa API.
- [ ] Thử riêng cảnh offline/F5 ở S7 trước khi quay chính thức.

## 4. Danh sách cảnh quay

### S1. Trang chủ (6 giây)

Mở https://cloudexam.id.vn. Giữ yên 5 giây, không cuộn, không di chuột.

### S2. Đăng nhập giảng viên (15 giây)

1. Nhập annv@uet.vnu.edu.vn, mật khẩu 12345678.
2. Bấm "Đăng nhập".
3. Dừng 2 giây ở dashboard có badge vai trò Giảng viên và 4 tab: Ngân hàng câu hỏi, Thí sinh, Ca thi, Phòng thi.

### S3. Bóc tách đề Word 50 câu (55 giây)

1. Tab "Ngân hàng câu hỏi".
2. Bấm "Tạo ngân hàng mới", đặt tên "SES101 — Quay demo", môn "Điện toán đám mây", bấm "Tạo ngân hàng".
3. Bấm "Nhập từ tệp Word (AI)".
4. Trong modal "Nhập câu hỏi từ tệp Word (.docx)":
   - Ngân hàng câu hỏi đích: chọn "SES101 — Quay demo".
   - Môn học: Điện toán đám mây. Chủ đề: AWS.
   - Chuyển tab "Tải tệp Word (.docx) / Văn bản (.txt)".
   - Chọn `backend/data/sample_exam_ses101.docx`.
5. Bấm "Trích xuất câu hỏi". Chờ khoảng 2 giây.
6. Dừng 3 giây ở danh sách 50 câu vừa trích xuất, cuộn chậm một đoạn ngắn để thấy nội dung và đáp án.
7. Bấm "Hoàn thành".

Ghi chú: môi trường dev chưa cấu hình Gemini API key, hệ thống dùng bộ bóc tách cục bộ. Không cần nói điều này trong video, nhưng không được ghi là "Gemini AI" trên hình.

### S4. Tạo ca thi (45 giây)

1. Tab "Ca thi", bấm "Tạo ca thi mới".
2. Tên ca thi: "Thi cuối kỳ Điện toán đám mây — SES101".
3. Thời gian bắt đầu: thời điểm hiện tại. Kết thúc: cộng 45 phút.
4. Mật khẩu phòng thi: bấm "Sinh ngẫu nhiên" hoặc nhập 240616.
5. Chọn câu hỏi: ở nhóm "SES101 — Quay demo" bấm "Chọn cả ngân hàng" để lấy đúng 50 câu. Không bấm "Chọn tất cả" vì sẽ gộp cả ngân hàng cũ.
6. Danh sách thí sinh: chỉ tick Trần Đức Mạnh.
7. Phân công giám thị: tick laladoraema@gmail.com.
8. Bấm "Tạo ca thi mới". Dừng 2 giây ở thẻ ca thi mới: mã ca, mật khẩu, link.
9. Bấm "Sao chép liên kết" để hiện hộp thoại xác nhận, rồi đóng.
10. Nếu ca mới ở trạng thái "Đã lên lịch", bấm "Bắt đầu" để chuyển "Đang diễn ra".

Phương án B: nếu dùng ca EX-MWGR9M4W có sẵn, bỏ qua cảnh S4. Khi đó thí sinh dùng link và mã phòng 240616 ở mục 2.

### S5. Thí sinh đăng nhập và điểm danh (50 giây)

1. Cửa sổ ẩn danh, mở link ca thi vừa tạo (dạng `https://cloudexam.id.vn/?exam=<mã ca>`).
2. Trang "Cổng Đăng Nhập Phòng Thi Trực Tuyến": nhập email tranducmanh2006@gmail.com và mật khẩu phòng.
3. Bấm "Đăng nhập vào phòng thi".
4. Danh sách ca được chỉ định, bấm "Vào phòng thi".
5. Thẻ "Xác thực danh tính khuôn mặt": bấm "Bật Camera", chờ 2 giây.
6. Bật "Gương" để chế độ Mirror Mode.
7. Nhìn thẳng, bấm "Chụp ảnh & Điểm danh".
8. Dừng 3 giây ở kết quả "Xác thực danh tính thành công! Độ trùng khớp: ..." kèm thông báo khóa thiết bị.
9. Bấm "Bắt đầu làm bài".

### S6. Chặn thiết bị thứ hai, tùy chọn (15 giây)

1. Cửa sổ Chrome thứ ba, mở cùng link ca thi.
2. Nhập cùng email và mật khẩu phòng.
3. Dừng 3 giây ở banner đỏ: "Tài khoản thí sinh ... đã xác thực danh tính và đang có người vào làm bài...".
4. Đóng cửa sổ này, quay lại cửa sổ thí sinh chính.

### S7. Làm bài và Local-First (55 giây)

1. Chọn đáp án cho 3 câu đầu. Mỗi lần bấm, dừng 1 giây.
2. Chỉ vào nhãn cạnh đồng hồ: "Đã lưu cục bộ", sau đó chuyển "Đã lưu bài làm lúc HH:MM:SS".
3. Bấm F12, tab Network, chuyển Offline.
4. Chọn thêm 2 câu. Dừng 2 giây ở nhãn vẫn là "Đã lưu cục bộ".
5. Bấm F5. Dừng 3 giây ở bài làm còn nguyên số câu đã chọn.
6. Chuyển Network về Online. Dừng 3 giây ở nhãn "Đang lưu bài làm..." rồi "Đã lưu bài làm lúc ...".
7. Cuộn chậm xuống khu vực nộp bài và bảng xếp hạng bên phải.

Nếu F5 khi offline cho trang trắng, bỏ bước 5 và làm thay thế: Offline, chọn thêm 2 câu, Online, hiện đồng bộ, sau đó F5 khi online để chứng minh khôi phục bài làm.

### S8. Nộp bài (30 giây)

1. Ở cuối trang, chờ widget "Xác thực chống bot khi nộp bài" chuyển "Đã xác thực người thật".
2. Bấm "Nộp bài". Không bấm hai lần.
3. Dừng 4 giây ở màn hình "Nộp bài thi thành công" có điểm, số câu đúng, thời gian nộp.
4. Chỉ bảng xếp hạng bên phải: hạng của Trần Đức Mạnh.

### S9. Giảng viên xem bảng điểm (20 giây)

1. Quay lại cửa sổ giảng viên, tab "Ca thi".
2. Trên thẻ ca thi vừa dùng, bấm "Bảng điểm".
3. Dừng 4 giây ở modal "Bảng điểm chi tiết & Phân tích kết quả": điểm, số câu đúng, thời gian nộp.

### S10. AWS Console (50 giây)

1. SQS, danh sách queues: mở `cloudexam-exam-submission-queue-dev`, tab Monitoring. Chỉ các chỉ số Messages Available, In Flight, Deleted và Age of Oldest Message.
2. Mở `cloudexam-exam-submission-dlq-dev`. Dừng 3 giây ở số message bằng 0 và Redrive policy maxReceiveCount 3.
3. Step Functions, `cloudexam-exam-lifecycle-v2-dev`, tab Executions. Mở execution mới nhất. Dừng 4 giây ở timeline có bước chờ và bước tự động kết thúc, trạng thái Succeeded.
4. CloudWatch Alarms. Dừng 4 giây ở danh sách 4 alarm trạng thái OK.

Không cần mở Logs Insights nếu không có sẵn query. Dùng ảnh `docs/evidence/console_logs_insights_53_batches.png` ở S11.

### S11. Ảnh bằng chứng, tùy chọn (40 giây)

Mỗi ảnh hiển thị toàn khung 6–8 giây, không zoom, không pan:

1. `docs/evidence/hinh-3.1-locust-500vu.png`
2. `docs/evidence/console_logs_insights_53_batches.png`
3. `docs/evidence/hinh-3.4-far-frr.png`
4. `docs/evidence/hinh-3.6-waf-sqs.png` — ghi rõ trên hình: WAF mô phỏng, môi trường dev đang tắt WAF
5. `docs/evidence/console_cost_explorer.png`

Không chiếu số $2.35 cho 5.000 thí sinh như số liệu AWS Console; đó là ước tính, nếu dùng thì ghi "ước tính".

## 5. Quy tắc khi quay

- Sau mỗi thao tác, dừng 1–2 giây để kết quả kịp hiện.
- Di chuột chậm, không lắc, không vẽ vòng tròn.
- Không cuộn trang khi đang có kết quả quan trọng cần đọc.
- Không mở DevTools ở cảnh khác ngoài S7.
- Không để lộ token, khóa API, email cá nhân ngoài tài khoản demo.
- Mỗi cảnh quay 2 lần nếu thao tác lỗi. Không cắt ghép trong lúc quay.

## 6. Dựng hậu kỳ

- Chỉ cắt, ghép theo đúng thứ tự S1–S11. Không zoom kỹ thuật số, không pan ảnh tĩnh.
- Không chèn voiceover, không chèn nhạc. Giữ video im lặng.
- Có thể chèn chữ ngắn ở góc dưới nếu cần: "Bóc tách đề Word", "Điểm danh khuôn mặt", "Local-First", "Nộp bài qua SQS", "AWS Console".
- Xuất H.264, 1080p, audio 48 kHz hoặc bỏ hẳn track audio.

## 7. Sự cố và dự phòng

| Tình huống | Xử lý |
|---|---|
| Ca EX-MWGR9M4W đã hết hạn | Dùng cảnh S4 tạo ca mới, đặt giờ bắt đầu hiện tại, kết thúc cộng 45 phút, bấm "Bắt đầu" |
| Thí sinh bị chặn do khóa thiết bị | Giám thị vào Bàn Giám thị, bấm "Mở khóa máy" cho Trần Đức Mạnh |
| Xác thực khuôn mặt dưới 80% | Tăng ánh sáng phía trước, bỏ kính, tắt Mirror Mode nếu ảnh bị ngược, chụp lại |
| Turnstile không hiện | Tải lại trang, kiểm tra mạng, chờ widget xác thực xong rồi mới bấm "Nộp bài" |
| F5 khi offline bị trang trắng | Dùng phương án thay thế ở S7: offline, trả lời, online, đồng bộ, F5 khi online |
| Nộp bài xong chưa thấy điểm | Chờ 3–5 giây để worker chấm, tải lại trang hoặc xem Bảng điểm ở cửa sổ giảng viên |
| Quên mã phòng ca mới | Xem trên thẻ ca thi ở tab Ca thi, mục "Mật khẩu phòng thi" |
