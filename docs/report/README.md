# THƯ MỤC BÁO CÁO TỔNG KẾT & MINH CHỨNG ĐỒ ÁN (DOCS / REPORT)

Thư mục này chứa toàn bộ tài liệu báo cáo tổng kết, sơ đồ kiến trúc hệ thống và hình ảnh bằng chứng nghiệm thu thực tế của dự án **CloudExam (Hệ thống Khảo thí Trực tuyến Không máy chủ Thế hệ mới)**.

---

## 1. TÀI LIỆU BÁO CÁO CHÍNH

- 📄 **[BÁO CÁO TỔNG KẾT ĐỒ ÁN CHI TIẾT (REPORT.md)](REPORT.md)**:  
  Báo cáo khoa học & kỹ thuật toàn diện gồm 5 chương:
  - **Chương 1:** Đặt vấn đề, bối cảnh và 5 bài toán cốt lõi của khảo thí trực tuyến.
  - **Chương 2:** Thiết kế kiến trúc hệ thống (Kiến trúc tính năng tổng thể, 3 cổng RBAC độc lập, kiến trúc mạng VPC PrivateLink, CSDL 5 bảng DynamoDB On-Demand, SQS/DLQ, Step Functions Lifecycle v2, Vệ tinh Đa Đám Mây).
  - **Chương 3:** Hiện thực hóa & Kết quả đo đạc thực nghiệm (Số hóa đề thi Word/Gemini fallback, Điểm danh AI Rekognition FAR/FRR theo ISO/IEC 19795, Chống sập nộp bài Locust 500 VUs, Local-First 0ms & khôi phục F5, Bảng xếp hạng Upstash Redis, Khóa thiết bị & Turnstile chống bot, Tự động hóa Step Functions & Báo cáo SNS).
  - **Chương 4:** Quản trị tài chính đám mây FinOps (Mục tiêu 0.00 USD Free Tier, AWS Budgets $0.50, S3 Lifecycle, Cost Explorer thực tế, phân tích TCO).
  - **Chương 5:** Đánh giá an ninh & Zero-Trust (AWS WAFv2, PoLP IAM, OAC, Che giấu đáp án chống F12, Mã hóa Rest/Transit).

---

## 2. DANH MỤC HÌNH ẢNH MINH CHỨNG NGHIỆM THU

Toàn bộ 27 hình ảnh trong thư mục này được trích xuất và liên kết trực tiếp trong báo cáo `REPORT.md`:

