import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def build_8_slides_presentation(output_path="docs/CloudExam_Final_Presentation.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Clean, professional, academic color palette
    C_WHITE = RGBColor(255, 255, 255)
    C_BLACK = RGBColor(15, 23, 42)        # Deep Charcoal / Almost Black
    C_TEXT = RGBColor(30, 41, 59)         # Dark slate for body text
    C_MUTED = RGBColor(100, 116, 139)     # Slate for secondary/caption
    C_BLUE = RGBColor(29, 78, 216)        # Royal Blue
    C_BLUE_DARK = RGBColor(30, 58, 138)   # Navy Blue
    C_BG_CARD = RGBColor(248, 250, 252)   # Neutral Off-white
    C_BORDER = RGBColor(226, 232, 240)    # Soft border

    base_img_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "report_images")

    def add_header(slide, title, category="CLOUDEXAM — BÁO CÁO CUỐI KỲ ĐIỆN TOÁN ĐÁM MÂY"):
        # Category
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.3))
        tf_c = cat_box.text_frame
        tf_c.word_wrap = True
        tf_c.margin_left = tf_c.margin_right = tf_c.margin_top = tf_c.margin_bottom = 0
        p_c = tf_c.paragraphs[0]
        p_c.text = category.upper()
        p_c.font.name = "Arial"
        p_c.font.size = Pt(11)
        p_c.font.bold = True
        p_c.font.color.rgb = C_BLUE

        # Main Title (EXACT MATCH to Template)
        t_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.733), Inches(0.65))
        tf_t = t_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_right = tf_t.margin_top = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.name = "Arial"
        p_t.font.size = Pt(28)
        p_t.font.bold = True
        p_t.font.color.rgb = C_BLACK

        # Divider line
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.4), Inches(11.733), Inches(0.015))
        line.fill.solid()
        line.fill.fore_color.rgb = C_BORDER
        line.line.color.rgb = C_BORDER

    def add_notes(slide, text):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = text

    # =========================================================================
    # SLIDE 1: Title Slide
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)

    # University Header
    u_box = s1.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.733), Inches(0.5))
    tf_u = u_box.text_frame
    p_u = tf_u.paragraphs[0]
    p_u.text = "ĐẠI HỌC QUỐC GIA HÀ NỘI — TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)"
    p_u.font.name = "Arial"
    p_u.font.size = Pt(13)
    p_u.font.bold = True
    p_u.font.color.rgb = C_BLUE_DARK

    # Project Title
    t_box = s1.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(11.733), Inches(1.1))
    tf_t = t_box.text_frame
    p_t = tf_t.paragraphs[0]
    p_t.text = "CLOUDEXAM"
    p_t.font.name = "Arial"
    p_t.font.size = Pt(50)
    p_t.font.bold = True
    p_t.font.color.rgb = C_BLACK

    # Subtitle
    sub_box = s1.shapes.add_textbox(Inches(0.8), Inches(2.65), Inches(11.733), Inches(0.6))
    tf_sub = sub_box.text_frame
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = "Nền tảng Khảo thí Trực tuyến Không máy chủ (Serverless Event-Driven) & Đa đám mây"
    p_sub.font.name = "Arial"
    p_sub.font.size = Pt(18)
    p_sub.font.color.rgb = C_BLUE

    # Meta card
    meta = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(3.5), Inches(11.733), Inches(0.95))
    meta.fill.solid()
    meta.fill.fore_color.rgb = C_BG_CARD
    meta.line.color.rgb = C_BORDER
    tf_m = meta.text_frame
    tf_m.margin_left = Inches(0.3)
    p_m1 = tf_m.paragraphs[0]
    p_m1.text = "Học phần: Điện toán đám mây (Mã lớp: 2627I_INT3319_1)  |  Học kỳ I, 2026 - 2027"
    p_m1.font.name = "Arial"
    p_m1.font.size = Pt(13)
    p_m1.font.bold = True
    p_m1.font.color.rgb = C_BLACK
    p_m2 = tf_m.add_paragraph()
    p_m2.text = "Giảng viên hướng dẫn: TS. Hoàng Xuân Tùng"
    p_m2.font.name = "Arial"
    p_m2.font.size = Pt(12)
    p_m2.font.color.rgb = C_MUTED

    # 4 team members
    members = [
        ("Nguyễn Thị Ngọc Hà", "24020115", "Nhóm trưởng", "IaC Terraform & An ninh WAFv2/Cognito"),
        ("Trần Đức Mạnh", "24021561", "Thành viên", "AI Rekognition & SQS Batch Worker"),
        ("Phạm Tuấn Phong", "24021596", "Thành viên", "Frontend Local-First & Test tải Locust"),
        ("Nguyễn Phúc Tấn", "24021620", "Thành viên", "Core API, AI Gemini & Step Functions")
    ]
    mw = Inches(2.75)
    for i, (name, msv, role_title, task) in enumerate(members):
        mx = Inches(0.8) + i * Inches(2.98)
        card = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, mx, Inches(4.8), mw, Inches(2.1))
        card.fill.solid()
        card.fill.fore_color.rgb = C_WHITE
        card.line.color.rgb = C_BORDER
        tf_c = card.text_frame
        tf_c.margin_left = Inches(0.2)
        tf_c.margin_top = Inches(0.18)
        
        p = tf_c.paragraphs[0]
        p.text = name
        p.font.name = "Arial"
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = C_BLACK

        p2 = tf_c.add_paragraph()
        p2.text = f"MSSV: {msv} ({role_title})"
        p2.font.name = "Arial"
        p2.font.size = Pt(10.5)
        p2.font.bold = True
        p2.font.color.rgb = C_BLUE

        p3 = tf_c.add_paragraph()
        p3.text = task
        p3.font.name = "Arial"
        p3.font.size = Pt(9.5)
        p3.font.color.rgb = C_TEXT

    add_notes(s1,
        "Kính thưa Thầy Hoàng Xuân Tùng và các bạn, hôm nay Nhóm 14 xin đại diện trình bày báo cáo cuối kỳ môn Điện toán đám mây. "
        "Đề tài của nhóm em là CloudExam - Nền tảng khảo thí trực tuyến Serverless Event-Driven trên AWS kết hợp Multi-Cloud. "
        "Nhóm chúng em gồm 4 thành viên, em là Ngọc Hà nhóm trưởng phụ trách phần hạ tầng IaC và an ninh mạng."
    )

    # =========================================================================
    # SLIDE 2: Content
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Content")

    agenda = [
        ("1", "Project Overview", "Bối cảnh thực tiễn, 3 bài toán lớn của thi online, đối tượng sử dụng và luồng giải pháp cốt lõi."),
        ("2", "Project Features", "Sơ đồ Use-case tổng thể hệ thống và 5 phân hệ chức năng: Soạn đề AI, Điểm danh, Local-First, SQS, Step Functions."),
        ("3", "Implementation Overview", "Triết lý Serverless Event-Driven, Queue-Based Load Leveling và kiến trúc phân tầng 6 khối Cloud-Native."),
        ("4", "Implementation Details", "Kiến trúc triển khai vật lý AWS Singapore (ap-southeast-1), cơ chế đệm SQS, DynamoDB Sparse GSI và $0 NAT Gateway."),
        ("5", "Project Executions", "Lịch sử phát triển 4 Sprints, phân công trách nhiệm kỹ thuật và bảng đánh giá mức độ đóng góp thành viên."),
        ("6", "Conclusion", "Nghiệm thu kiểm thử tải Locust 500 VUs nộp bài giây cuối, độ chính xác AI Rekognition, kiểm toán FinOps $0 và Q&A.")
    ]

    for i, (num, title, desc) in enumerate(agenda):
        ay = Inches(1.65) + i * Inches(0.9)
        card = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), ay, Inches(11.733), Inches(0.78))
        card.fill.solid()
        card.fill.fore_color.rgb = C_BG_CARD
        card.line.color.rgb = C_BORDER

        tf_a = card.text_frame
        tf_a.margin_left = Inches(0.25)
        tf_a.margin_top = Inches(0.12)
        
        p = tf_a.paragraphs[0]
        p.text = f"{num}. {title}"
        p.font.name = "Arial"
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = C_BLUE_DARK

        run = p.add_run()
        run.text = f"  —  {desc}"
        run.font.bold = False
        run.font.size = Pt(12)
        run.font.color.rgb = C_TEXT

    add_notes(s2,
        "Bài báo cáo của nhóm bám sát đúng lộ trình gồm 6 phần: Đi từ bối cảnh bài toán, sơ đồ tính năng, tổng quan kiến trúc, "
        "chi tiết kỹ thuật giải quyết nghẽn tải, lịch sử làm việc nhóm và kết thúc bằng số liệu nghiệm thu thực tế."
    )

    # =========================================================================
    # SLIDE 3: Project overview
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Project overview")

    po_blocks = [
        ("❖ Introduction", [
            "Hệ thống thi trực tuyến xây dựng hoàn toàn trên Kiến trúc Không máy chủ hướng sự kiện (Serverless Event-Driven Architecture).",
            "Mô hình Đa đám mây lai (Hybrid Multi-Cloud): AWS làm hạ tầng tính toán/lưu trữ hạt nhân, kết hợp Google Gemini AI, Upstash Redis và Cloudflare.",
            "Tự động hóa 100% bằng mã nguồn (IaC Terraform v1.8+) và phân phối qua GitHub Actions CI/CD."
        ]),
        ("❖ Who use it? (3 Nhóm người dùng)", [
            "Thí sinh (Students): Làm bài trắc nghiệm/tự luận với độ trễ phản hồi < 1ms (Local-First), không mất bài khi rớt mạng, xem BXH trực tiếp.",
            "Giảng viên (Instructors): Số hóa đề thi tự động bằng AI từ file Word, quản lý ngân hàng câu hỏi, tạo ca thi, xuất bảng điểm CSV UTF-8 BOM.",
            "Giám thị (Proctors): Kiểm soát phòng thi bằng Passcode 6 số, giám sát danh sách thí sinh đã điểm danh qua đèn xanh thời gian thực."
        ]),
        ("❖ Context and purpose (Where, when, why)", [
            "Bối cảnh (Where/When): Các kỳ thi tập trung quy mô lớn 5.000+ thí sinh đồng thời (thi học kỳ, thi chứng chỉ đại trà).",
            "Mục đích (Why): Khắc phục 3 nhược điểm lớn của hệ thống truyền thống: (1) Tránh sập máy chủ khi nộp bài dồn dập ở giây cuối (Submission Stampede); (2) Chống gian lận thi hộ bằng sinh trắc học; (3) Triệt tiêu chi phí máy chủ ảo EC2 nhàn rỗi ($0 chi phí khi chờ thi)."
        ]),
        ("❖ How (Luồng vận hành cốt lõi)", [
            "Thí sinh điểm danh AI qua webcam (S3 Direct Upload -> Rekognition 1:1) -> Làm bài lưu cục bộ (Local-First 0ms lag) -> Nộp bài đẩy vào hàng đợi Amazon SQS (< 50ms ACK) -> Worker chấm mẻ (Batch 10) -> BXH Redis -> Step Functions tự động đóng ca thi và cứu bài nháp rớt mạng."
        ])
    ]

    for i, (title, items) in enumerate(po_blocks):
        bx = Inches(0.8) if i % 2 == 0 else Inches(6.8)
        by = Inches(1.65) if i < 2 else Inches(4.45)
        bw = Inches(5.7)
        bh = Inches(2.65)

        card = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, bx, by, bw, bh)
        card.fill.solid()
        card.fill.fore_color.rgb = C_BG_CARD
        card.line.color.rgb = C_BORDER

        tf = card.text_frame
        tf.margin_left = tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(0.18)

        p = tf.paragraphs[0]
        p.text = title
        p.font.name = "Arial"
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = C_BLUE_DARK

        for item in items:
            pi = tf.add_paragraph()
            pi.text = f"• {item}"
            pi.font.name = "Arial"
            pi.font.size = Pt(11)
            pi.font.color.rgb = C_TEXT

    add_notes(s3,
        "Ở slide Project overview, nhóm tóm tắt ngắn gọn 4 ý: Giới thiệu hệ thống Serverless không máy chủ; "
        "phục vụ 3 nhóm người dùng gồm thí sinh, giảng viên và giám thị; giải quyết 3 bài toán nhức nhối là nghẽn nộp bài, gian lận và chi phí máy chủ; "
        "và luồng dữ liệu khép kín từ lúc thí sinh điểm danh khuôn mặt đến khi nộp bài qua hàng đợi SQS."
    )

    # =========================================================================
    # SLIDE 4: Project features
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Project features")

    # Left: Diagram 1: System Use-case diagram
    left_box = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.65), Inches(5.6), Inches(5.4))
    left_box.fill.solid()
    left_box.fill.fore_color.rgb = C_BG_CARD
    left_box.line.color.rgb = C_BORDER

    tf_l = left_box.text_frame
    tf_l.margin_left = tf_l.margin_right = tf_l.margin_top = Inches(0.25)
    p = tf_l.paragraphs[0]
    p.text = "❖ Diagram 1: System Use-case diagram"
    p.font.name = "Arial"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    uc_groups = [
        ("Tác tử Thí sinh (Candidate):", [
            "Đăng ký / Đăng nhập OTP In-App & Cognito Hosted UI",
            "Điểm danh AI Rekognition 1:1 qua Webcam (Mirror Mode)",
            "Làm bài thi Local-First 0ms lag & Đồng bộ nháp định kỳ",
            "Nộp bài giải mã Turnstile token qua hàng đợi SQS",
            "Theo dõi thứ hạng trên Bảng xếp hạng Live Leaderboard"
        ]),
        ("Tác tử Giảng viên (Instructor):", [
            "Số hóa đề thi tự động bằng AI Gemini & Regex Fallback 0.05s",
            "Quản lý ngân hàng câu hỏi & Xóa tầng (Cascade Delete)",
            "Tạo ca thi, sinh Passcode 6 số và phân quyền thí sinh",
            "Xem thống kê KPI lớp học & Xuất bảng điểm CSV UTF-8 BOM"
        ]),
        ("Tác tử Giám thị & Hệ thống (Proctor & Step Functions):", [
            "Giám sát phòng thi thời gian thực, khóa cứng thiết bị",
            "Step Functions: Tự động hóa đóng/mở ca thi ($0 Compute)",
            "Auto-Finalize: Tự động thu hồi và chấm bù bài nháp rớt mạng"
        ])
    ]
    for grp_t, grp_items in uc_groups:
        pg = tf_l.add_paragraph()
        pg.text = grp_t
        pg.font.name = "Arial"
        pg.font.size = Pt(11.5)
        pg.font.bold = True
        pg.font.color.rgb = C_BLACK

        for it in grp_items:
            pi = tf_l.add_paragraph()
            pi.text = f"  ➢ {it}"
            pi.font.name = "Arial"
            pi.font.size = Pt(10)
            pi.font.color.rgb = C_TEXT

    # Right: Explain in details
    right_box = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.8), Inches(1.65), Inches(5.733), Inches(5.4))
    right_box.fill.solid()
    right_box.fill.fore_color.rgb = C_WHITE
    right_box.line.color.rgb = C_BORDER

    tf_r = right_box.text_frame
    tf_r.margin_left = tf_r.margin_right = tf_r.margin_top = Inches(0.25)
    p = tf_r.paragraphs[0]
    p.text = "❖ Explain in details (5 Tính năng cốt lõi)"
    p.font.name = "Arial"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    features_detail = [
        ("1. Số hóa đề thi bằng AI & Tải ảnh trực tiếp S3",
         "Giảng viên tải tệp Word (.docx) hoặc dán văn bản thô; Google Gemini 1.5 Flash tự động bóc tách thành cấu trúc JSON trong 2s. Nếu mất mạng, hệ thống chuyển sang bộ Regex NLP Fallback chạy offline trong 0.05s. Ảnh sơ đồ câu hỏi tải thẳng lên S3 qua Presigned URL (0MB qua backend)."),
        ("2. Điểm danh AI Rekognition & Khóa thiết bị",
         "Ảnh webcam tải trực tiếp lên S3 qua Presigned URL (TTL 60s). Amazon Rekognition CompareFaces đối soát 1:1 với ảnh thẻ gốc (Similarity >= 80%). Cơ chế Mutex lockedCandidates khóa cứng tài khoản vào thiết bị, chống thi hộ 99.9%."),
        ("3. Phòng thi Local-First & Đồng bộ nháp Throttled",
         "Mọi thao tác chọn đáp án được lưu tức thì vào localStorage (< 1ms). Cơ chế Throttled 60s/10 câu giảm hơn 90% tải ghi DynamoDB. Backend lọc sạch đáp án đúng chống gian lận qua F12."),
        ("4. Đệm tải nộp bài SQS & Chấm điểm theo lô",
         "Thí sinh bấm nộp bài nhận phản hồi thành công trong < 50ms nhờ hàng đợi Amazon SQS. Lambda Worker rút mẻ Batch 10 gọi 1 lệnh BatchGetItem chấm tự động và cập nhật Live Leaderboard Redis (< 5ms)."),
        ("5. Tự động hóa Vòng đời ca thi & Auto-Finalize",
         "AWS Step Functions Wait State ($0 Compute) chuyển ca thi SCHEDULED -> RUNNING -> CLOSED. Khi hết giờ, hệ thống tự động cứu bài nháp cho thí sinh rớt mạng chấm bù; gửi email tổng kết qua SNS.")
    ]

    for f_title, f_desc in features_detail:
        pf1 = tf_r.add_paragraph()
        pf1.text = f_title
        pf1.font.name = "Arial"
        pf1.font.size = Pt(11)
        pf1.font.bold = True
        pf1.font.color.rgb = C_BLACK

        pf2 = tf_r.add_paragraph()
        pf2.text = f_desc
        pf2.font.name = "Arial"
        pf2.font.size = Pt(9.5)
        pf2.font.color.rgb = C_TEXT

    add_notes(s4,
        "Ở Slide 4, bên trái là sơ đồ Use-case phân nhóm theo 3 tác tử người dùng và cỗ máy Step Functions. "
        "Bên phải là 5 tính năng kỹ thuật nổi bật nhất: Số hóa đề bằng AI, điểm danh khuôn mặt 1:1, "
        "phòng thi Local-First không giật lag, đệm tải nộp bài bằng hàng đợi SQS và thuật toán tự cứu bài nháp Auto-Finalize."
    )

    # =========================================================================
    # SLIDE 5: Implementation overview
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Implementation overview")

    # Top Card: 3 Principles
    top_c = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.65), Inches(11.733), Inches(1.3))
    top_c.fill.solid()
    top_c.fill.fore_color.rgb = C_BG_CARD
    top_c.line.color.rgb = C_BORDER
    tf_tc = top_c.text_frame
    tf_tc.margin_left = tf_tc.margin_right = tf_tc.margin_top = Inches(0.2)
    p = tf_tc.paragraphs[0]
    p.text = "❖ Triết lý Thiết kế Kiến trúc Đám mây (AWS Well-Architected Framework)"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p1 = tf_tc.add_paragraph()
    p1.text = "• 100% Serverless Event-Driven: Loại bỏ hoàn toàn máy chủ vật lý hay EC2. Hệ thống tự động co giãn từ 0 đến hàng ngàn người dùng, thanh toán theo mili-giây thực thi (Zero Idle Cost)."
    p1.font.name = "Arial"
    p1.font.size = Pt(10.5)
    p1.font.color.rgb = C_TEXT

    p2 = tf_tc.add_paragraph()
    p2.text = "• Queue-Based Load Leveling: Tách rời tuyệt đối tầng tiếp nhận bài nộp (Ingress) và tầng chấm điểm nặng (Grading) thông qua hàng đợi Amazon SQS, loại bỏ nguy cơ cạn kiệt Connection Pool CSDL."
    p2.font.name = "Arial"
    p2.font.size = Pt(10.5)
    p2.font.color.rgb = C_TEXT

    p3 = tf_tc.add_paragraph()
    p3.text = "• Hybrid Multi-Cloud Satellites: Khai thác sức mạnh chuyên sâu của từng nhà cung cấp: AWS làm hạt nhân tính toán/lưu trữ, Google AI Studio bóc tách đề, Upstash Redis cập nhật BXH < 5ms."
    p3.font.name = "Arial"
    p3.font.size = Pt(10.5)
    p3.font.color.rgb = C_TEXT

    # Bottom Grid: 6 Tiers
    tiers = [
        ("TẦNG 1: BIÊN & PHÂN PHỐI", "Edge & Delivery Plane", [
            "Route 53 Anycast DNS",
            "CloudFront CDN (TLS 1.3)",
            "CloudFront Functions (x-tenant-id)",
            "Cloudflare Turnstile Anti-bot"
        ]),
        ("TẦNG 2: AN NINH & ĐỊNH DANH", "Security & Identity Plane", [
            "AWS WAFv2 (Rate-limit 2000)",
            "Amazon Cognito User Pool",
            "OAuth 2.0 PKCE & In-App OTP",
            "Amazon Rekognition 1:1"
        ]),
        ("TẦNG 3: TÍNH TOÁN SERVERLESS", "Compute Plane (ARM64)", [
            "API Gateway Regional REST",
            "3 Lambda Graviton2 (Python 3.12)",
            "Core API, Face Verify, Grading",
            "Direct Serverless Outbound"
        ]),
        ("TẦNG 4: HÀNG ĐỢI ĐỆM TẢI", "Async Buffer & Messaging", [
            "Amazon SQS Standard Queue",
            "SQS Dead-Letter Queue (DLQ)",
            "Batch Size = 10, Batch Window = 2s",
            "Redrive Policy (maxReceiveCount=3)"
        ]),
        ("TẦNG 5: CSDL & BỘ NHỚ ĐỆM", "Data & Cache Plane", [
            "DynamoDB On-Demand 5 bảng",
            "Sparse GSI SessionResultsIndex",
            "S3 Hosting (OAC) & Media 60s",
            "Upstash Redis Sorted Set (ZADD)"
        ]),
        ("TẦNG 6: ĐIỀU PHỐI & FINOPS", "Orchestration & FinOps", [
            "AWS Step Functions (Wait State $0)",
            "AutoFinalizeTask cứu bài tồn",
            "Amazon SNS Topic Email Alerts",
            "AWS Budgets Cảnh báo Chi phí"
        ])
    ]

    tw = Inches(3.75)
    th = Inches(1.85)
    for i, (t_name, t_sub, t_items) in enumerate(tiers):
        r = i // 3
        c = i % 3
        tx = Inches(0.8) + c * Inches(3.98)
        ty = Inches(3.1) + r * Inches(2.0)

        t_box = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, tx, ty, tw, th)
        t_box.fill.solid()
        t_box.fill.fore_color.rgb = C_WHITE
        t_box.line.color.rgb = C_BORDER

        tf_t = t_box.text_frame
        tf_t.margin_left = tf_t.margin_right = Inches(0.2)
        tf_t.margin_top = Inches(0.12)

        p = tf_t.paragraphs[0]
        p.text = t_name
        p.font.name = "Arial"
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_BLUE_DARK

        p_sub = tf_t.add_paragraph()
        p_sub.text = t_sub
        p_sub.font.name = "Arial"
        p_sub.font.size = Pt(9.5)
        p_sub.font.color.rgb = C_MUTED

        for it in t_items:
            pi = tf_t.add_paragraph()
            pi.text = f"• {it}"
            pi.font.name = "Arial"
            pi.font.size = Pt(9)
            pi.font.color.rgb = C_TEXT

    add_notes(s5,
        "Slide 5 trình bày tổng quan giải pháp kiến trúc: Hệ thống được tổ chức thành 6 tầng công nghệ rành mạch. "
        "Ba nguyên tắc thiết kế quan trọng nhất là: 100% Serverless không tốn chi phí tĩnh; "
        "dùng hàng đợi SQS để san phẳng xung lực nộp bài; và kết hợp các vệ tinh Đa đám mây để tận dụng các gói Free Tier chất lượng cao."
    )

    # =========================================================================
    # SLIDE 6: Implementation details
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Implementation details")

    # Left: Diagram 2: Deployment Architecture Image
    img5_path = os.path.join(base_img_dir, "image5.png")
    if os.path.exists(img5_path):
        s6.shapes.add_picture(img5_path, Inches(0.8), Inches(1.65), Inches(5.6), Inches(3.4))

    # Mini evidence below Diagram 2: Locust result & SQS graph
    img9_path = os.path.join(base_img_dir, "image9.png")
    if os.path.exists(img9_path):
        s6.shapes.add_picture(img9_path, Inches(0.8), Inches(5.15), Inches(2.75), Inches(1.9))
    img13_path = os.path.join(base_img_dir, "image13.png")
    if os.path.exists(img13_path):
        s6.shapes.add_picture(img13_path, Inches(3.65), Inches(5.15), Inches(2.75), Inches(1.9))

    # Right: Core information (Chức năng, Công việc, Kỹ thuật)
    right_c = s6.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.8), Inches(1.65), Inches(5.733), Inches(5.4))
    right_c.fill.solid()
    right_c.fill.fore_color.rgb = C_BG_CARD
    right_c.line.color.rgb = C_BORDER

    tf_rc = right_c.text_frame
    tf_rc.margin_left = tf_rc.margin_right = tf_rc.margin_top = Inches(0.25)
    p = tf_rc.paragraphs[0]
    p.text = "❖ Core information & Giải pháp Kỹ thuật"
    p.font.name = "Arial"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    sec_details = [
        ("➢ Chức năng của từng thành phần:", [
            "CloudFront CDN + WAFv2: Phục vụ SPA tĩnh (< 20ms), tiêm tenant header, Rate-limit 2.000 req/5m.",
            "Lambda Ingestion & SQS: Tiếp nhận bài nộp, đẩy vào SQS trong < 50ms giải phóng kết nối tức thì.",
            "Lambda Grading Worker: Rút mẻ 10 bài, gọi dynamodb:BatchGetItem lấy đáp án 1 lần, ghi điểm và cập nhật Redis.",
            "DynamoDB Sparse GSI: Chỉ đánh chỉ mục bài đã có score, cho phép truy vấn BXH ca thi < 10ms không cần Scan."
        ]),
        ("➢ Công việc đã thực hiện để triển khai:", [
            "100% IaC Terraform: Cấp phát tự động 34 tài nguyên AWS tại vùng Singapore (ap-southeast-1).",
            "Mô hình Serverless Direct Outbound: Chạy Non-VPC gọi Gemini, Upstash và Turnstile với $0 phí NAT Gateway.",
            "Direct-to-Storage: S3 Presigned URL tải ảnh webcam thẳng lên S3, giảm tải 100% băng thông qua backend."
        ]),
        ("➢ Kỹ thuật giải quyết nghẽn cổ chai (Làm như nào?):", [
            "Khắc phục Hot Partition 1.000 WCU: Phân tán bài nháp vào từng bản ghi riêng trên SubmissionsTable kết hợp Client Throttle (60s/10 câu) giảm 90% tải ghi.",
            "Khóa thiết bị Mutex: Ghi lockedCandidates[MSSV] = deviceToken, chặn tuyệt đối đăng nhập 2 máy cùng lúc."
        ])
    ]

    for st, s_items in sec_details:
        ps = tf_rc.add_paragraph()
        ps.text = st
        ps.font.name = "Arial"
        ps.font.size = Pt(11)
        ps.font.bold = True
        ps.font.color.rgb = C_BLACK

        for it in s_items:
            pi = tf_rc.add_paragraph()
            pi.text = f"• {it}"
            pi.font.name = "Arial"
            pi.font.size = Pt(9.5)
            pi.font.color.rgb = C_TEXT

    add_notes(s6,
        "Đây là slide quan trọng nhất về mặt kỹ thuật triển khai. Hình ảnh bên trái là Sơ đồ kiến trúc vật lý trên AWS Singapore "
        "kèm minh chứng kết quả đo tải thực tế: Locust đạt P99 dưới 36ms và đồ thị CloudWatch SQS hấp thụ đỉnh nhọn. "
        "Bên phải nêu rõ 3 nội dung Thầy yêu cầu: Chức năng từng con serverless, các công việc IaC đã làm và cách nhóm giải quyết nghẽn Hot Partition."
    )

    # =========================================================================
    # SLIDE 7: Project executions
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Project executions")

    # History summary
    h_box = s7.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.65), Inches(11.733), Inches(1.15))
    h_box.fill.solid()
    h_box.fill.fore_color.rgb = C_BG_CARD
    h_box.line.color.rgb = C_BORDER
    tf_h = h_box.text_frame
    tf_h.margin_left = tf_h.margin_right = tf_h.margin_top = Inches(0.2)
    p = tf_h.paragraphs[0]
    p.text = "❖ Briefing history of project development (4 Sprints: 07/10 – 15/11/2026)"
    p.font.name = "Arial"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p_hs = tf_h.add_paragraph()
    p_hs.text = (
        "• Sprint 1 (07/10 - 13/10): Khởi tạo kiến trúc Serverless, cấp phát Terraform S3 State & DynamoDB Lock, 5 bảng DynamoDB On-Demand, nộp Progress Report 1.\n"
        "• Sprint 2 (18/10 - 28/10): Phát triển cụm Lambda ARM64 Python 3.12, tích hợp Cognito OAuth 2.0 PKCE, phòng thi Local-First, đệm SQS.\n"
        "• Sprint 3 (24/10 - 02/11): Tích hợp AI Gemini Flash & Regex Fallback, Rekognition 1:1, Upstash Redis Leaderboard, Step Functions ca thi, nộp Progress Report 2.\n"
        "• Sprint 4 (02/11 - 15/11): Kiểm thử tải Locust 500 VUs, kiểm toán an ninh WAFv2/DLQ, tối ưu FinOps $0 AWS Cost Explorer, đóng gói Final Report & Video."
    )
    p_hs.font.name = "Arial"
    p_hs.font.size = Pt(9.5)
    p_hs.font.color.rgb = C_TEXT

    # Table of contributions
    p_t_lbl = s7.shapes.add_textbox(Inches(0.8), Inches(2.9), Inches(11.733), Inches(0.35))
    tf_lbl = p_t_lbl.text_frame
    p = tf_lbl.paragraphs[0]
    p.text = "❖ Summarize in table: Team members, tasks and evaluation of contributions (Đồng thuận 100%)"
    p.font.name = "Arial"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    tbl_shape = s7.shapes.add_table(5, 4, Inches(0.8), Inches(3.3), Inches(11.733), Inches(3.7))
    tbl = tbl_shape.table
    tbl.columns[0].width = Inches(2.3)
    tbl.columns[1].width = Inches(4.4)
    tbl.columns[2].width = Inches(3.8)
    tbl.columns[3].width = Inches(1.233)

    hdrs = ["Thành viên & MSSV", "Trách nhiệm Kỹ thuật (Mã nguồn & Hạ tầng)", "Nội dung Viết Báo cáo", "Tỷ lệ đóng góp"]
    for c_i, h in enumerate(hdrs):
        cell = tbl.cell(0, c_i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_BLUE_DARK
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.name = "Arial"
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = C_WHITE
        p.alignment = PP_ALIGN.CENTER if c_i == 3 else PP_ALIGN.LEFT

    t_data = [
        ("Nguyễn Thị Ngọc Hà\n(Nhóm trưởng)\nMSV: 24020115",
         "• Cấp phát 34 tài nguyên AWS qua Terraform IaC, Remote State S3/Lock\n• Cấu hình Cognito User Pool, WAFv2 Web ACL, Route 53, CloudFront OAC\n• Thiết lập CloudWatch Alarms, AWS Budgets; Quay & Dựng Video Demo AWS",
         "• Viết: Bối cảnh, Kiến trúc Serverless Hub-and-Spoke, Hạ tầng Terraform IaC, An ninh WAFv2/Cognito và Báo cáo FinOps (Report 1, 2, 3)\n• Tiếp nhận, chuẩn hóa văn phong và nộp bài đúng hạn",
         "26.3%"),
        ("Trần Đức Mạnh\nMSV: 24021561",
         "• Lập trình vi dịch vụ face_verify_handler.py tích hợp Rekognition 1:1\n• Cấu hình hàng đợi đệm Amazon SQS và Dead-Letter Queue (DLQ)\n• Lập trình grading_worker.py chấm lô Batch 10 & Upstash Redis BXH\n• Thiết kế bộ Slide thuyết trình Google Slides",
         "• Viết: Phân hệ điểm danh AI Rekognition, Ma trận nhầm lẫn (ISO/IEC 19795), Cơ chế đệm tải SQS/DLQ, Chấm lô và BXH Real-time\n• Viết script đo đạc rekognition_accuracy_test.py, waf_sqs_test.py",
         "24.6%"),
        ("Phạm Tuấn Phong\nMSV: 24021596",
         "• Phát triển ứng dụng Frontend React 19 SPA (Vite, Tailwind CSS)\n• Hiện thực hóa kiến trúc Local-First (localStorage <1ms) và Throttled 60s\n• Xây dựng bộ lọc Anti-F12 Sanitizer & khiên Cloudflare Turnstile\n• Lập trình CloudFront Functions định tuyến đa ngôn ngữ tại biên",
         "• Viết: Thiết kế UI React 19 SPA, Cơ chế phòng thi Local-First bảo toàn dữ liệu, Giảm 90% WCU và Báo cáo kiểm thử tải Locust 500 VUs\n• Thực thi kịch bản kiểm thử tải tests/locustfile.py",
         "24.6%"),
        ("Nguyễn Phúc Tấn\nMSV: 24021620",
         "• Phát triển vi dịch vụ api_handler.py (CRUD Ngân hàng đề, Ca thi, RBAC)\n• Tích hợp Google Gemini 1.5 Flash API kèm Regex NLP Fallback Engine\n• Cấu hình cỗ máy trạng thái Step Functions (exam_lifecycle), AutoFinalize\n• Lập trình xuất bảng điểm CSV UTF-8 BOM",
         "• Viết: Thiết kế CSDL NoSQL Amazon DynamoDB (5 bảng, chiến lược khóa và Sparse GSI), Số hóa đề thi AI Gemini, Regex Fallback và Step Functions\n• Xây dựng bộ script nạp dữ liệu mẫu ban đầu (seed_all.py)",
         "24.5%")
    ]

    for r_i, r_data in enumerate(t_data, start=1):
        bg = C_BG_CARD if r_i % 2 == 1 else C_WHITE
        for c_i, val in enumerate(r_data):
            cell = tbl.cell(r_i, c_i)
            cell.fill.solid()
            cell.fill.fore_color.rgb = bg
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.name = "Arial"
            p.font.size = Pt(8.5)
            p.font.color.rgb = C_BLACK
            if c_i == 3:
                p.font.bold = True
                p.alignment = PP_ALIGN.CENTER
                p.font.color.rgb = C_BLUE_DARK

    add_notes(s7,
        "Ở Slide 7, nhóm trình bày tiến độ 4 Sprint làm việc nghiêm túc từ đầu tháng 10 đến ngày 15/11 với hơn 200 lượt commit Git. "
        "Bảng bên dưới phân công rõ ràng trách nhiệm code và viết báo cáo của 4 thành viên. "
        "Mức độ đóng góp được cả 4 bạn đồng thuận 100% trong phiên họp nghiệm thu ngày 14/11."
    )

    # =========================================================================
    # SLIDE 8: Conclusion
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Conclusion")

    # Left: Key Achievements & SLA Verification
    left_res = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.65), Inches(5.6), Inches(4.1))
    left_res.fill.solid()
    left_res.fill.fore_color.rgb = C_BG_CARD
    left_res.line.color.rgb = C_BORDER
    tf_lr = left_res.text_frame
    tf_lr.margin_left = tf_lr.margin_right = tf_lr.margin_top = Inches(0.25)
    p = tf_lr.paragraphs[0]
    p.text = "❖ Kết quả Đo đạc Kỹ thuật & Nghiệm thu SLA"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    achievements = [
        ("Xử lý Bão nộp bài giây cuối (Locust 500 VUs):", 
         "Tiếp nhận thành công 500/500 bài nộp (100.00% HTTP 200 OK); P99 Latency = 35.96 ms (vượt xa chuẩn SLA < 50ms); 0 bài rơi vào DLQ."),
        ("Độ chính xác AI Rekognition (ISO/IEC 19795):", 
         "Tỷ lệ chấp nhận sai FAR = 0.00% (chặn đứng 100% thi hộ); Tỷ lệ từ chối sai FRR = 0.00% tại ngưỡng tối ưu SimilarityThreshold = 80.0%."),
        ("Bảo toàn dữ liệu tuyệt đối (Crash-Resilience):", 
         "Local-First khôi phục 100% bài làm sau 1.2 ms khi mất điện/rớt mạng; cơ chế Auto-Finalize tự động cứu bài thi nháp cho thí sinh."),
        ("Quản trị Chi phí Đám mây (FinOps by Design):", 
         "Chi phí nhàn rỗi đúng 0.00 USD/tháng; chi phí thực tế cho kỳ thi 5.000 thí sinh chỉ ~2.35 USD (~12 VNĐ / thí sinh, tiết kiệm >98%).")
    ]
    for ta, da in achievements:
        pa1 = tf_lr.add_paragraph()
        pa1.text = f"• {ta}"
        pa1.font.name = "Arial"
        pa1.font.size = Pt(10)
        pa1.font.bold = True
        pa1.font.color.rgb = C_BLACK

        pa2 = tf_lr.add_paragraph()
        pa2.text = da
        pa2.font.name = "Arial"
        pa2.font.size = Pt(9)
        pa2.font.color.rgb = C_TEXT

    # Right: Limitations & Future Roadmap
    right_res = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.8), Inches(1.65), Inches(5.733), Inches(4.1))
    right_res.fill.solid()
    right_res.fill.fore_color.rgb = C_WHITE
    right_res.line.color.rgb = C_BORDER
    tf_rr = right_res.text_frame
    tf_rr.margin_left = tf_rr.margin_right = tf_rr.margin_top = Inches(0.25)
    p = tf_rr.paragraphs[0]
    p.text = "❖ Limitations & Future Roadmap"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLACK

    roadmaps = [
        ("Hạn chế hiện tại của hệ thống:", 
         "Điểm danh Rekognition phụ thuộc chất lượng webcam và ánh sáng thí sinh; mô hình bóc tách AI Gemini phụ thuộc kết nối mạng ra ngoài (cần duy trì bộ Regex Fallback)."),
        ("Tích hợp AI Giám thị thông minh (Proctored AI):", 
         "Mở rộng mô hình nhận diện tư thế đầu (Head-Pose Estimation) và theo dõi hướng nhìn mắt (Eye-Tracking) theo luồng WebRTC để phát hiện gian lận tự động."),
        ("Thi thích ứng thông minh (Computer Adaptive Testing - CAT):", 
         "Tự động điều chỉnh độ khó của câu hỏi tiếp theo dựa trên năng lực trả lời thực tế của thí sinh thông qua mô hình lý thuyết đáp ứng câu hỏi (IRT)."),
        ("Kiến trúc Đa vùng Chủ động (Multi-Region Active-Active DR):", 
         "Mở rộng hệ thống dự phòng thảm họa giữa Singapore (ap-southeast-1) và Jakarta (ap-southeast-3) qua DynamoDB Global Tables và Route 53 DNS Failover.")
    ]
    for tr, dr in roadmaps:
        pr1 = tf_rr.add_paragraph()
        pr1.text = f"• {tr}"
        pr1.font.name = "Arial"
        pr1.font.size = Pt(10)
        pr1.font.bold = True
        pr1.font.color.rgb = C_BLACK

        pr2 = tf_rr.add_paragraph()
        pr2.text = dr
        pr2.font.name = "Arial"
        pr2.font.size = Pt(9)
        pr2.font.color.rgb = C_TEXT

    # Bottom Thank you & QA banner
    qa = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(5.95), Inches(11.733), Inches(0.95))
    qa.fill.solid()
    qa.fill.fore_color.rgb = C_BLUE_DARK
    qa.line.color.rgb = C_BLUE_DARK
    tf_qa = qa.text_frame
    tf_qa.vertical_anchor = MSO_ANCHOR.MIDDLE
    p_q1 = tf_qa.paragraphs[0]
    p_q1.text = "Nhóm 14 xin trân trọng cảm ơn TS. Hoàng Xuân Tùng và Hội đồng chấm đồ án!"
    p_q1.alignment = PP_ALIGN.CENTER
    p_q1.font.name = "Arial"
    p_q1.font.size = Pt(13)
    p_q1.font.bold = True
    p_q1.font.color.rgb = C_WHITE

    p_q2 = tf_qa.add_paragraph()
    p_q2.text = "Kính mời Thầy và các bạn sinh viên đặt câu hỏi (Q&A Session)"
    p_q2.alignment = PP_ALIGN.CENTER
    p_q2.font.name = "Arial"
    p_q2.font.size = Pt(11)
    p_q2.font.color.rgb = RGBColor(191, 219, 254)

    add_notes(s8,
        "Để kết thúc bài báo cáo, nhóm khẳng định 4 kết quả cốt lõi: xử lý bão nộp bài thành công với P99 dưới 36 mili-giây, "
        "chống gian lận sinh trắc học tin cậy, thí sinh không sợ mất bài và chi phí thực tế 0 đồng. "
        "Nhóm xin trân trọng cảm ơn Thầy Hoàng Xuân Tùng đã tận tình hướng dẫn trong suốt học kỳ vừa qua. "
        "Sau đây nhóm xin kính mời Thầy và Hội đồng đặt câu hỏi đóng góp cho đồ án ạ."
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    prs.save(output_path)
    print(f"Successfully generated exact 8-slide presentation at: {output_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "docs/CloudExam_Final_Presentation.pptx"
    build_8_slides_presentation(out_file)
