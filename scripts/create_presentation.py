import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def build_presentation(output_path="docs/CloudExam_Final_Presentation.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette
    C_BG_WHITE = RGBColor(255, 255, 255)
    C_TEXT_BLACK = RGBColor(15, 23, 42)     # Slate 900
    C_TEXT_MUTED = RGBColor(100, 116, 139)  # Slate 500
    C_TEXT_BODY = RGBColor(51, 65, 85)      # Slate 700
    C_BLUE_PRIMARY = RGBColor(30, 58, 138)  # Blue 900
    C_BLUE_ACCENT = RGBColor(37, 99, 235)   # Blue 600
    C_BLUE_LIGHT = RGBColor(239, 246, 255)  # Blue 50
    C_CARD_BG = RGBColor(248, 250, 252)     # Slate 50
    C_CARD_BORDER = RGBColor(226, 232, 240) # Slate 200
    C_GREEN = RGBColor(16, 185, 129)       # Emerald 500
    C_ORANGE = RGBColor(245, 158, 11)      # Amber 500

    def add_header(slide, title_text, category_text="CLOUDEXAM — BÁO CÁO ĐỒ ÁN CUỐI KỲ"):
        # Header category
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.3))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_right = tf_cat.margin_top = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.name = "Arial"
        p_cat.font.size = Pt(9.5)
        p_cat.font.bold = True
        p_cat.font.color.rgb = C_BLUE_ACCENT

        # Title
        t_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.65), Inches(11.733), Inches(0.65))
        tf_t = t_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_right = tf_t.margin_top = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.name = "Arial"
        p_t.font.size = Pt(24)
        p_t.font.bold = True
        p_t.font.color.rgb = C_TEXT_BLACK

        # Accent line
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.35), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = C_CARD_BORDER
        line.line.color.rgb = C_CARD_BORDER

    def add_notes(slide, notes_text):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes_text

    # =========================================================================
    # SLIDE 1: COVER SLIDE
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)

    # University Badge Box
    u_box = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.7), Inches(11.733), Inches(0.55))
    u_box.fill.solid()
    u_box.fill.fore_color.rgb = C_BLUE_LIGHT
    u_box.line.color.rgb = RGBColor(191, 219, 254)
    tf_u = u_box.text_frame
    tf_u.vertical_anchor = MSO_ANCHOR.MIDDLE
    p_u = tf_u.paragraphs[0]
    p_u.text = "ĐẠI HỌC QUỐC GIA HÀ NỘI — TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)"
    p_u.alignment = PP_ALIGN.CENTER
    p_u.font.name = "Arial"
    p_u.font.size = Pt(11)
    p_u.font.bold = True
    p_u.font.color.rgb = C_BLUE_PRIMARY

    # Main Project Title
    t_box = slide1.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(11.733), Inches(1.2))
    tf_t = t_box.text_frame
    p_t = tf_t.paragraphs[0]
    p_t.text = "CLOUDEXAM"
    p_t.alignment = PP_ALIGN.CENTER
    p_t.font.name = "Arial"
    p_t.font.size = Pt(54)
    p_t.font.bold = True
    p_t.font.color.rgb = C_BLUE_PRIMARY

    # Subtitle
    sub_box = slide1.shapes.add_textbox(Inches(0.8), Inches(2.7), Inches(11.733), Inches(0.6))
    tf_sub = sub_box.text_frame
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = "NỀN TẢNG KHẢO THÍ TRỰC TUYẾN SERVERLESS EVENT-DRIVEN & MULTI-CLOUD"
    p_sub.alignment = PP_ALIGN.CENTER
    p_sub.font.name = "Arial"
    p_sub.font.size = Pt(16)
    p_sub.font.bold = True
    p_sub.font.color.rgb = C_BLUE_ACCENT

    # Course info card
    c_box = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(3.45), Inches(10.333), Inches(0.9))
    c_box.fill.solid()
    c_box.fill.fore_color.rgb = C_CARD_BG
    c_box.line.color.rgb = C_CARD_BORDER
    tf_c = c_box.text_frame
    tf_c.vertical_anchor = MSO_ANCHOR.MIDDLE
    p_c1 = tf_c.paragraphs[0]
    p_c1.text = "BÁO CÁO BÀI TẬP LỚN CUỐI KỲ — HỌC PHẦN: ĐIỆN TOÁN ĐÁM MÂY (INT3319 1)"
    p_c1.alignment = PP_ALIGN.CENTER
    p_c1.font.name = "Arial"
    p_c1.font.size = Pt(12)
    p_c1.font.bold = True
    p_c1.font.color.rgb = C_TEXT_BLACK
    p_c2 = tf_c.add_paragraph()
    p_c2.text = "Giảng viên hướng dẫn: TS. Hoàng Xuân Tùng  |  Học kỳ I, Năm học 2026 – 2027"
    p_c2.alignment = PP_ALIGN.CENTER
    p_c2.font.name = "Arial"
    p_c2.font.size = Pt(11)
    p_c2.font.color.rgb = C_TEXT_MUTED

    # Team members 4 cards
    members = [
        ("Nguyễn Thị Ngọc Hà", "24020115", "Nhóm trưởng (IaC & Security)"),
        ("Trần Đức Mạnh", "24021561", "Backend AI & SQS Worker"),
        ("Phạm Tuấn Phong", "24021596", "Frontend Local-First & Load Test"),
        ("Nguyễn Phúc Tấn", "24021620", "Core API & Step Functions")
    ]
    card_w = Inches(2.7)
    card_gap = Inches(0.3)
    start_x = Inches(0.8 + 0.3)
    for i, (name, msv, role) in enumerate(members):
        mx = start_x + i * (card_w + card_gap)
        m_shape = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, mx, Inches(4.7), card_w, Inches(1.9))
        m_shape.fill.solid()
        m_shape.fill.fore_color.rgb = C_CARD_BG
        m_shape.line.color.rgb = C_CARD_BORDER
        tf_m = m_shape.text_frame
        tf_m.vertical_anchor = MSO_ANCHOR.MIDDLE
        p1 = tf_m.paragraphs[0]
        p1.text = f"Thành viên {i+1}"
        p1.font.name = "Arial"
        p1.font.size = Pt(9.5)
        p1.font.color.rgb = C_BLUE_ACCENT
        p1.font.bold = True
        
        p2 = tf_m.add_paragraph()
        p2.text = name
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.bold = True
        p2.font.color.rgb = C_TEXT_BLACK
        
        p3 = tf_m.add_paragraph()
        p3.text = f"MSSV: {msv}"
        p3.font.name = "Arial"
        p3.font.size = Pt(10)
        p3.font.color.rgb = C_TEXT_MUTED

        p4 = tf_m.add_paragraph()
        p4.text = role
        p4.font.name = "Arial"
        p4.font.size = Pt(9)
        p4.font.color.rgb = C_TEXT_BODY

    add_notes(slide1, 
        "Kính thưa Thầy và Hội đồng, nhóm 14 xin trình bày báo cáo bài tập lớn học phần Điện toán đám mây. "
        "Đề tài của nhóm là CloudExam: Nền tảng khảo thí trực tuyến Không máy chủ (Serverless Event-Driven) "
        "kết hợp Đa đám mây lai (Hybrid Multi-Cloud). Giải pháp giải quyết bài toán xung nộp bài giây cuối và tối ưu chi phí vận hành 0$."
    )

    # =========================================================================
    # SLIDE 2: CONTENT (AGENDA)
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    add_header(slide2, "Content")

    agenda_items = [
        ("01", "Project Overview", "Bối cảnh thực tiễn, đối tượng người dùng, mục đích sử dụng và luồng giải pháp tổng quan"),
        ("02", "Project Features", "Sơ đồ Use-case tổng thể hệ thống và phân tích chi tiết 5 phân hệ chức năng cốt lõi"),
        ("03", "Implementation Overview", "Triết lý Serverless Event-Driven, Queue-Based Load Leveling và 6 Tầng công nghệ Multi-Cloud"),
        ("04", "Implementation Details", "Kiến trúc Triển khai vật lý (ap-southeast-1), cơ chế đệm SQS, DynamoDB Sparse GSI & Chi tiết kỹ thuật"),
        ("05", "Project Executions", "Tiến độ 4 Sprints phát triển, quy trình làm việc nhóm, bảng phân công nhiệm vụ và tỷ lệ đóng góp"),
        ("06", "Conclusion & Evaluation", "Kết quả thực nghiệm chịu tải 500 VUs, độ chính xác AI Rekognition, kiểm toán FinOps $0 và hướng phát triển")
    ]

    grid_w = Inches(5.6)
    grid_h = Inches(1.5)
    for idx, (num, title, desc) in enumerate(agenda_items):
        row = idx // 2
        col = idx % 2
        gx = Inches(0.8) + col * Inches(6.1)
        gy = Inches(1.65) + row * Inches(1.75)

        card = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, gx, gy, grid_w, grid_h)
        card.fill.solid()
        card.fill.fore_color.rgb = C_CARD_BG
        card.line.color.rgb = C_CARD_BORDER

        tf_g = card.text_frame
        tf_g.margin_left = Inches(0.25)
        tf_g.margin_top = Inches(0.18)
        p1 = tf_g.paragraphs[0]
        p1.text = f"{num}. {title}"
        p1.font.name = "Arial"
        p1.font.size = Pt(14)
        p1.font.bold = True
        p1.font.color.rgb = C_BLUE_PRIMARY

        p2 = tf_g.add_paragraph()
        p2.text = desc
        p2.font.name = "Arial"
        p2.font.size = Pt(10.5)
        p2.font.color.rgb = C_TEXT_BODY

    add_notes(slide2, 
        "Bài báo cáo của nhóm được cơ cấu thành 6 nội dung trọng tâm bám sát mẫu slide chuẩn của môn học. "
        "Đi từ bài toán nghiệp vụ, kiến trúc use-case, tổng quan giải pháp đám mây, chi tiết triển khai kỹ thuật, "
        "tiến độ phân công và nghiệm thu số liệu đo đạc thực tế."
    )

    # =========================================================================
    # SLIDE 3: PROJECT OVERVIEW
    # =========================================================================
    slide3 = prs.slides.add_slide(blank_layout)
    add_header(slide3, "Project overview")

    # 4 Cards corresponding to template prompts: Introduction, Who use it?, Context & Purpose, How
    po_cards = [
        ("❖ Introduction", Inches(0.8), Inches(1.6), Inches(5.6), Inches(2.55), [
            ("Mô hình Cloud-Native:", "Hệ thống khảo thí trực tuyến xây dựng 100% trên Kiến trúc Không máy chủ hướng sự kiện (Serverless EDA)."),
            ("Hybrid Multi-Cloud:", "Lấy AWS làm hạ tầng điện toán/lưu trữ hạt nhân, kết hợp vệ tinh Google Gemini AI, Upstash Redis, Cloudflare Turnstile."),
            ("Tự động hóa toàn diện:", "100% tài nguyên hạ tầng đám mây được định nghĩa bằng mã nguồn (IaC Terraform) và CI/CD GitHub Actions.")
        ]),
        ("❖ Who use it? (3 Nhóm người dùng)", Inches(6.9), Inches(1.6), Inches(5.6), Inches(2.55), [
            ("Thí sinh (Students):", "Làm bài thi trắc nghiệm/tự luận, đối soát khuôn mặt AI, trải nghiệm Local-First 0ms phản hồi, xem BXH trực tiếp."),
            ("Giảng viên (Instructors):", "Số hóa đề thi tự động bằng AI từ file Word, quản lý ngân hàng đề, lên lịch ca thi, xuất bảng điểm CSV UTF-8 BOM."),
            ("Giám thị (Proctors):", "Cấp Passcode phòng thi 6 số, giám sát thí sinh điểm danh trực tiếp qua Dashboard (đèn xanh + khóa cứng thiết bị).")
        ]),
        ("❖ Context and purpose (Where, when, why)", Inches(0.8), Inches(4.35), Inches(5.6), Inches(2.75), [
            ("Bối cảnh sử dụng:", "Các kỳ thi tập trung đại học quy mô 5.000+ thí sinh hoặc kỳ thi chứng chỉ trực tuyến từ xa."),
            ("Giải quyết 3 nghịch lý:", "1. Khắc phục sự cố sập máy chủ do bão nộp bài giây cuối (Submission Stampede) trên RDBMS truyền thống."),
            ("Chống gian lận tinh vi:", "2. Ngăn chặn thi hộ bằng Rekognition 1:1, khóa cứng deviceToken; ẩn 100% đáp án chống soi F12 Inspect."),
            ("Tối ưu hóa FinOps:", "3. Triệt tiêu chi phí tài nguyên nhàn rỗi (tiết kiệm hàng chục USD/tháng thuê EC2), đưa chi phí chờ thi về 0.00 USD.")
        ]),
        ("❖ How (Luồng vận hành cốt lõi)", Inches(6.9), Inches(4.35), Inches(5.6), Inches(2.75), [
            ("Chuẩn bị & Soạn đề:", "Tải file .docx lên S3 -> Gemini 1.5 Flash bóc tách thành JSON chuẩn (có Regex NLP dự phòng)."),
            ("Điểm danh & Làm bài:", "Thí sinh chụp ảnh webcam -> S3 Presigned URL -> Rekognition CompareFaces (>=80%) -> Lưu nháp Local-First."),
            ("Nộp bài & Chấm mẻ:", "Hết giờ nộp bài -> Đẩy SQS Buffer (<50ms ACK) -> Lambda Worker chấm lô (Batch 10) -> Upstash Redis BXH."),
            ("Tự động hóa vòng đời:", "Step Functions Wait State ($0) tự động đóng phòng thi, kích hoạt Auto-Finalize cứu bài nháp rớt mạng.")
        ])
    ]

    for title, x, y, w, h, bullets in po_cards:
        box = slide3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        box.fill.solid()
        box.fill.fore_color.rgb = C_CARD_BG
        box.line.color.rgb = C_CARD_BORDER

        tf = box.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.15)
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.name = "Arial"
        p_t.font.size = Pt(13)
        p_t.font.bold = True
        p_t.font.color.rgb = C_BLUE_PRIMARY

        for label, text in bullets:
            p = tf.add_paragraph()
            p.text = f"• {label} "
            p.font.name = "Arial"
            p.font.size = Pt(9.5)
            p.font.bold = True
            p.font.color.rgb = C_TEXT_BLACK
            
            run = p.add_run()
            run.text = text
            run.font.bold = False
            run.font.color.rgb = C_TEXT_BODY

    add_notes(slide3, 
        "Ở slide này, nhóm trình bày 4 yếu tố bối cảnh: CloudExam là nền tảng Serverless EDA giải quyết 3 nỗi đau lớn nhất "
        "của khảo thí trực tuyến: nghẽn nộp bài giây cuối, gian lận thi cử và lãng phí chi phí máy chủ ảo EC2 khi không có kỳ thi."
    )

    # =========================================================================
    # SLIDE 4: PROJECT FEATURES (USE-CASE & CORE FEATURES)
    # =========================================================================
    slide4 = prs.slides.add_slide(blank_layout)
    add_header(slide4, "Project features")

    # Left Column: Diagram 1: System Use-case diagram
    diag_box = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.4))
    diag_box.fill.solid()
    diag_box.fill.fore_color.rgb = C_CARD_BG
    diag_box.line.color.rgb = C_CARD_BORDER

    tf_diag = diag_box.text_frame
    tf_diag.margin_left = tf_diag.margin_right = tf_diag.margin_top = Inches(0.2)
    p = tf_diag.paragraphs[0]
    p.text = "❖ Diagram 1: System Use-case diagram"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    # Visual Use-Case modules inside left column
    uc_modules = [
        ("Phân hệ Thí sinh (Candidate Actor)", [
            "Đăng ký/Đăng nhập OTP In-App & Cognito Hosted UI",
            "Điểm danh AI Rekognition 1:1 qua Webcam (Mirror Mode)",
            "Làm bài thi Local-First 0ms & Đồng bộ nháp định kỳ",
            "Nộp bài giải mã Turnstile token qua hàng đợi SQS",
            "Theo dõi Bảng xếp hạng Live Leaderboard thời gian thực"
        ]),
        ("Phân hệ Giảng viên / Quản trị (Instructor Actor)", [
            "Tạo Ngân hàng câu hỏi & Xóa tầng dữ liệu (Cascade Delete)",
            "Số hóa đề tự động bằng AI Gemini & Regex Fallback 0.05s",
            "Tạo ca thi, sinh mã Passcode 6 số & phân quyền thí sinh",
            "Xem thống kê KPI lớp học & Xuất bảng điểm CSV UTF-8 BOM"
        ]),
        ("Phân hệ Giám thị & Hệ thống (Proctor & Step Functions)", [
            "Giám sát phòng thi thời gian thực, mở khóa thí sinh",
            "Step Functions: Tự động hóa ca thi (Wait State $0)",
            "Auto-Finalize: Thu hồi và chấm bù bài nháp khi hết giờ"
        ])
    ]

    curr_y = Inches(2.1)
    for m_title, items in uc_modules:
        m_box = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), curr_y, Inches(5.2), Inches(1.4))
        m_box.fill.solid()
        m_box.fill.fore_color.rgb = RGBColor(255, 255, 255)
        m_box.line.color.rgb = RGBColor(203, 213, 225)
        tf_m = m_box.text_frame
        tf_m.margin_left = tf_m.margin_right = Inches(0.15)
        tf_m.margin_top = Inches(0.08)
        p1 = tf_m.paragraphs[0]
        p1.text = m_title
        p1.font.name = "Arial"
        p1.font.size = Pt(10.5)
        p1.font.bold = True
        p1.font.color.rgb = C_BLUE_ACCENT

        for item in items:
            pi = tf_m.add_paragraph()
            pi.text = f"➢ {item}"
            pi.font.name = "Arial"
            pi.font.size = Pt(8.5)
            pi.font.color.rgb = C_TEXT_BODY
        curr_y += Inches(1.5)

    # Right Column: Explain in details (5 Core Feature Groups)
    exp_box = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(1.6), Inches(5.6), Inches(5.4))
    exp_box.fill.solid()
    exp_box.fill.fore_color.rgb = C_CARD_BG
    exp_box.line.color.rgb = C_CARD_BORDER

    tf_exp = exp_box.text_frame
    tf_exp.margin_left = tf_exp.margin_right = tf_exp.margin_top = Inches(0.2)
    p = tf_exp.paragraphs[0]
    p.text = "❖ Explain in details (5 Cụm tính năng đột phá)"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    core_features = [
        ("1. Số hóa đề thi AI & Tải ảnh trực tiếp S3", 
         "Giảng viên dán văn bản hoặc tải file .docx; Google Gemini 1.5 Flash bóc tách JSON câu hỏi trong 2s. Cơ chế Regex NLP Fallback chạy offline 0.05s bảo đảm sẵn sàng 100%. Ảnh sơ đồ tải thẳng lên S3 Presigned URL (0MB qua backend)."),
        ("2. Điểm danh AI Rekognition & Khóa thiết bị", 
         "Chụp webcam tải nhị phân Blob (~150KB) thẳng lên S3 qua Presigned URL (TTL 60s). Rekognition đối soát 1:1 với ảnh thẻ gốc (Similarity >= 80%). Cơ chế khóa thiết bị (lockedCandidates Mutex) chặn 1 tài khoản đăng nhập 2 máy cùng lúc."),
        ("3. Phòng thi Local-First & Đồng bộ nháp Throttled", 
         "Giao diện lưu tức thì vào localStorage (< 1ms). Thuật toán Throttled Micro-batching gom 10 câu hoặc 60s mới gửi API, giảm 90% tải ghi DynamoDB. Backend ẩn hoàn toàn correctIndex chống gian lận qua F12."),
        ("4. Đệm tải nộp bài SQS & Chấm điểm lô (Batch 10)", 
         "Giải mã khiên Cloudflare Turnstile; đẩy bài vào SQS SubmissionBuffer (< 50ms ACK). Lambda Worker rút mẻ Batch 10 gọi duy nhất 1 lệnh BatchGetItem chấm tự động; cập nhật Live Leaderboard Upstash Redis (< 5ms)."),
        ("5. Tự động hóa Vòng đời ca thi & Auto-Finalize", 
         "Step Functions Wait State ($0 Compute) chuyển ca thi SCHEDULED -> RUNNING -> CLOSED. Khi hết giờ, tác vụ AutoFinalize tự động cứu và chấm bù bài nháp của thí sinh rớt mạng; gửi email tổng kết qua Amazon SNS.")
    ]

    for title_f, desc_f in core_features:
        pf1 = tf_exp.add_paragraph()
        pf1.text = f"➢ {title_f}"
        pf1.font.name = "Arial"
        pf1.font.size = Pt(10)
        pf1.font.bold = True
        pf1.font.color.rgb = C_TEXT_BLACK

        pf2 = tf_exp.add_paragraph()
        pf2.text = desc_f
        pf2.font.name = "Arial"
        pf2.font.size = Pt(8.5)
        pf2.font.color.rgb = C_TEXT_BODY

    add_notes(slide4, 
        "Slide 4 biểu diễn toàn bộ sơ đồ Use-case hệ thống và phân tích 5 cụm tính năng đột phá: Số hóa AI, "
        "Điểm danh Rekognition 1:1, Phòng thi Local-First, Đệm tải nộp bài SQS và Tự động hóa ca thi Step Functions."
    )

    # =========================================================================
    # SLIDE 5: IMPLEMENTATION OVERVIEW (KIẾN TRÚC TỔNG THỂ)
    # =========================================================================
    slide5 = prs.slides.add_slide(blank_layout)
    add_header(slide5, "Implementation overview")

    # Top Section: Cloud Architecture Principles
    p_box = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.6), Inches(11.733), Inches(1.3))
    p_box.fill.solid()
    p_box.fill.fore_color.rgb = C_BLUE_LIGHT
    p_box.line.color.rgb = RGBColor(191, 219, 254)
    tf_p = p_box.text_frame
    tf_p.margin_left = tf_p.margin_right = tf_p.margin_top = Inches(0.2)
    p = tf_p.paragraphs[0]
    p.text = "❖ Triết lý Thiết kế Kiến trúc Cloud-Native (AWS Well-Architected)"
    p.font.name = "Arial"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    p1 = tf_p.add_paragraph()
    p1.text = "• 100% Serverless Event-Driven: Không quản trị máy chủ, tự động co giãn từ 0 đến hàng ngàn người dùng, thanh toán theo mili-giây thực thi (Zero Idle Cost)."
    p1.font.name = "Arial"
    p1.font.size = Pt(9.5)
    p1.font.color.rgb = C_TEXT_BODY

    p2 = tf_p.add_paragraph()
    p2.text = "• Queue-Based Load Leveling: Tách rời tuyệt đối tầng tiếp nhận bài nộp (Ingress) và tầng chấm điểm nặng (Grading) qua hàng đợi Amazon SQS."
    p2.font.name = "Arial"
    p2.font.size = Pt(9.5)
    p2.font.color.rgb = C_TEXT_BODY

    p3 = tf_p.add_paragraph()
    p3.text = "• Hybrid Multi-Cloud Satellites: Lấy AWS làm hạt nhân điện toán, kết hợp Google AI Studio (bóc tách đề), Upstash Redis (BXH <5ms) và Cloudflare (chống bot)."
    p3.font.name = "Arial"
    p3.font.size = Pt(9.5)
    p3.font.color.rgb = C_TEXT_BODY

    # Bottom Section: 6 Tiers of Cloud Stack (6 cards)
    tiers = [
        ("TẦNG 1: BIÊN & ĐA THUÊ BAO", "Edge & Delivery Plane", [
            "Route 53 Anycast DNS",
            "CloudFront CDN (TLS 1.3)",
            "CloudFront Functions (x-tenant-id)",
            "Cloudflare Turnstile Invisible Shield"
        ], RGBColor(238, 242, 255)),
        ("TẦNG 2: AN NINH & ĐỊNH DANH", "Security & Identity Plane", [
            "AWS WAFv2 (Rate-limit 2000)",
            "Amazon Cognito User Pool",
            "OAuth 2.0 PKCE & In-App OTP",
            "Amazon Rekognition 1:1"
        ], RGBColor(236, 253, 245)),
        ("TẦNG 3: TÍNH TOÁN SERVERLESS", "Compute Plane (ARM64)", [
            "API Gateway Regional REST",
            "3 Lambda Graviton2 (Python 3.12)",
            "Core API, Face Verify, Grading",
            "Direct Serverless Outbound"
        ], RGBColor(254, 243, 199)),
        ("TẦNG 4: HÀNG ĐỢI ĐỆM TẢI", "Async Buffer & Messaging", [
            "Amazon SQS Standard Queue",
            "SQS Dead-Letter Queue (DLQ)",
            "Batch Size = 10, Batch Window = 2s",
            "Redrive Policy (maxReceiveCount=3)"
        ], RGBColor(254, 226, 226)),
        ("TẦNG 5: CSDL & BỘ NHỚ ĐỆM", "Data & Cache Plane", [
            "DynamoDB On-Demand 5 bảng",
            "Sparse GSI SessionResultsIndex",
            "S3 Hosting (OAC) & Media 60s",
            "Upstash Redis Sorted Set (ZADD)"
        ], RGBColor(240, 253, 250)),
        ("TẦNG 6: ĐIỀU PHỐI & FINOPS", "Orchestration & FinOps", [
            "AWS Step Functions (Wait State $0)",
            "AutoFinalizeTask cứu bài tồn",
            "Amazon SNS Topic Email Alerts",
            "AWS Budgets 100$ Alert Trigger"
        ], RGBColor(241, 245, 249))
    ]

    tw = Inches(3.7)
    th = Inches(1.85)
    for i, (t_name, t_sub, t_items, bg_c) in enumerate(tiers):
        r = i // 3
        c = i % 3
        tx = Inches(0.8) + c * Inches(3.95)
        ty = Inches(3.1) + r * Inches(2.05)

        t_box = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, tx, ty, tw, th)
        t_box.fill.solid()
        t_box.fill.fore_color.rgb = bg_c
        t_box.line.color.rgb = C_CARD_BORDER

        tf_t = t_box.text_frame
        tf_t.margin_left = tf_t.margin_right = Inches(0.15)
        tf_t.margin_top = Inches(0.1)

        p = tf_t.paragraphs[0]
        p.text = t_name
        p.font.name = "Arial"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = C_BLUE_PRIMARY

        p_sub = tf_t.add_paragraph()
        p_sub.text = t_sub
        p_sub.font.name = "Arial"
        p_sub.font.size = Pt(8.5)
        p_sub.font.color.rgb = C_TEXT_MUTED

        for item in t_items:
            pi = tf_t.add_paragraph()
            pi.text = f"• {item}"
            pi.font.name = "Arial"
            pi.font.size = Pt(8)
            pi.font.color.rgb = C_TEXT_BODY

    add_notes(slide5, 
        "Slide 5 tóm tắt toàn bộ Kiến trúc Điện toán Đám mây 6 tầng của CloudExam: Tầng Biên, An ninh, "
        "Tính toán Serverless ARM64 Graviton2, Hàng đợi đệm SQS, CSDL NoSQL DynamoDB On-Demand và Cỗ máy điều phối Step Functions."
    )

    # =========================================================================
    # SLIDE 6: IMPLEMENTATION DETAILS (CHI TIẾT TRIỂN KHAI VẬT LÝ)
    # =========================================================================
    slide6 = prs.slides.add_slide(blank_layout)
    add_header(slide6, "Implementation details")

    # Left Column: Diagram 2: Deployment Architecture Summary Box
    d2_box = slide6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.4))
    d2_box.fill.solid()
    d2_box.fill.fore_color.rgb = C_CARD_BG
    d2_box.line.color.rgb = C_CARD_BORDER

    tf_d2 = d2_box.text_frame
    tf_d2.margin_left = tf_d2.margin_right = tf_d2.margin_top = Inches(0.2)
    p = tf_d2.paragraphs[0]
    p.text = "❖ Diagram 2: Deployment architecture"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    p_reg = tf_d2.add_paragraph()
    p_reg.text = "AWS Region: ap-southeast-1 (Singapore)  |  Single Primary Production"
    p_reg.font.name = "Arial"
    p_reg.font.size = Pt(9.5)
    p_reg.font.color.rgb = C_TEXT_MUTED

    dep_layers = [
        ("Tầng Biên & Ingress Gateway", "Client -> Route 53 (Anycast) -> CloudFront CDN (OAC) -> AWS WAFv2 -> API Gateway Regional (Xác thực Cognito RS256 JWKS)"),
        ("Tầng Tính toán Serverless ARM64", "API Gateway chuyển tiếp SigV4 -> Cụm 3 Lambda Graviton2 Python 3.12 (Direct Outbound, $0 NAT Gateway): Ingestion, FaceVerify, Grading"),
        ("Hàng đợi Đệm tải & Chấm điểm lô", "Ingestion đẩy bài nộp vào SQS Buffer (<50ms ACK) -> SQS Event Source Mapping (Batch 10) kích hoạt Grading Worker -> Lỗi 3 lần đẩy DLQ 14 ngày"),
        ("Lưu trữ Bền vững & Bộ nhớ đệm", "Grading Worker gọi BatchGetItem bảng Questions -> Ghi điểm SubmissionsTable (Sparse GSI) -> Đẩy Upstash Redis (ZADD) BXH Live (<5ms)"),
        ("Tự động hóa Chu trình Ca thi", "Step Functions Wait State ($0 Compute) chuyển ca thi SCHEDULED -> RUNNING -> CLOSED -> AutoFinalize cứu bài nháp -> SNS Topic gửi email báo cáo")
    ]

    curr_y2 = Inches(2.25)
    for l_title, l_desc in dep_layers:
        l_shape = slide6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), curr_y2, Inches(5.2), Inches(0.85))
        l_shape.fill.solid()
        l_shape.fill.fore_color.rgb = RGBColor(255, 255, 255)
        l_shape.line.color.rgb = RGBColor(203, 213, 225)
        tf_l = l_shape.text_frame
        tf_l.margin_left = tf_l.margin_right = Inches(0.12)
        tf_l.margin_top = Inches(0.06)
        pl1 = tf_l.paragraphs[0]
        pl1.text = l_title
        pl1.font.name = "Arial"
        pl1.font.size = Pt(9.5)
        pl1.font.bold = True
        pl1.font.color.rgb = C_BLUE_ACCENT
        pl2 = tf_l.add_paragraph()
        pl2.text = l_desc
        pl2.font.name = "Arial"
        pl2.font.size = Pt(8)
        pl2.font.color.rgb = C_TEXT_BODY
        curr_y2 += Inches(0.95)

    # Right Column: Core information
    core_box = slide6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(1.6), Inches(5.6), Inches(5.4))
    core_box.fill.solid()
    core_box.fill.fore_color.rgb = C_CARD_BG
    core_box.line.color.rgb = C_CARD_BORDER

    tf_c = core_box.text_frame
    tf_c.margin_left = tf_c.margin_right = tf_c.margin_top = Inches(0.2)
    p = tf_c.paragraphs[0]
    p.text = "❖ Core information & Giải pháp Kỹ thuật"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    details = [
        ("➢ Chức năng của từng thành phần:", [
            "CloudFront + WAFv2: Phục vụ mã nguồn tĩnh React SPA (<20ms), chặn SQLi/XSS, Rate-limit 2.000 req/5m/IP.",
            "Lambda Ingestion & SQS: Tiếp nhận bài nộp, đẩy ngay vào SQS trong <50ms giải phóng kết nối, tuyệt đối không tính điểm đồng bộ.",
            "Lambda Grading Worker: Rút mẻ 10 bài thi, gọi dynamodb:BatchGetItem lấy đáp án 1 lần, ghi điểm và cập nhật Redis.",
            "DynamoDB Sparse GSI: Chỉ đánh chỉ mục bài thi đã có thuộc tính score, cho phép truy vấn BXH ca thi <10ms không cần Scan."
        ]),
        ("➢ Công việc đã thực hiện để triển khai:", [
            "100% IaC Terraform: Cấp phát tự động 34 tài nguyên AWS, quản lý trạng thái bằng S3 Backend + DynamoDB Lock.",
            "Mô hình Serverless Direct Outbound: Chạy Non-VPC để gọi Gemini, Upstash và Turnstile với $0 phí NAT Gateway.",
            "Mẫu hình Direct-to-Storage: Cấp S3 Presigned URL tải ảnh webcam thẳng lên S3, giảm tải 100% băng thông qua backend."
        ]),
        ("➢ Kỹ thuật giải quyết nghẽn cổ chai (Làm như nào?):", [
            "Khắc phục Hot Partition 1.000 WCU: Phân tán bài nháp vào từng bản ghi riêng trên SubmissionsTable kết hợp Client Throttle (60s/10 câu) giảm 90% tải ghi.",
            "Khóa thiết bị Mutex: Ghi lockedCandidates[MSSV] = deviceToken, chặn tuyệt đối đăng nhập 2 máy cùng lúc."
        ])
    ]

    for sec_t, bullet_list in details:
        ps = tf_c.add_paragraph()
        ps.text = sec_t
        ps.font.name = "Arial"
        ps.font.size = Pt(10)
        ps.font.bold = True
        ps.font.color.rgb = C_TEXT_BLACK

        for b in bullet_list:
            pb = tf_c.add_paragraph()
            pb.text = f"• {b}"
            pb.font.name = "Arial"
            pb.font.size = Pt(8.2)
            pb.font.color.rgb = C_TEXT_BODY

    add_notes(slide6, 
        "Trọng tâm của Slide 6 là phân tích kỹ thuật: Hệ thống đã làm gì để chịu được bão nộp bài? "
        "1. Dùng SQS san phẳng xung tải (ACK <50ms); 2. Dùng Sparse GSI và phân tán bản ghi để tránh Hot Partition và giới hạn 400KB của DynamoDB; "
        "3. Tối ưu $0 chi phí NAT Gateway nhờ Serverless Direct Outbound."
    )

    # =========================================================================
    # SLIDE 7: PROJECT EXECUTIONS (TIẾN ĐỘ & PHÂN CÔNG ĐÓNG GÓP)
    # =========================================================================
    slide7 = prs.slides.add_slide(blank_layout)
    add_header(slide7, "Project executions")

    # Briefing history of project development (4 Sprints Timeline)
    hist_box = slide7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.6), Inches(11.733), Inches(1.15))
    hist_box.fill.solid()
    hist_box.fill.fore_color.rgb = C_CARD_BG
    hist_box.line.color.rgb = C_CARD_BORDER

    tf_h = hist_box.text_frame
    tf_h.margin_left = tf_h.margin_right = tf_h.margin_top = Inches(0.15)
    p = tf_h.paragraphs[0]
    p.text = "❖ Briefing history of project development (4 Sprints: 07/10 – 15/11/2026)"
    p.font.name = "Arial"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    sprints_summary = (
        "• Sprint 1 (07/10 - 13/10): Thiết lập Terraform S3 State & DynamoDB Lock, khởi tạo 5 bảng DynamoDB On-Demand, nộp Progress Report 1.\n"
        "• Sprint 2 (18/10 - 28/10): Cụm Lambda ARM64 Python 3.12, tích hợp Cognito OAuth 2.0 PKCE & OTP, phòng thi Local-First, đệm SQS.\n"
        "• Sprint 3 (24/10 - 02/11): Tích hợp AI Gemini Flash & Regex Fallback, Rekognition 1:1, Upstash Redis Leaderboard, Step Functions ca thi.\n"
        "• Sprint 4 (02/11 - 15/11): Nghiệm thu tải Locust 500 VUs, kiểm toán WAFv2/DLQ, tối ưu FinOps $0 AWS Cost Explorer, nộp Final Report & Video."
    )
    ph = tf_h.add_paragraph()
    ph.text = sprints_summary
    ph.font.name = "Arial"
    ph.font.size = Pt(8.5)
    ph.font.color.rgb = C_TEXT_BODY

    # Team Members & Evaluation Table (❖ Summarize in table/sheet)
    p_tbl = slide7.shapes.add_textbox(Inches(0.8), Inches(2.85), Inches(11.733), Inches(0.35))
    tf_ptbl = p_tbl.text_frame
    p = tf_ptbl.paragraphs[0]
    p.text = "❖ Team members, tasks and evaluation of contributions (Đồng thuận 100%)"
    p.font.name = "Arial"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    # Add Table
    rows = 5
    cols = 4
    tbl_shape = slide7.shapes.add_table(rows, cols, Inches(0.8), Inches(3.25), Inches(11.733), Inches(3.7))
    tbl = tbl_shape.table
    tbl.columns[0].width = Inches(2.2) # Member
    tbl.columns[1].width = Inches(4.5) # Tech Tasks
    tbl.columns[2].width = Inches(3.8) # Report Tasks
    tbl.columns[3].width = Inches(1.233) # Percentage

    headers = ["Thành viên & MSSV", "Trách nhiệm Kỹ thuật (Mã nguồn & Hạ tầng)", "Nội dung Viết Báo cáo", "Tỷ lệ đóng góp"]
    for c_idx, h in enumerate(headers):
        cell = tbl.cell(0, c_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_BLUE_PRIMARY
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.name = "Arial"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)
        p.alignment = PP_ALIGN.CENTER if c_idx == 3 else PP_ALIGN.LEFT

    table_data = [
        ("Nguyễn Thị Ngọc Hà\n(Nhóm trưởng)\nMSV: 24020115",
         "• Quản trị Terraform IaC cấp phát 34 tài nguyên AWS, Remote State S3/Lock\n• Cấu hình Cognito User Pool, WAFv2 Web ACL, Route 53, CloudFront OAC\n• Thiết lập CloudWatch Alarms, AWS Budgets; Quay & Dựng Video Demo AWS",
         "• Viết: Bối cảnh, Kiến trúc Serverless Hub-and-Spoke, Hạ tầng Terraform IaC, An ninh đa tầng WAFv2/Cognito và Báo cáo tài chính FinOps (Report 1, 2, 3)\n• Tiếp nhận, chuẩn hóa văn phong và nộp bài đúng hạn",
         "26.3%"),
        ("Trần Đức Mạnh\nMSV: 24021561",
         "• Lập trình vi dịch vụ face_verify_handler.py tích hợp Rekognition 1:1\n• Cấu hình hàng đợi đệm Amazon SQS và Dead-Letter Queue (DLQ)\n• Lập trình grading_worker.py chấm lô Batch 10 & Upstash Redis BXH\n• Thiết kế bộ Slide thuyết trình Google Slides",
         "• Viết: Phân hệ điểm danh AI Rekognition, Ma trận nhầm lẫn (ISO/IEC 19795), Cơ chế đệm tải SQS/DLQ, Chấm lô và BXH Real-time\n• Viết script đo đạc rekognition_accuracy_test.py, waf_sqs_test.py",
         "24.6%"),
        ("Phạm Tuấn Phong\nMSV: 24021596",
         "• Phát triển toàn bộ ứng dụng Frontend React 19 SPA (Vite, Tailwind CSS)\n• Hiện thực hóa kiến trúc Local-First (localStorage <1ms) và Throttled 60s/10 câu\n• Xây dựng bộ lọc Anti-F12 Sanitizer & khiên Cloudflare Turnstile\n• Lập trình CloudFront Functions định tuyến đa ngôn ngữ tại biên",
         "• Viết: Thiết kế UI React 19 SPA, Cơ chế phòng thi Local-First bảo toàn dữ liệu, Giải pháp giảm 90% WCU và Báo cáo kiểm thử tải Locust 500 VUs\n• Thực thi kịch bản kiểm thử tải tests/locustfile.py",
         "24.6%"),
        ("Nguyễn Phúc Tấn\nMSV: 24021620",
         "• Phát triển vi dịch vụ api_handler.py (CRUD Ngân hàng đề, Ca thi, RBAC)\n• Tích hợp Google Gemini 1.5 Flash API kèm Regex NLP Fallback Engine\n• Cấu hình cỗ máy trạng thái Step Functions (exam_lifecycle), AutoFinalizeTask\n• Lập trình xuất bảng điểm CSV UTF-8 BOM",
         "• Viết: Thiết kế CSDL NoSQL Amazon DynamoDB (5 bảng, chiến lược khóa và Sparse GSI), Số hóa đề thi AI Gemini, Regex NLP Fallback và Step Functions\n• Xây dựng bộ script nạp dữ liệu mẫu ban đầu (seed_all.py)",
         "24.5%")
    ]

    for r_idx, row_data in enumerate(table_data, start=1):
        bg = C_CARD_BG if r_idx % 2 == 1 else RGBColor(255, 255, 255)
        for c_idx, val in enumerate(row_data):
            cell = tbl.cell(r_idx, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = bg
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.name = "Arial"
            p.font.size = Pt(8)
            p.font.color.rgb = C_TEXT_BLACK
            if c_idx == 3:
                p.font.bold = True
                p.alignment = PP_ALIGN.CENTER
                p.font.color.rgb = C_BLUE_PRIMARY

    add_notes(slide7, 
        "Slide 7 tổng kết lịch sử phát triển qua 4 Sprints từ 07/10 đến 15/11/2026, cùng bảng phân công "
        "trách nhiệm kỹ thuật và viết báo cáo của 4 thành viên. Tỷ lệ đóng góp được cả nhóm thống nhất 100%."
    )

    # =========================================================================
    # SLIDE 8: CONCLUSION (KẾT LUẬN & ĐÁNH GIÁ NGHIỆM THU)
    # =========================================================================
    slide8 = prs.slides.add_slide(blank_layout)
    add_header(slide8, "Conclusion")

    # Left Box: Key Technical Achievements & SLA Verification
    ach_box = slide8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.6), Inches(5.6), Inches(4.3))
    ach_box.fill.solid()
    ach_box.fill.fore_color.rgb = C_CARD_BG
    ach_box.line.color.rgb = C_CARD_BORDER

    tf_a = ach_box.text_frame
    tf_a.margin_left = tf_a.margin_right = tf_a.margin_top = Inches(0.2)
    p = tf_a.paragraphs[0]
    p.text = "❖ Key Technical Achievements & SLA Verification"
    p.font.name = "Arial"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

    achievements = [
        ("Xử lý Bão nộp bài giây cuối (Locust 500 VUs):", 
         "Tiếp nhận thành công 500/500 bài nộp (100.00% HTTP 200 OK); P99 Latency = 35.96 ms (vượt xa chuẩn SLA < 50ms); 0 bài rơi vào DLQ."),
        ("Độ chính xác AI Rekognition (ISO/IEC 19795):", 
         "Tỷ lệ chấp nhận sai FAR = 0.00% (chặn đứng 100% thi hộ/spoofing); Tỷ lệ từ chối sai FRR = 0.00% tại ngưỡng tối ưu SimilarityThreshold = 80.0%."),
        ("Bảo toàn dữ liệu tuyệt đối (Crash-Resilience):", 
         "Kiến trúc Local-First khôi phục 100% bài làm sau 1.2 ms khi mất điện/rớt mạng; cơ chế Auto-Finalize tự động cứu bài thi nháp cho thí sinh."),
        ("Quản trị Chi phí Đám mây (FinOps by Design):", 
         "Chi phí vận hành lúc nhàn rỗi đúng 0.00 USD/tháng; chi phí thực tế cho kỳ thi 5.000 thí sinh chỉ ~2.35 USD (~12 VNĐ / thí sinh, tiết kiệm >98%).")
    ]

    for title_a, desc_a in achievements:
        pa1 = tf_a.add_paragraph()
        pa1.text = f"• {title_a}"
        pa1.font.name = "Arial"
        pa1.font.size = Pt(9.5)
        pa1.font.bold = True
        pa1.font.color.rgb = C_TEXT_BLACK

        pa2 = tf_a.add_paragraph()
        pa2.text = desc_a
        pa2.font.name = "Arial"
        pa2.font.size = Pt(8.5)
        pa2.font.color.rgb = C_TEXT_BODY

    # Right Box: Limitations & Future Roadmap
    lim_box = slide8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(1.6), Inches(5.6), Inches(4.3))
    lim_box.fill.solid()
    lim_box.fill.fore_color.rgb = C_CARD_BG
    lim_box.line.color.rgb = C_CARD_BORDER

    tf_l = lim_box.text_frame
    tf_l.margin_left = tf_l.margin_right = tf_l.margin_top = Inches(0.2)
    p = tf_l.paragraphs[0]
    p.text = "❖ Limitations & Future Roadmap"
    p.font.name = "Arial"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_PRIMARY

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

    for title_r, desc_r in roadmaps:
        pr1 = tf_l.add_paragraph()
        pr1.text = f"• {title_r}"
        pr1.font.name = "Arial"
        pr1.font.size = Pt(9.5)
        pr1.font.bold = True
        pr1.font.color.rgb = C_TEXT_BLACK

        pr2 = tf_l.add_paragraph()
        pr2.text = desc_r
        pr2.font.name = "Arial"
        pr2.font.size = Pt(8.5)
        pr2.font.color.rgb = C_TEXT_BODY

    # Bottom Thank You Banner
    qa_box = slide8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(6.05), Inches(11.733), Inches(0.95))
    qa_box.fill.solid()
    qa_box.fill.fore_color.rgb = C_BLUE_LIGHT
    qa_box.line.color.rgb = RGBColor(191, 219, 254)

    tf_qa = qa_box.text_frame
    tf_qa.vertical_anchor = MSO_ANCHOR.MIDDLE
    p1 = tf_qa.paragraphs[0]
    p1.text = "Nhóm 14 xin trân trọng cảm ơn TS. Hoàng Xuân Tùng và Quý Thầy/Cô trong Hội đồng!"
    p1.alignment = PP_ALIGN.CENTER
    p1.font.name = "Arial"
    p1.font.size = Pt(12)
    p1.font.bold = True
    p1.font.color.rgb = C_BLUE_PRIMARY

    p2 = tf_qa.add_paragraph()
    p2.text = "Mời Quý Thầy/Cô và các bạn sinh viên đặt câu hỏi (Q&A Session)"
    p2.alignment = PP_ALIGN.CENTER
    p2.font.name = "Arial"
    p2.font.size = Pt(11)
    p2.font.color.rgb = C_TEXT_MUTED

    add_notes(slide8, 
        "Slide kết luận tổng hợp 4 thành tựu lớn nhất: P99 nộp bài 35.96ms, FAR Rekognition 0%, khôi phục dữ liệu 100% "
        "và chi phí chỉ 12 VNĐ/thí sinh. Nhóm trân trọng cảm ơn Thầy Tùng và mở đầu phiên hỏi đáp."
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    prs.save(output_path)
    print(f"Successfully generated PowerPoint presentation at: {output_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "docs/CloudExam_Final_Presentation.pptx"
    build_presentation(out_file)