| Tên Tệp | Nhãn Hình Trong Báo Cáo | Nội Dung & Ý Nghĩa Minh Chứng Kỹ Thuật |
| :--- | :--- | :--- |
| [`image1.png`](image1.png) | **Hình 2.2a** | Phân hệ cổng biên và điều hướng tên miền đa quốc gia. |
| [`image2.png`](image2.png) | **Hình 2.2b** | Luồng xác thực Cognito User Pool PKCE và phân quyền RBAC 3 vai trò (Organizer, Proctor, Candidate). |
| [`image3.png`](image3.png) | **Hình 2.3a** | Luồng bóc tách đề thi Word bằng Google Gemini 1.5 Flash AI và Local Regex NLP Fallback. |
| [`image4.png`](image4.png) | **Hình 2.3b** | Cấp S3 Presigned URL (SigV4 TTL 300s) tải ảnh trực tiếp Direct-to-Storage lên S3. |
| [`image5.png`](image5.png) | **Hình 2.6** | Sơ đồ kiến trúc triển khai hạ tầng vật lý AWS tại Region Singapore (`ap-southeast-1`). |
| [`image6.png`](image6.png) | **Hình 2.5a** | Trải nghiệm phòng thi Local-First (0ms lag) và cơ chế đồng bộ nền điều tiết Throttled Cloud Sync. |
| [`image7.png`](image7.png) | **Hình 2.5b** | Đường ống đệm nộp bài Amazon SQS (< 50ms) và Lambda Grading Worker chấm lô Batch 10. |
| [`image8.png`](image8.png) | **Hình 2.5c** | Cập nhật điểm số thời gian thực lên Upstash Serverless Redis và cơ chế bảo toàn dữ liệu DLQ. |
| [`image9.png`](image9.png) | **Hình 3.1** | Màn hình kết quả kiểm thử tải 500 Virtual Users dồn dập nộp bài qua Locust (P99 = 42.47ms, 100% OK). |
| [`image10.png`](image10.png) | **Hình 3.2a** | Biểu đồ giám sát hàng đợi Amazon SQS trên AWS Console (Messages Available / In Flight). |
| [`image11.png`](image11.png) | **Hình 3.2b** | Giám sát hàng đợi lỗi Dead-Letter Queue (DLQ) duy trì số lượng 0 message (0% mất bài). |
| [`image12.png`](image12.png) | **Hình 2.4a** | Luồng đối soát khuôn mặt sinh trắc học 1:1 qua Amazon Rekognition CompareFaces (ngưỡng $\ge 80\%$). |
| [`image13.png`](image13.png) | **Hình 3.3** | Đỉnh xung tải (Spike) khi tiếp nhận 500 bài thi và tốc độ tiêu thụ sạch SQS trong 2.25 giây của Worker. |
| [`image14.png`](image14.png) | **Hình 2.4c** | Tải ảnh thẻ gốc thí sinh từ S3 Media Bucket phục vụ đối soát khuôn mặt. |
| [`image15.png`](image15.png) | **Hình 2.4b** | Chi tiết quy trình kiểm tra điều kiện ca thi RUNNING và nạp ảnh thẻ S3. |
| [`image16.png`](image16.png) | **Hình 2.1** | **Sơ đồ kiến trúc tính năng tổng thể (Master Functional Architecture)**. |
| [`image17.png`](image17.png) | **Hình 3.4a** | Ma trận nhầm lẫn (Confusion Matrix) đánh giá độ chính xác Rekognition theo chuẩn ISO/IEC 19795. |
| [`image18.png`](image18.png) | **Hình 3.4b** | Khoảng cách phân tách an toàn (Safety Margin) giữa thí sinh chính chủ và kẻ thi hộ. |
| [`image19.jpg`](image19.jpg) | **Hình 4.1** | Bằng chứng thực tế trên AWS Cost Explorer: Tổng chi phí toàn bộ các tháng phát triển là đúng **0.00 USD**. |
| [`image20.png`](image20.png) | **Hình 4.2** | Hàng rào cảnh báo ngân sách AWS Budgets với ngưỡng kích hoạt 0.50 USD và CloudWatch Alarms. |
| [`image21.png`](image21.png) | **Hình 3.8a** | Cấu trúc đồ thị máy trạng thái AWS Step Functions điều phối vòng đời ca thi (Exam Lifecycle v2). |
| [`image22.png`](image22.png) | **Hình 3.8b** | Chi tiết bước Wait Until End Time trong máy trạng thái Step Functions. |
| [`image23.png`](image23.png) | **Hình 3.8c** | Bước quét bài thi nháp và chấm bù tự động (Auto-Finalize) khi kết thúc ca thi. |
| [`image24.jpg`](image24.jpg) | **Hình 3.7** | Giao diện Bảng xếp hạng trực tiếp Live Leaderboard Upstash Redis trong phòng thi (< 5ms). |
| [`image25.png`](image25.png) | **Hình 3.8d** | Bước tổng hợp phổ điểm và phát hành báo cáo ca thi qua Amazon SNS Topic. |
| [`image26.jpg`](image26.jpg) | **Hình 3.6** | Kiểm thử ngắt mạng và ấn F5 tải lại trang: Khôi phục nguyên vẹn 100% bài làm từ `localStorage` trong 1.2ms. |
| [`image27.jpg`](image27.jpg) | **Hình 3.5** | Giao diện điểm danh khuôn mặt webcam thực tế, độ trùng khớp 89.4% và tự động khóa thiết bị. |

---

## 3. CÁC TÀI LIỆU CHUYÊN ĐỀ KHÁC TRONG DỰ ÁN

- [Báo cáo Kiểm thử Tải Nộp bài Dồn dập (SUBMISSION_STAMPEDE_REPORT.md)](../SUBMISSION_STAMPEDE_REPORT.md)
- [Báo cáo Rà soát An ninh Zero-Trust Toàn diện (SECURITY_AUDIT_REPORT.md)](../SECURITY_AUDIT_REPORT.md)
- [Báo cáo Quản trị Tài chính Đám mây FinOps 0.00 USD (finops_report.md)](../finops_report.md)
- [Đặc tả Thiết kế Cơ sở Dữ liệu NoSQL DynamoDB (DATABASE_DESIGN.md)](../DATABASE_DESIGN.md)
- [Đặc tả Kiến trúc Phân vùng Lưu trữ Amazon S3 (S3_STORAGE_DESIGN.md)](../S3_STORAGE_DESIGN.md)
- [Kịch bản Trình diễn Kỹ thuật & Quay Video Demo (KICH_BAN_QUAY_DEMO.md)](../demo/KICH_BAN_QUAY_DEMO.md)
