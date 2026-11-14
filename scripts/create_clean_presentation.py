import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_presentation(output_path="docs/CloudExam_Final_Presentation.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Clean, professional, high-contrast color palette (NO gaudy gradients or rainbow boxes)
    C_WHITE = RGBColor(255, 255, 255)
    C_BLACK = RGBColor(15, 23, 42)        # Deep Charcoal / Almost Black
    C_TEXT = RGBColor(30, 41, 59)         # Dark slate for body text
    C_MUTED = RGBColor(100, 116, 139)     # Subtle slate for secondary/caption
    C_BLUE = RGBColor(29, 78, 216)        # Standard Royal Blue (accessible, clean)
    C_BLUE_DARK = RGBColor(30, 58, 138)   # Navy Blue
    C_BG_CARD = RGBColor(248, 250, 252)   # Neutral Off-white
    C_BORDER = RGBColor(226, 232, 240)    # Soft clean border
    C_ACCENT_RED = RGBColor(225, 29, 72)  # Rose Red for pain points
    C_ACCENT_GREEN = RGBColor(13, 148, 136) # Teal Green for achievements

    base_img_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "report_images")

    def add_header(slide, title, category="CLOUDEXAM — BÁO CÁO BÀI TẬP LỚN ĐIỆN TOÁN ĐÁM MÂY"):
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

        # Main Title
        t_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.733), Inches(0.65))
        tf_t = t_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_right = tf_t.margin_top = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.name = "Arial"
        p_t.font.size = Pt(26)
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
    # SLIDE 1: BÌA BÁO CÁO (COVER)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)

    # University Header
    u_box = slide1_box = s1.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(11.733), Inches(0.5))
    tf_u = u_box.text_frame
    p_u = tf_u.paragraphs[0]
    p_u.text = "ĐẠI HỌC QUỐC GIA HÀ NỘI — TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)"
    p_u.font.name = "Arial"
    p_u.font.size = Pt(13)
    p_u.font.bold = True
    p_u.font.color.rgb = C_BLUE_DARK

    # Project Title
    t_box = s1.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(11.733), Inches(1.1))
    tf_t = t_box.text_frame
    p_t = tf_t.paragraphs[0]
    p_t.text = "CLOUDEXAM"
    p_t.font.name = "Arial"
    p_t.font.size = Pt(48)
    p_t.font.bold = True
    p_t.font.color.rgb = C_BLACK

    # Subtitle
    sub_box = s1.shapes.add_textbox(Inches(0.8), Inches(2.75), Inches(11.733), Inches(0.6))
    tf_sub = sub_box.text_frame
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = "Nền tảng Khảo thí Trực tuyến Không máy chủ (Serverless Event-Driven) & Đa đám mây"
    p_sub.font.name = "Arial"
    p_sub.font.size = Pt(18)
    p_sub.font.color.rgb = C_BLUE

    # Meta card
    meta = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(3.6), Inches(11.733), Inches(1.0))
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

    # Team members in 4 clear columns
    members = [
        ("Nguyễn Thị Ngọc Hà", "24020115", "Nhóm trưởng", "IaC Terraform & An ninh WAFv2/Cognito"),
        ("Trần Đức Mạnh", "24021561", "Thành viên", "AI Rekognition & SQS Batch Worker"),
        ("Phạm Tuấn Phong", "24021596", "Thành viên", "Frontend Local-First & Test tải Locust"),
        ("Nguyễn Phúc Tấn", "24021620", "Thành viên", "Core API, AI Gemini & Step Functions")
    ]
    mw = Inches(2.75)
    for i, (name, msv, role_title, task) in enumerate(members):
        mx = Inches(0.8) + i * Inches(2.98)
        card = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, mx, Inches(4.9), mw, Inches(2.0))
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
        "Kính thưa Thầy và các bạn, hôm nay Nhóm 14 xin trình bày báo cáo bài tập lớn môn Điện toán đám mây. "
        "Đề tài của nhóm là CloudExam - Nền tảng khảo thí trực tuyến xây dựng theo mô hình Serverless hướng sự kiện trên AWS "
        "kết hợp các dịch vụ vệ tinh Multi-Cloud. Nhóm chúng em gồm 4 thành viên, em là Ngọc Hà - nhóm trưởng phụ trách phần hạ tầng IaC và bảo mật."
    )

    # =========================================================================
    # SLIDE 2: MỤC LỤC (AGENDA)
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Nội dung trình bày")

    agenda = [
        ("1", "Bối cảnh & Bài toán Khảo thí", "3 thách thức thực tế của thi trực tuyến: nghẽn nộp bài giây cuối, gian lận và lãng phí chi phí."),
        ("2", "Kiến trúc Tính năng & Triển khai", "Mô hình Serverless Event-Driven trên AWS và cách bố trí các phân hệ tính năng."),
        ("3", "Giải pháp Kỹ thuật Cốt lõi", "Cơ chế đệm tải SQS, chấm điểm lô Batch 10, CSDL DynamoDB Sparse GSI và phòng thi Local-First."),
        ("4", "Kết quả Thực nghiệm & Đo đạc", "Số liệu chạy test Locust 500 VUs nộp bài giây cuối, độ chính xác AI Rekognition và kiểm toán FinOps $0."),
        ("5", "Quá trình Triển khai & Phân công", "Lịch sử 4 Sprint làm việc, mức độ đóng góp của từng thành viên và hướng mở rộng tương lai.")
    ]

    for i, (num, title, desc) in enumerate(agenda):
        ay = Inches(1.7) + i * Inches(1.05)
        card = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), ay, Inches(11.733), Inches(0.9))
        card.fill.solid()
        card.fill.fore_color.rgb = C_BG_CARD
        card.line.color.rgb = C_BORDER

        tf_a = card.text_frame
        tf_a.margin_left = Inches(0.25)
        tf_a.margin_top = Inches(0.15)
        
        p = tf_a.paragraphs[0]
        p.text = f"{num}. {title}"
        p.font.name = "Arial"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = C_BLUE_DARK

        run = p.add_run()
        run.text = f"  —  {desc}"
        run.font.bold = False
        run.font.size = Pt(13)
        run.font.color.rgb = C_TEXT

    add_notes(s2,
        "Bài trình bày của nhóm gồm 5 phần chính: Đầu tiên là lý do chọn đề tài và bài toán thực tế; "
        "thứ hai là tổng quan kiến trúc hệ thống; thứ ba là đi sâu vào các giải pháp kỹ thuật giải quyết bài toán nghẽn tải; "
        "thứ tư là số liệu đo đạc thực tế có hình ảnh minh chứng; và cuối cùng là tổng kết quá trình làm việc nhóm."
    )

    # =========================================================================
    # SLIDE 3: BỐI CẢNH & 3 BÀI TOÁN LỚN
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Bối cảnh thực tế & 3 Vấn đề của Thi Trực tuyến")

    issues = [
        ("Vấn đề 1: Bão nộp bài giây cuối (Submission Stampede)", 
         "Khi 1.000 đến 5.000 thí sinh cùng bấm nộp bài trong 10 giây cuối ca thi:\n"
         "• Hệ thống Web Server truyền thống (Monolith/VM) bị cạn kiệt Connection Pool.\n"
         "• Cơ sở dữ liệu quan hệ bị nghẽn I/O, phản hồi chậm hoặc timeout 504.\n"
         "• Nguy cơ mất bài thi của sinh viên ở giây phút quan trọng nhất."),
        ("Vấn đề 2: Gian lận và Sự cố Mất kết nối", 
         "Trong các kỳ thi online từ xa:\n"
         "• Rủi ro thi hộ, đổi người làm bài trước camera hoặc chia sẻ tài khoản cho nhau.\n"
         "• Thí sinh dùng F12 Inspect Element để soi cấu trúc đề và đáp án đúng.\n"
         "• Mất mạng Wi-Fi hoặc tắt nhầm tab trình duyệt làm mất trắng toàn bộ bài đang làm."),
        ("Vấn đề 3: Lãng phí Chi phí Máy chủ (FinOps)", 
         "Với kiến trúc máy chủ ảo (EC2 / VM) chạy 24/7:\n"
         "• Phải trả từ $30 - $100 USD/tháng để duy trì máy chủ dù 95% thời gian không có kỳ thi.\n"
         "• Đến giờ thi cao điểm lại không kịp scale-up tự động, gây lãng phí ngân sách trường.")
    ]

    for i, (title, content) in enumerate(issues):
        ix = Inches(0.8) + i * Inches(3.98)
        card = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, ix, Inches(1.7), Inches(3.75), Inches(5.1))
        card.fill.solid()
        card.fill.fore_color.rgb = C_BG_CARD
        card.line.color.rgb = C_BORDER

        tf_i = card.text_frame
        tf_i.margin_left = tf_i.margin_right = Inches(0.25)
        tf_i.margin_top = Inches(0.25)
        
        p = tf_i.paragraphs[0]
        p.text = title
        p.font.name = "Arial"
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = C_BLACK

        p2 = tf_i.add_paragraph()
        p2.text = content
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.color.rgb = C_TEXT

    add_notes(s3,
        "Ở slide này, nhóm muốn làm rõ 3 vấn đề lớn nhất mà các hệ sinh thái thi cử trực tuyến hiện nay như Moodle "
        "hay Google Form hay gặp phải: Thứ nhất là bão nộp bài giây cuối khiến database bị treo; thứ hai là rủi ro thi hộ và mất dữ liệu khi rớt mạng; "
        "và thứ ba là lãng phí tiền thuê server máy ảo khi không có kỳ thi. CloudExam được tạo ra để giải quyết triệt để cả 3 bài toán này."
    )

    # =========================================================================
    # SLIDE 4: GIẢI PHÁP CLOUDEXAM & ĐỐI TƯỢNG SỬ DỤNG
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Tổng quan Giải pháp CloudExam & Người dùng")

    # Left card: Solution core
    sol_box = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.7), Inches(5.6), Inches(5.1))
    sol_box.fill.solid()
    sol_box.fill.fore_color.rgb = C_BG_CARD
    sol_box.line.color.rgb = C_BORDER
    tf_s = sol_box.text_frame
    tf_s.margin_left = tf_s.margin_right = Inches(0.3)
    tf_s.margin_top = Inches(0.25)

    p = tf_s.paragraphs[0]
    p.text = "Mô hình Giải pháp: Serverless Event-Driven"
    p.font.name = "Arial"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p_sol = tf_s.add_paragraph()
    p_sol.text = (
        "• Không dùng máy chủ vật lý hay EC2: 100% tài nguyên do AWS quản lý tự động co giãn.\n\n"
        "• Đệm tải nộp bài qua Amazon SQS: Phản hồi nộp bài thành công trong dưới 50ms, sau đó chấm ngầm theo lô.\n\n"
        "• Hybrid Multi-Cloud tối ưu chi phí: Lấy AWS làm hạt nhân, kết hợp Google Gemini (soạn đề), Upstash Redis (BXH <5ms) và Cloudflare Turnstile (chống bot).\n\n"
        "• Quản lý hạ tầng bằng mã (IaC): Toàn bộ tài nguyên dựng bằng Terraform, triển khai qua GitHub Actions CI/CD."
    )
    p_sol.font.name = "Arial"
    p_sol.font.size = Pt(13)
    p_sol.font.color.rgb = C_TEXT

    # Right card: 3 User Roles
    user_box = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.8), Inches(1.7), Inches(5.733), Inches(5.1))
    user_box.fill.solid()
    user_box.fill.fore_color.rgb = C_WHITE
    user_box.line.color.rgb = C_BORDER
    tf_u = user_box.text_frame
    tf_u.margin_left = tf_u.margin_right = Inches(0.3)
    tf_u.margin_top = Inches(0.25)

    p_u_t = tf_u.paragraphs[0]
    p_u_t.text = "3 Nhóm Người dùng & Nghiệp vụ"
    p_u_t.font.name = "Arial"
    p_u_t.font.size = Pt(16)
    p_u_t.font.bold = True
    p_u_t.font.color.rgb = C_BLACK

    users = [
        ("1. Thí sinh (Candidates)", 
         "Xác thực khuôn mặt webcam 1:1, làm bài phản hồi tức thì với Local-First (<1ms), không lo mất bài khi mất điện/rớt mạng, xem thứ hạng Live Leaderboard."),
        ("2. Giảng viên / Ban ra đề (Instructors)", 
         "Tải file Word đề thi lên để AI tự bóc tách thành câu hỏi, tạo ca thi tự động, xem thống kê điểm trung bình, tỷ lệ đậu và xuất file CSV mở trên Excel."),
        ("3. Giám thị / Cán bộ coi thi (Proctors)", 
         "Nhận mã phòng thi 6 số, giám sát danh sách sinh viên đã điểm danh qua đèn xanh thời gian thực, khóa cứng thiết bị chống thi hộ.")
    ]
    for u_title, u_desc in users:
        pu = tf_u.add_paragraph()
        pu.text = u_title
        pu.font.name = "Arial"
        pu.font.size = Pt(13)
        pu.font.bold = True
        pu.font.color.rgb = C_BLUE

        pud = tf_u.add_paragraph()
        pud.text = u_desc
        pud.font.name = "Arial"
        pud.font.size = Pt(11.5)
        pud.font.color.rgb = C_TEXT

    add_notes(s4,
        "Để giải quyết các bài toán trên, CloudExam chọn hướng tiếp cận Serverless Event-Driven. "
        "Nghĩa là nhóm không thuê máy chủ EC2 nào cả, mà dùng các dịch vụ của AWS tự động mở rộng theo nhu cầu. "
        "Hệ thống phục vụ 3 nhóm người dùng rõ ràng: thí sinh làm bài mượt mà, giảng viên có AI hỗ trợ soạn đề, "
        "và giám thị có màn hình theo dõi trạng thái điểm danh theo thời gian thực."
    )

    # =========================================================================
    # SLIDE 5: KIẾN TRÚC TÍNH NĂNG TỔNG THỂ (HÌNH 2.1)
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Kiến trúc Tính năng Tổng thể (Functional Architecture)")

    # Insert Image 16 (Hình 2.1)
    img16_path = os.path.join(base_img_dir, "image16.png")
    if os.path.exists(img16_path):
        s5.shapes.add_picture(img16_path, Inches(0.8), Inches(1.7), Inches(7.5), Inches(5.1))

    # Right side text card
    r_box = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.5), Inches(1.7), Inches(4.033), Inches(5.1))
    r_box.fill.solid()
    r_box.fill.fore_color.rgb = C_BG_CARD
    r_box.line.color.rgb = C_BORDER
    tf_r = r_box.text_frame
    tf_r.margin_left = tf_r.margin_right = Inches(0.25)
    tf_r.margin_top = Inches(0.2)

    p = tf_r.paragraphs[0]
    p.text = "Luồng dữ liệu Hub-and-Spoke"
    p.font.name = "Arial"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p_body = tf_r.add_paragraph()
    p_body.text = (
        "1. Phân phối biên & Định danh:\n"
        "Truy cập qua CloudFront CDN, tiêm tenant id tại trạm biên (<1ms); xác thực qua Cognito OAuth 2.0 PKCE / OTP.\n\n"
        "2. Điểm danh sinh trắc học:\n"
        "Ảnh webcam đẩy thẳng lên S3 qua Presigned URL (0MB qua backend); Rekognition 1:1 so khớp ảnh thẻ hồ sơ.\n\n"
        "3. Xử lý nộp bài đệm tải:\n"
        "Đẩy bài nộp vào hàng đợi SQS, trả kết quả cho thí sinh trong <50ms. Lambda Worker rút mẻ 10 bài chấm tự động.\n\n"
        "4. Điều phối tự động:\n"
        "Step Functions tự động mở/đóng ca thi và kích hoạt Auto-Finalize cứu bài nháp."
    )
    p_body.font.name = "Arial"
    p_body.font.size = Pt(11)
    p_body.font.color.rgb = C_TEXT

    add_notes(s5,
        "Trên slide là sơ đồ kiến trúc tính năng tổng thể của CloudExam được trích xuất từ báo cáo. "
        "Dòng chảy dữ liệu đi từ trái sang phải: Thí sinh truy cập qua mạng biên CloudFront, điểm danh qua S3 và Rekognition, "
        "khi làm bài và nộp bài thì đi qua hàng đợi SQS để làm đệm tải, sau đó Lambda Worker chấm theo mẻ và đẩy điểm vào Redis."
    )

    # =========================================================================
    # SLIDE 6: KIẾN TRÚC TRIỂN KHAI VẬT LÝ AWS (HÌNH 2.6)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Kiến trúc Triển khai Hạ tầng AWS (Region Singapore)")

    # Insert Image 5 (Hình 2.6)
    img5_path = os.path.join(base_img_dir, "image5.png")
    if os.path.exists(img5_path):
        s6.shapes.add_picture(img5_path, Inches(0.8), Inches(1.7), Inches(7.5), Inches(5.1))

    # Right side text card
    r_box2 = s6.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.5), Inches(1.7), Inches(4.033), Inches(5.1))
    r_box2.fill.solid()
    r_box2.fill.fore_color.rgb = C_BG_CARD
    r_box2.line.color.rgb = C_BORDER
    tf_r2 = r_box2.text_frame
    tf_r2.margin_left = tf_r2.margin_right = Inches(0.25)
    tf_r2.margin_top = Inches(0.2)

    p = tf_r2.paragraphs[0]
    p.text = "Đặc tả Hạ tầng Thực tế"
    p.font.name = "Arial"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = C_BLACK

    p_body2 = tf_r2.add_paragraph()
    p_body2.text = (
        "• Vùng triển khai:\n"
        "AWS Region Singapore (ap-southeast-1).\n\n"
        "• Compute ARM64 Graviton2:\n"
        "3 hàm Lambda chạy Python 3.12 (tiết kiệm 20% chi phí, khởi động lạnh <250ms).\n\n"
        "• Mô hình Direct Serverless Outbound:\n"
        "Lambda gọi Gemini, Upstash và Turnstile bằng HTTPS TLS 1.3 không cần NAT Gateway (tiết kiệm $32.40/tháng).\n\n"
        "• Lưu trữ NoSQL DynamoDB:\n"
        "5 bảng On-Demand (Pay-per-request) tự co giãn không giới hạn.\n\n"
        "• Quản lý trạng thái IaC:\n"
        "34 tài nguyên quản lý bằng Terraform, lưu State trên S3 và khóa Mutex DynamoDB."
    )
    p_body2.font.name = "Arial"
    p_body2.font.size = Pt(11)
    p_body2.font.color.rgb = C_TEXT

    add_notes(s6,
        "Đây là sơ đồ kiến trúc triển khai thực tế trên vùng AWS Singapore. Toàn bộ 34 tài nguyên từ mạng Route 53, "
        "WAFv2, API Gateway, 3 cụm Lambda ARM64 cho đến 5 bảng DynamoDB đều được khai báo 100% bằng Terraform. "
        "Đặc biệt, nhóm triển khai mô hình Direct Outbound để Lambda kết nối ra ngoài mà không phải tốn tiền thuê NAT Gateway."
    )

    # =========================================================================
    # SLIDE 7: ĐỆM TẢI SQS & CHẤM ĐIỂM LÔ
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Giải pháp Kỹ thuật: Đệm tải SQS & Chấm điểm theo Lô")

    # 3 horizontal cards explaining the mechanism
    steps = [
        ("1. Tiếp nhận nộp bài qua SQS (<50ms)", 
         "Khi thí sinh bấm nộp bài:\n\n"
         "• Cổng API Gateway chuyển payload vào hàm Ingestion Producer.\n"
         "• Hàm không tính điểm đồng bộ mà đẩy ngay bài thi vào hàng đợi Amazon SQS (sqs:SendMessage).\n"
         "• Phản hồi ngay HTTP 200 OK cho thí sinh trong dưới 50ms.\n"
         "• Giải phóng kết nối mạng tức thì, thí sinh yên tâm đã nộp bài thành công."),
        ("2. Chấm điểm theo lô (Batch Processing)", 
         "Hàng đợi SQS kích hoạt Lambda Grading Worker:\n\n"
         "• Cấu hình gom mẻ: BatchSize = 10 bài thi, BatchWindow = 2 giây.\n"
         "• Worker gọi duy nhất 1 lệnh dynamodb:BatchGetItem để lấy trọn bộ đáp án chuẩn.\n"
         "• Giảm 90% số lượng request đọc CSDL so với chấm lẻ từng bài.\n"
         "• So khớp đáp án, tính tổng điểm và cập nhật lên Upstash Redis BXH (<5ms)."),
        ("3. Chống mất bài qua Dead-Letter Queue", 
         "Cơ chế an toàn dữ liệu tuyệt đối:\n\n"
         "• Cấu hình Redrive Policy với maxReceiveCount = 3.\n"
         "• Nếu bài thi bị lỗi logic hoặc nghẽn mạng quá 3 lần, SQS tự động chuyển sang hàng đợi SubmissionDLQ.\n"
         "• Lưu giữ bài thi an toàn trong 14 ngày để quản trị viên kiểm tra.\n"
         "• Báo động khẩn qua CloudWatch Alarms khi có bài rơi vào DLQ.")
    ]

    for i, (title, content) in enumerate(steps):
        sx = Inches(0.8) + i * Inches(3.98)
        card = s7.shapes.add_shape(MSO_SHAPE.RECTANGLE, sx, Inches(1.7), Inches(3.75), Inches(5.1))
        card.fill.solid()
        card.fill.fore_color.rgb = C_BG_CARD
        card.line.color.rgb = C_BORDER

        tf_s = card.text_frame
        tf_s.margin_left = tf_s.margin_right = Inches(0.25)
        tf_s.margin_top = Inches(0.25)
        
        p = tf_s.paragraphs[0]
        p.text = title
        p.font.name = "Arial"
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = C_BLUE_DARK

        p2 = tf_s.add_paragraph()
        p2.text = content
        p2.font.name = "Arial"
        p2.font.size = Pt(11.5)
        p2.font.color.rgb = C_TEXT

    add_notes(s7,
        "Slide này mô tả chi tiết giải pháp kỹ thuật cốt lõi giúp hệ thống không bị sập khi có bão nộp bài. "
        "Mấu chốt là nhóm không cho máy chủ chấm điểm ngay lúc thí sinh bấm nộp. Thay vào đó, API chỉ ghi bài thi vào hàng đợi SQS "
        "trong chưa đầy 50 mili-giây rồi báo thành công cho thí sinh. Sau đó, một hàm Worker chạy ngầm rút từng đợt 10 bài ra chấm "
        "bằng duy nhất một lệnh đọc CSDL. Nếu có lỗi quá 3 lần thì bài thi được cất vào hàng đợi DLQ, cam kết không bao giờ bị mất bài."
    )

    # =========================================================================
    # SLIDE 8: THIẾT KẾ DYNAMODB & LOCAL-FIRST
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Giải pháp Kỹ thuật: DynamoDB Sharding & Local-First")

    # Left card: DynamoDB & Sparse GSI
    c1 = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.7), Inches(5.6), Inches(5.1))
    c1.fill.solid()
    c1.fill.fore_color.rgb = C_BG_CARD
    c1.line.color.rgb = C_BORDER
    tf_c1 = c1.text_frame
    tf_c1.margin_left = tf_c1.margin_right = Inches(0.3)
    tf_c1.margin_top = Inches(0.25)

    p1 = tf_c1.paragraphs[0]
    p1.text = "Khắc phục Lỗ hổng Hot Partition DynamoDB"
    p1.font.name = "Arial"
    p1.font.size = Pt(15)
    p1.font.bold = True
    p1.font.color.rgb = C_BLUE_DARK

    p1_b = tf_c1.add_paragraph()
    p1_b.text = (
        "• Giới hạn vật lý của DynamoDB:\n"
        "Mỗi phân vùng chỉ chịu tối đa 1.000 WCU/giây và kích thước mỗi bản ghi không quá 400 KB.\n\n"
        "• Chiến lược Sharding của CloudExam:\n"
        "Tách riêng bài làm của từng thí sinh thành các bản ghi độc lập trên bảng Submissions, không gộp chung vào Session để tránh tràn 400KB.\n\n"
        "• Kỹ thuật Chỉ mục Thưa (Sparse GSI):\n"
        "Chỉ mục SessionResultsIndex chỉ lưu những bản ghi đã có điểm số (score). Nhờ đó Giảng viên truy vấn toàn bộ bảng điểm ca thi trong <10ms mà không tốn chi phí quét toàn bảng (Table Scan)."
    )
    p1_b.font.name = "Arial"
    p1_b.font.size = Pt(12)
    p1_b.font.color.rgb = C_TEXT

    # Right card: Local-First & Throttling
    c2 = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.8), Inches(1.7), Inches(5.733), Inches(5.1))
    c2.fill.solid()
    c2.fill.fore_color.rgb = C_WHITE
    c2.line.color.rgb = C_BORDER
    tf_c2 = c2.text_frame
    tf_c2.margin_left = tf_c2.margin_right = Inches(0.3)
    tf_c2.margin_top = Inches(0.25)

    p2 = tf_c2.paragraphs[0]
    p2.text = "Phòng thi Local-First & Đồng bộ Throttled"
    p2.font.name = "Arial"
    p2.font.size = Pt(15)
    p2.font.bold = True
    p2.font.color.rgb = C_BLACK

    p2_b = tf_c2.add_paragraph()
    p2_b.text = (
        "• Lưu trữ cục bộ Local-First (0ms lag):\n"
        "Mỗi lần thí sinh nhấp chọn đáp án, dữ liệu được ghi tức thì vào localStorage của trình duyệt (<1ms). Không có hiện tượng giật lag xoay vòng chờ mạng.\n\n"
        "• Đồng bộ Throttled Micro-batching:\n"
        "Chỉ khi gom đủ 10 câu thay đổi hoặc sau chu kỳ 60 giây, ứng dụng mới gửi 1 mảng nháp lên DynamoDB. Giảm 90% số lượng request ghi (từ 500.000 xuống ~50.000 requests).\n\n"
        "• Thuật toán Cứu bài tồn (Auto-Finalize):\n"
        "Khi hết giờ, Step Functions đóng ca thi và tự động lấy bài nháp gần nhất của thí sinh bị rớt mạng đưa vào SQS chấm bù, bảo đảm không bị điểm 0 oan."
    )
    p2_b.font.name = "Arial"
    p2_b.font.size = Pt(12)
    p2_b.font.color.rgb = C_TEXT

    add_notes(s8,
        "Ở tầng lưu trữ dữ liệu, nhóm giải quyết 2 bài toán hóc búa của DynamoDB: "
        "Thứ nhất là tránh lỗi Hot Partition và giới hạn 400KB bằng cách tách bài nộp thành các item riêng biệt kết hợp Sparse GSI. "
        "Thứ hai là áp dụng kiến trúc Local-First phía người dùng: sinh viên nhấp chọn là lưu vào máy ngay lập tức, "
        "cứ 60 giây hoặc gom đủ 10 câu mới gửi lên đám mây một lần, giảm tới 90% tải ghi cho cơ sở dữ liệu."
    )

    # =========================================================================
    # SLIDE 9: MINH CHỨNG 1 — KIỂM THỬ TẢI LOCUST (HÌNH 3.1 & 3.2)
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Minh chứng Thực nghiệm 1: Kiểm thử Tải 500 VUs Nộp bài Giây cuối")

    # Left Image 9 (Terminal Locust Output)
    img9_path = os.path.join(base_img_dir, "image9.png")
    if os.path.exists(img9_path):
        s9.shapes.add_picture(img9_path, Inches(0.8), Inches(1.6), Inches(4.5), Inches(5.3))

    # Right Image 13 (CloudWatch SQS Spike)
    img13_path = os.path.join(base_img_dir, "image13.png")
    if os.path.exists(img13_path):
        s9.shapes.add_picture(img13_path, Inches(5.5), Inches(1.6), Inches(6.9), Inches(2.7))

    # Right text summary box below Image 13
    res_box = s9.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.5), Inches(4.5), Inches(6.9), Inches(2.4))
    res_box.fill.solid()
    res_box.fill.fore_color.rgb = C_BG_CARD
    res_box.line.color.rgb = C_BORDER
    tf_res = res_box.text_frame
    tf_res.margin_left = tf_res.margin_right = Inches(0.2)
    tf_res.margin_top = Inches(0.15)

    p = tf_res.paragraphs[0]
    p.text = "Số liệu Thực nghiệm Đo đạc từ Locust & CloudWatch"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p_r = tf_res.add_paragraph()
    p_r.text = (
        "• Tiếp nhận bài thi: 500/500 bài thành công (100.00% HTTP 200 OK), 0 bài rơi vào DLQ.\n"
        "• Độ trễ tiếp nhận: Nhanh nhất 9.22 ms | Trung bình 18.94 ms | Phân vị P99 = 35.96 ms (Vượt xa chuẩn SLA < 50ms).\n"
        "• Đồ thị CloudWatch SQS: Nhận đỉnh nhọn (Spike) 100 messages tại 10:25, sau đó cắm thẳng xuống 0 do Worker tiêu thụ sạch sẽ trong 2.25 giây.\n"
        "• Kết luận: Mẫu hình SQS Load Leveling bảo vệ CSDL tuyệt đối trước bão nộp bài."
    )
    p_r.font.name = "Arial"
    p_r.font.size = Pt(10.5)
    p_r.font.color.rgb = C_TEXT

    add_notes(s9,
        "Đây là slide minh chứng số 1 rất quan trọng. Nhóm đã giả lập 500 thí sinh đồng loạt nộp bài trong 10 giây cuối ca thi bằng Locust. "
        "Kết quả đo được ở hình bên trái: 100% bài nộp thành công, độ trễ phân vị P99 đạt 35.96 mili-giây, nhanh hơn rất nhiều so với cam kết 50 mili-giây. "
        "Đồ thị CloudWatch ở góc trên bên phải cho thấy hàng đợi SQS đã hấp thụ trọn vẹn đỉnh tải nhọn hoắt và giải phóng sạch trong 2 giây."
    )

    # =========================================================================
    # SLIDE 10: MINH CHỨNG 2 — ĐIỂM DANH SINH TRẮC HỌC AI & WAF (HÌNH 3.4 & 3.5)
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "Minh chứng Thực nghiệm 2: Điểm danh AI Rekognition & An ninh WAF")

    # Left Image 17 (Accuracy Confusion Matrix)
    img17_path = os.path.join(base_img_dir, "image17.png")
    if os.path.exists(img17_path):
        s10.shapes.add_picture(img17_path, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.3))

    # Right Image 27 (Face Verify UI in DevTools)
    img27_path = os.path.join(base_img_dir, "image27.jpg")
    if os.path.exists(img27_path):
        s10.shapes.add_picture(img27_path, Inches(6.7), Inches(1.6), Inches(5.8), Inches(3.2))

    # Right text summary box below Image 27
    waf_box = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.7), Inches(5.0), Inches(5.8), Inches(1.9))
    waf_box.fill.solid()
    waf_box.fill.fore_color.rgb = C_BG_CARD
    waf_box.line.color.rgb = C_BORDER
    tf_w = waf_box.text_frame
    tf_w.margin_left = tf_w.margin_right = Inches(0.2)
    tf_w.margin_top = Inches(0.12)

    p = tf_w.paragraphs[0]
    p.text = "Đánh giá An ninh & Sinh trắc học ISO/IEC 19795"
    p.font.name = "Arial"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p_w = tf_w.add_paragraph()
    p_w.text = (
        "• Ngưỡng tương đồng tối ưu: SimilarityThreshold = 80.0%.\n"
        "• Tỷ lệ Chấp nhận Sai (FAR): 0.00% (Chặn đứng 100% các ca thi hộ và ảnh in A4).\n"
        "• Tỷ lệ Từ chối Sai (FRR): 0.00% (Nhận diện chính xác cả khi đeo kính, thiếu sáng).\n"
        "• AWS WAFv2 Web ACL: Chặn thành công 50 requests vượt ngưỡng Rate Limit 100 req/min."
    )
    p_w.font.name = "Arial"
    p_w.font.size = Pt(10)
    p_w.font.color.rgb = C_TEXT

    add_notes(s10,
        "Minh chứng số 2 là bài toán chống gian lận. Nhóm thử nghiệm 20 kịch bản đối soát khuôn mặt với Amazon Rekognition theo chuẩn ISO. "
        "Kết quả ma trận nhầm lẫn ở hình bên trái cho thấy tỷ lệ chấp nhận sai FAR bằng đúng 0%, tức là chặn đứng 100% các trường hợp tráo người hay đưa ảnh in. "
        "Hình bên phải là giao diện thực tế: Thí sinh chụp webcam tải thẳng lên S3, API đối soát phản hồi và khóa cứng định danh thiết bị."
    )

    # =========================================================================
    # SLIDE 11: MINH CHỨNG 3 — PHÒNG THI LOCAL-FIRST & BXH REDIS (HÌNH 3.9 & 3.10)
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "Minh chứng Thực nghiệm 3: Phòng thi Local-First & Live Leaderboard")

    # Left Image 26 (localStorage inspection)
    img26_path = os.path.join(base_img_dir, "image26.jpg")
    if os.path.exists(img26_path):
        s11.shapes.add_picture(img26_path, Inches(0.8), Inches(1.6), Inches(5.6), Inches(3.4))

    # Right Image 24 (Live Leaderboard Widget)
    img24_path = os.path.join(base_img_dir, "image24.jpg")
    if os.path.exists(img24_path):
        s11.shapes.add_picture(img24_path, Inches(6.7), Inches(1.6), Inches(5.8), Inches(3.4))

    # Bottom analysis card spanning full width
    b_box = s11.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(5.2), Inches(11.733), Inches(1.7))
    b_box.fill.solid()
    b_box.fill.fore_color.rgb = C_BG_CARD
    b_box.line.color.rgb = C_BORDER
    tf_b = b_box.text_frame
    tf_b.margin_left = tf_b.margin_right = Inches(0.25)
    tf_b.margin_top = Inches(0.15)

    p = tf_b.paragraphs[0]
    p.text = "Phân tích Trải nghiệm Thực tế của Thí sinh trong Phòng thi"
    p.font.name = "Arial"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLACK

    p_b = tf_b.add_paragraph()
    p_b.text = (
        "• Thử nghiệm Khôi phục sự cố rớt mạng (Hình trái): Khi ngắt Wi-Fi hoàn toàn hoặc ấn F5 tải lại trang, ứng dụng đọc lại localStorage trong 1.2 ms, khôi phục nguyên vẹn 100% các câu trả lời đang làm dở.\n"
        "• Bảng xếp hạng trực tiếp Upstash Redis (Hình phải): Điểm số được Worker cập nhật qua lệnh ZADD với độ trễ < 5ms, hiển thị top dẫn đầu và vị trí của thí sinh mà không phát sinh thêm bất kỳ lượt đọc/ghi nào lên DynamoDB chính."
    )
    p_b.font.name = "Arial"
    p_b.font.size = Pt(11)
    p_b.font.color.rgb = C_TEXT

    add_notes(s11,
        "Slide này chứng minh trải nghiệm mượt mà và an toàn của thí sinh. Hình bên trái chụp lại DevTools: "
        "Khi tắt mạng hay F5 trình duyệt, toàn bộ đáp án được nạp lại từ localStorage trong 1.2 mili-giây, thí sinh không bị mất bài. "
        "Hình bên phải là Bảng xếp hạng trực tiếp trong phòng thi chạy trên Upstash Redis, cập nhật điểm ngay khi nộp với độ trễ dưới 5 mili-giây."
    )

    # =========================================================================
    # SLIDE 12: MINH CHỨNG FINOPS — BÁO CÁO CHI PHÍ AWS (HÌNH 3.11)
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "Quản trị Chi phí Đám mây (FinOps): 0.00 USD Thực tế trên AWS")

    # Left Image 19 (Cost Explorer $0.00)
    img19_path = os.path.join(base_img_dir, "image19.jpg")
    if os.path.exists(img19_path):
        s12.shapes.add_picture(img19_path, Inches(0.8), Inches(1.7), Inches(6.5), Inches(4.8))

    # Right side FinOps calculation card
    fin_box = s12.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.6), Inches(1.7), Inches(4.933), Inches(4.8))
    fin_box.fill.solid()
    fin_box.fill.fore_color.rgb = C_BG_CARD
    fin_box.line.color.rgb = C_BORDER
    tf_f = fin_box.text_frame
    tf_f.margin_left = tf_f.margin_right = Inches(0.25)
    tf_f.margin_top = Inches(0.2)

    p = tf_f.paragraphs[0]
    p.text = "Bài toán Tối ưu Hóa Kinh tế Đám mây"
    p.font.name = "Arial"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p_f = tf_f.add_paragraph()
    p_f.text = (
        "1. Chi phí Thực tế trong quá trình làm đồ án:\n"
        "• Toàn bộ 17 dịch vụ AWS vận hành liên tục (chạy test tải, gọi Lambda, Rekognition, DynamoDB) đều nằm trọn trong AWS Free Tier: Tổng chi phí = $0.00 USD.\n\n"
        "2. Bài toán Khi Triển khai Kỳ thi Lớn (5.000 Thí sinh):\n"
        "• Tính toán Lambda (ARM64): ~$0.35 USD\n"
        "• Ghi/đọc DynamoDB On-Demand: ~$0.85 USD\n"
        "• Hàng đợi Amazon SQS: ~$0.02 USD\n"
        "• Lưu trữ S3 & Băng thông CloudFront: ~$0.65 USD\n"
        "• Đối soát Amazon Rekognition: ~$0.48 USD\n"
        "==> Tổng chi phí toàn ca thi 5.000 thí sinh: ~2.35 USD (~58.000 VNĐ, tức chỉ ~12 VNĐ / thí sinh, tiết kiệm hơn 98% so với in giấy)."
    )
    p_f.font.name = "Arial"
    p_f.font.size = Pt(11)
    p_f.font.color.rgb = C_TEXT

    add_notes(s12,
        "Một trong những điểm nhóm tự hào nhất là quản trị chi phí FinOps. Hình chụp trực tiếp từ AWS Cost Explorer cho thấy "
        "trong suốt quá trình nhóm phát triển và test tải, tổng chi phí phát sinh là đúng 0.00 USD vì tận dụng tối đa gói Free Tier. "
        "Nếu đưa vào tổ chức thi thật cho 5.000 sinh viên, dựa trên bảng tính AWS Pricing Calculator, toàn bộ kỳ thi chỉ tốn khoảng 2.35 USD, "
        "tức là chưa đến 12 đồng một thí sinh, rẻ hơn rất nhiều so với in giấy thi truyền thống."
    )

    # =========================================================================
    # SLIDE 13: QUÁ TRÌNH THỰC HIỆN & ĐÓNG GÓP THÀNH VIÊN
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "Quá trình Triển khai & Mức độ Đóng góp Thành viên")

    # Table of 4 members
    tbl_shape = s13.shapes.add_table(5, 4, Inches(0.8), Inches(1.7), Inches(11.733), Inches(4.5))
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
        p.font.size = Pt(11)
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
            p.font.size = Pt(9.5)
            p.font.color.rgb = C_BLACK
            if c_i == 3:
                p.font.bold = True
                p.alignment = PP_ALIGN.CENTER
                p.font.color.rgb = C_BLUE_DARK

    # Bottom note
    b_note = s13.shapes.add_textbox(Inches(0.8), Inches(6.4), Inches(11.733), Inches(0.4))
    tf_bn = b_note.text_frame
    p = tf_bn.paragraphs[0]
    p.text = "Lịch sử triển khai qua 4 Sprints (07/10 – 15/11/2026). Tỷ lệ đóng góp được cả 4 thành viên đồng thuận tuyệt đối 100% trong phiên họp ngày 14/11/2026."
    p.font.name = "Arial"
    p.font.size = Pt(11)
    p.font.italic = True
    p.font.color.rgb = C_MUTED

    add_notes(s13,
        "Về quá trình làm việc, nhóm đã trải qua 4 Sprint từ đầu tháng 10 đến giữa tháng 11, với hơn 200 lượt commit trên GitHub. "
        "Khối lượng công việc lập trình và viết báo cáo được chia đều cho 4 bạn phụ trách 4 mảng độc lập: Hà phụ trách Hạ tầng và Bảo mật, "
        "Mạnh phụ trách AI và SQS, Phong phụ trách Giao diện Local-First và Test tải, còn Tấn phụ trách Core API và Step Functions. "
        "Tỷ lệ đóng góp được cả nhóm thống nhất 100%."
    )

    # =========================================================================
    # SLIDE 14: KẾT LUẬN & ĐỊNH HƯỚNG MỞ RỘNG (Q&A)
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "Kết luận, Hạn chế & Hướng phát triển")

    # Left card: Key summary
    k_box = s14.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.7), Inches(5.6), Inches(3.9))
    k_box.fill.solid()
    k_box.fill.fore_color.rgb = C_BG_CARD
    k_box.line.color.rgb = C_BORDER
    tf_k = k_box.text_frame
    tf_k.margin_left = tf_k.margin_right = Inches(0.25)
    tf_k.margin_top = Inches(0.2)

    p = tf_k.paragraphs[0]
    p.text = "4 Kết quả Trọng tâm Đạt được"
    p.font.name = "Arial"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = C_BLUE_DARK

    p_k = tf_k.add_paragraph()
    p_k.text = (
        "1. Chống sập hệ thống thành công: Hàng đợi SQS tiếp nhận 500 VUs nộp bài với độ trễ P99 = 35.96 ms, tỷ lệ thành công 100%.\n\n"
        "2. Chống thi hộ và gian lận: Rekognition 1:1 đạt tỷ lệ chặn gian lận FAR = 0%, khóa cứng định danh thiết bị và lọc sạch đáp án F12.\n\n"
        "3. Trải nghiệm thí sinh an toàn: Local-First lưu tức thì (<1ms), không bị mất dữ liệu khi rớt mạng, Step Functions tự cứu bài tồn.\n\n"
        "4. Tối ưu chi phí FinOps: Đưa chi phí nhàn rỗi về 0.00 USD, mở ra giải pháp thi cử tiết kiệm cho nhà trường."
    )
    p_k.font.name = "Arial"
    p_k.font.size = Pt(11)
    p_k.font.color.rgb = C_TEXT

    # Right card: Limitations & Roadmap
    fut_box = s14.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.8), Inches(1.7), Inches(5.733), Inches(3.9))
    fut_box.fill.solid()
    fut_box.fill.fore_color.rgb = C_WHITE
    fut_box.line.color.rgb = C_BORDER
    tf_fut = fut_box.text_frame
    tf_fut.margin_left = tf_fut.margin_right = Inches(0.25)
    tf_fut.margin_top = Inches(0.2)

    p_f_t = tf_fut.paragraphs[0]
    p_f_t.text = "Hạn chế & Hướng phát triển Tương lai"
    p_f_t.font.name = "Arial"
    p_f_t.font.size = Pt(15)
    p_f_t.font.bold = True
    p_f_t.font.color.rgb = C_BLACK

    p_fut = tf_fut.add_paragraph()
    p_fut.text = (
        "• Hạn chế hiện tại:\n"
        "Đối soát Rekognition phụ thuộc chất lượng webcam phòng thi; AI bóc tách đề phụ thuộc đường truyền mạng quốc tế.\n\n"
        "• Hướng mở rộng 1: AI Giám thị thông minh (Proctored AI):\n"
        "Tích hợp mô hình nhận diện tư thế đầu (Head-Pose) và theo dõi ánh mắt (Eye-Tracking) qua luồng WebRTC để phát hiện quay cóp.\n\n"
        "• Hướng mở rộng 2: Kiến trúc Đa vùng (Multi-Region DR):\n"
        "Thiết lập cơ chế tự động chuyển vùng dự phòng (Failover) giữa Singapore và Jakarta qua DynamoDB Global Tables và Route 53."
    )
    p_fut.font.name = "Arial"
    p_fut.font.size = Pt(11)
    p_fut.font.color.rgb = C_TEXT

    # Bottom Thank you & QA banner
    qa = s14.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(5.8), Inches(11.733), Inches(1.0))
    qa.fill.solid()
    qa.fill.fore_color.rgb = C_BLUE_DARK
    qa.line.color.rgb = C_BLUE_DARK
    tf_qa = qa.text_frame
    tf_qa.vertical_anchor = MSO_ANCHOR.MIDDLE
    p_q1 = tf_qa.paragraphs[0]
    p_q1.text = "Nhóm 14 xin trân trọng cảm ơn TS. Hoàng Xuân Tùng và Hội đồng chấm đồ án!"
    p_q1.alignment = PP_ALIGN.CENTER
    p_q1.font.name = "Arial"
    p_q1.font.size = Pt(14)
    p_q1.font.bold = True
    p_q1.font.color.rgb = C_WHITE

    p_q2 = tf_qa.add_paragraph()
    p_q2.text = "Kính mời Thầy và các bạn sinh viên đặt câu hỏi (Q&A Session)"
    p_q2.alignment = PP_ALIGN.CENTER
    p_q2.font.name = "Arial"
    p_q2.font.size = Pt(12)
    p_q2.font.color.rgb = RGBColor(191, 219, 254)

    add_notes(s14,
        "Để kết thúc bài báo cáo, nhóm khẳng định 4 kết quả cốt lõi: xử lý bão nộp bài thành công với P99 dưới 36 mili-giây, "
        "chống gian lận sinh trắc học tin cậy, thí sinh không sợ mất bài và chi phí thực tế 0 đồng. "
        "Nhóm xin trân trọng cảm ơn Thầy Hoàng Xuân Tùng đã tận tình hướng dẫn trong suốt học kỳ vừa qua. "
        "Sau đây nhóm xin kính mời Thầy và Hội đồng đặt câu hỏi đóng góp cho đồ án ạ."
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    prs.save(output_path)
    print(f"Presentation successfully updated at: {output_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "docs/CloudExam_Final_Presentation.pptx"
    create_presentation(out_file)
