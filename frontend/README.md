# CloudExam — Frontend Web Single Page Application (SPA)

Giao diện người dùng Web Single Page Application (SPA) hiện đại của nền tảng **CloudExam (Hệ thống Khảo thí Trực tuyến Không máy chủ & Đa Đám Mây)**.

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-CSS_v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Production Live](https://img.shields.io/badge/Live_Domain-cloudexam.id.vn-success)](https://cloudexam.id.vn)

---

## 1. TỔNG QUAN KIẾN TRÚC FRONTEND

Ứng dụng được thiết kế theo triết lý **Local-First & Multi-Cloud Ingress**, tối ưu hóa trải nghiệm người dùng với độ trễ phản hồi **0ms**, khả năng phục hồi nguyên vẹn khi đứt kết nối mạng và hỗ trợ đa quốc gia, đa ngôn ngữ.

### Điểm nổi bật về kiến trúc:
1. **Phân quyền 3 Cổng Độc Lập (Role-Based Access Control - RBAC):**
   - **Cổng Giảng viên (`Organizer`):** Quản trị ngân hàng câu hỏi, bóc tách đề thi Word bằng AI, quản trị thí sinh, khởi tạo ca thi và xem bảng điểm.
   - **Cổng Giám thị (`Proctor`):** Bàn Giám thị trực tiếp (`LiveProctorDashboard`), giám sát thí sinh thời gian thực, mở khóa thiết bị thí sinh (`lockedCandidates`), đổi mật khẩu phòng thi và kích hoạt gửi báo cáo điểm số ca thi qua Amazon SNS Topic.
   - **Cổng Thí sinh (`Candidate`):** Đăng nhập tại cổng phòng thi (`CandidateRoomLogin` qua URL `/?exam=<id>`), điểm danh khuôn mặt webcam đối soát Rekognition 1:1, khóa thiết bị chống thi hộ và làm bài thi Local-First.
2. **Cơ chế Phòng thi Local-First (0ms Latency):**
   - Mọi lựa chọn đáp án được ghi tức thì vào `localStorage` của trình duyệt.
   - Đồng bộ nền điều tiết (**Throttled Cloud Sync: mỗi 60 giây hoặc sau 10 câu thay đổi**) kèm cơ chế tự động thử lại (Retry) khi mạng chập chờn.
   - Khôi phục nguyên vẹn 100% bài làm khi thí sinh vô tình ấn F5 hoặc mất kết nối mạng.
3. **Bảo vệ Biên & Chống Gian lận:**
   - **Xác thực sinh trắc học khuôn mặt:** Chụp webcam đối soát với ảnh thẻ gốc lưu trên S3 với độ tương đồng $\ge 80\%$, hiển thị ảnh hồ sơ tham chiếu song song.
   - **Khóa định danh thiết bị (`deviceFingerprint`):** Tự động phát hiện và chặn đứng truy cập từ thiết bị thứ hai hoặc đăng nhập đồng thời.
   - **Lá chắn chống bot Cloudflare Turnstile:** Xác thực người thật tàng hình tại chân trang nộp bài trước khi gửi bài thi vào hàng đợi SQS.
4. **Bảng Xếp Hạng Trực Tiếp (Live Leaderboard):**
   - Widget bảng xếp hạng hiển thị Top điểm số và thứ hạng của thí sinh, truy vấn trực tiếp từ Upstash Serverless Redis với độ trễ `< 5ms`.
5. **Hỗ trợ Đa Quốc Gia & Đa Ngôn Ngữ:**
   - Hỗ trợ 4 ngôn ngữ: Tiếng Việt (`vi`), Tiếng Anh (`en`), Tiếng Lào (`la`), Tiếng Đức (`de`).
   - Tùy biến bộ nhận diện thương hiệu động theo quốc gia: Việt Nam (`vn`), Lào (`la`), Đức (`de`), Mặc định (`default`).

---

## 2. CẤU TRÚC THƯ MỤC NGUỒN FRONTEND

```text
frontend/
├── src/
│   ├── components/                      # Các thành phần màn hình chính
│   │   ├── CandidateRoomLogin.tsx       # Cổng đăng nhập phòng thi cho thí sinh (email + mật khẩu phòng)
│   │   ├── ExamRoom.tsx                 # Màn hình phòng thi Local-First, camera AI & nộp bài
│   │   ├── LiveProctorDashboard.tsx     # Bàn Giám thị: giám sát, mở khóa máy & gửi báo cáo SNS
│   │   ├── ExamSessionTab.tsx           # Quản lý ca thi, cấp link thi & bảng xếp hạng (Giảng viên)
│   │   ├── QuestionBankTab.tsx          # Quản lý ngân hàng câu hỏi & nhập đề Word (Gemini AI)
│   │   ├── CandidatesTab.tsx            # Quản trị hồ sơ thí sinh & đồng bộ ảnh thẻ S3
│   │   ├── LiveLeaderboard.tsx          # Widget bảng xếp hạng Upstash Redis thời gian thực
│   │   ├── TurnstileCaptcha.tsx         # Tích hợp xác thực người thật Cloudflare Turnstile
│   │   ├── SessionResultsModal.tsx      # Modal xem bảng điểm ca thi & phân tích kết quả
│   │   └── Callback.tsx                 # Điểm tiếp nhận OAuth2 Authorization Code PKCE
│   ├── services/                        # Tầng kết nối mạng & Dịch vụ ngoài
│   │   ├── apiService.ts                # Client API kết nối API Gateway (hỗ trợ Dual-Mode & Retry)
│   │   ├── auth.ts                      # Quản lý phiên đăng nhập Cognito PKCE & RBAC
│   │   ├── s3Service.ts                 # Cấp Presigned URL & tải ảnh trực tiếp Direct-to-Storage
│   │   └── domainService.ts             # Tự động nhận diện tên miền và gán Tenant đa quốc gia
│   ├── locales/                         # Bộ từ điển đa ngôn ngữ (i18n Context)
│   │   ├── vi.json                      # Tiếng Việt
│   │   ├── en.json                      # Tiếng Anh
│   │   ├── la.json                      # Tiếng Lào
│   │   ├── de.json                      # Tiếng Đức
│   │   └── i18nContext.tsx              # React Context quản lý ngôn ngữ toàn cục
│   ├── themes/                          # Bộ chủ đề giao diện thương hiệu quốc gia
│   │   ├── vn.ts                        # Theme Việt Nam (Cờ đỏ sao vàng)
│   │   ├── la.ts                        # Theme Lào (Sắc xanh Champa thanh bình)
│   │   ├── de.ts                        # Theme Đức
│   │   ├── default.ts                   # Theme mặc định
│   │   └── themeContext.tsx             # React Context chuyển đổi theme động
│   ├── App.tsx                          # Router điều hướng 3 cổng, xử lý xác thực & header
│   ├── main.tsx                         # Điểm khởi chạy ứng dụng React SPA
│   └── index.css                        # Tailwind CSS styles & animation
├── .env.example                         # File mẫu cấu hình biến môi trường
├── package.json                         # Danh sách thư viện phụ thuộc
├── vite.config.ts                       # Cấu hình máy chủ phát triển Vite & đóng gói
└── tsconfig.json                        # Cấu hình trình biên dịch TypeScript
```

---

## 3. HƯỚNG DẪN CÀI ĐẶT VÀ KHỞI CHẠY

### 3.1. Cài đặt các thư viện phụ thuộc
```bash
cd frontend
npm install
```

### 3.2. Cấu hình biến môi trường (`frontend/.env`)
Sao chép tệp mẫu sang `.env`:
```bash
# Trên Linux/macOS:
cp .env.example .env

# Trên Windows PowerShell:
Copy-Item .env.example .env
```

#### A. Chế độ Mock ngoại tuyến (`VITE_USE_MOCK=true`):
Phục vụ chạy thử nghiệm cục bộ nhanh chóng mà không cần kết nối AWS:
```env
VITE_USE_MOCK=true
```

#### B. Chế độ AWS Live Cloud (`VITE_USE_MOCK=false`):
Kết nối trực tiếp tới hạ tầng AWS đã triển khai bằng Terraform:
```env
VITE_USE_MOCK=false
VITE_AWS_REGION=ap-southeast-1
VITE_API_BASE_URL=https://<API_ID>.execute-api.ap-southeast-1.amazonaws.com/dev
VITE_COGNITO_DOMAIN=https://cloudexam-auth-<ALIAS>-dev.auth.ap-southeast-1.amazoncognito.com
VITE_COGNITO_USER_POOL_ID=ap-southeast-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=<COGNITO_CLIENT_ID>
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
VITE_S3_BUCKET_NAME=cloudexam-storage-<ACCOUNT_ID>-dev
VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAA...
```

### 3.3. Khởi chạy máy chủ phát triển
```bash
npm run dev
```
Mở trình duyệt tại: `http://localhost:5173`

---

## 4. TÀI KHOẢN TRUY CẬP KIỂM THỬ MẶC ĐỊNH

| Cổng Truy Cập | Vai Trò Nghiệp Vụ | Tài Khoản Đăng Nhập | Mật Khẩu | Mô Tả Quyền Hạn |
| :--- | :--- | :--- | :--- | :--- |
| **Bàn Giảng Viên** | Organizer | `annv@uet.vnu.edu.vn` | `12345678` | Quản lý ngân hàng câu hỏi, bóc tách đề Word AI, tạo ca thi, duyệt bảng điểm. |
| **Bàn Giám Thị** | Proctor | `laladoraema@gmail.com` | `12345678` | Mở Bàn Giám thị Live Proctor, mở khóa máy thí sinh, đổi mã phòng, gửi báo cáo SNS. |
| **Cổng Phòng Thi** | Candidate | `tranducmanh2006@gmail.com`<br>*(Trần Đức Mạnh)* | Nhập mã phòng ca thi (vd: `240616`) | Điểm danh khuôn mặt webcam, làm bài thi Local-First, nộp bài qua SQS. |

---

## 5. ĐÓNG GÓI VÀ TRIỂN KHAI PRODUCTION

### 5.1. Kiểm tra kiểu dữ liệu và Build gói tĩnh:
```bash
npm run build
```
Bản build tĩnh được tạo tại thư mục `dist/` với kích thước tối ưu và chuẩn bị sẵn sàng cho CDN Edge Caching.

### 5.2. Tự động đồng bộ lên Amazon S3 & Xóa Cache CloudFront:
Nhóm cung cấp script tự động hóa triển khai:
```bash
python scripts/deploy_frontend.py
```
Script sẽ tự động:
1. Build production gói React SPA (`npm run build`).
2. Tải toàn bộ assets lên S3 Website Hosting Bucket (`cloudexam-frontend-dev`) với cấu hình `Cache-Control` và MIME Types chuẩn xác.
3. Tạo lệnh CloudFront Invalidation (`/*`) để xóa bộ nhớ đệm biên, đưa phiên bản mới nhất đến người dùng trên toàn cầu chỉ trong 30 giây.
4. Trỏ tên miền chính thức: [https://cloudexam.id.vn](https://cloudexam.id.vn).

---

*© 2026 CloudExam Team — VNU University of Engineering and Technology (VNU-UET).*
