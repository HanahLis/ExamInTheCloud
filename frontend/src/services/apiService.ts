import axios from 'axios';

export const isMockMode = (): boolean => {
  if (import.meta.env.VITE_USE_MOCK === 'true') return true;
  const mode = localStorage.getItem('auth_mode');
  if (mode === 'aws') return false;
  if (mode === 'mock') return true;
  const token = localStorage.getItem('id_token');
  if (!token) return true;
  return token.endsWith('.mock-signature-aws') || token.startsWith('mock-');
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cognito Authorizer của API Gateway cần ID Token để giải mã claims (email, cognito:groups)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('id_token');
  if (token && !isMockMode()) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================================
// TYPES & INTERFACES (Đồng bộ với DynamoDB & Lambda Handlers của manh_branch)
// ============================================================================

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';

export interface Question {
  id: string;
  questionId?: string;
  bankId: string;
  content: string;
  type: QuestionType;
  options: string[];      // 4 đáp án A-D
  correctIndex: number;   // vị trí đáp án đúng (0-3)
  correctAnswer?: string; // nội dung đáp án đúng
  score: number;
  subject: string;        // Môn học
  topic: string;          // Chủ đề
  difficulty: Difficulty;
  imageUrl?: string;
  createdAt?: string;
}

export type QuestionInput = Omit<Question, 'id'> & { id?: string };

export interface QuestionBank {
  id: string;
  bankId?: string;
  name: string;
  subject: string;
  description?: string;
  createdAt?: string;
}

export type QuestionBankInput = Omit<QuestionBank, 'id' | 'createdAt'> & { id?: string };

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  s3Key: string;
  message?: string;
}

export interface Candidate {
  studentCode: string;
  name: string;
  email: string;
  className: string;
  faceImageUrl: string;
  createdAt?: string;
}

export type CandidateInput = Candidate;

export type SessionStatus = 'SCHEDULED' | 'RUNNING' | 'CLOSED';

export interface ExamSession {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  questionIds: string[];
  candidateEmails: string[];
  link: string;
  createdAt?: string;
}

export interface FaceVerifyRequest {
  sessionId: string;
  capturedImage?: string; // Chuỗi Base64 chụp từ webcam
  capturedS3Key?: string; // Hoặc S3 key
  email?: string;         // Email thí sinh (nếu không lấy từ ID Token)
  simulateMode?: 'AUTO' | 'FORCE_PASS' | 'FORCE_MISMATCH' | 'FORCE_NO_FACE';
}

export interface FaceVerifyResponse {
  status: 'PASS' | 'FAIL';
  verified: boolean;
  similarity: number;
  message: string;
  candidateName?: string;
}

export interface ExamSubmitRequest {
  sessionId: string;
  answers: Record<string, number>; // { [questionId]: chosenIndex }
  candidateEmail?: string;
}

export interface ExamSubmitResult {
  id: string;
  sessionId: string;
  candidateEmail: string;
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;
  status: string;
}

export interface ExamSubmitResponse {
  message: string;
  result: ExamSubmitResult;
}

// ============================================================================
// LOCAL STORAGE PERSISTENCE HELPERS
// ============================================================================

const loadStored = <T>(key: string, initial: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  } catch {
    return initial;
  }
};

const saveStored = <T>(key: string, data: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Không thể lưu ${key} vào localStorage`, e);
  }
};

// ============================================================================
// SEED MOCK DATA
// ============================================================================

const DEFAULT_QUESTION_BANKS: QuestionBank[] = [
  {
    id: 'bank-cloud-01',
    bankId: 'bank-cloud-01',
    name: 'Ngân hàng Điện toán Đám mây AWS',
    subject: 'Điện toán đám mây',
    description: 'Các câu hỏi về kiến trúc Serverless, DynamoDB, S3, Cognito, API Gateway',
    createdAt: '2026-10-10T12:00:00Z',
  },
  {
    id: 'bank-devops-02',
    bankId: 'bank-devops-02',
    name: 'Ngân hàng Hạ tầng mã nguồn & DevOps',
    subject: 'DevOps & IaC',
    description: 'Câu hỏi về Terraform, CI/CD, tự động hóa hạ tầng AWS',
    createdAt: '2026-10-10T14:00:00Z',
  },
];

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q-aws-001',
    questionId: 'q-aws-001',
    bankId: 'bank-cloud-01',
    content: 'Dịch vụ lưu trữ đối tượng (Object Storage) phổ biến nhất của AWS là gì?',
    type: 'SINGLE_CHOICE',
    options: ['Amazon S3', 'Amazon EBS', 'Amazon EFS', 'AWS Storage Gateway'],
    correctIndex: 0,
    correctAnswer: 'Amazon S3',
    score: 1,
    subject: 'Điện toán đám mây',
    topic: 'Amazon S3 Storage',
    difficulty: 'EASY',
    imageUrl: '',
  },
  {
    id: 'q-aws-002',
    questionId: 'q-aws-002',
    bankId: 'bank-cloud-01',
    content: 'Dịch vụ nào của AWS cung cấp cơ sở dữ liệu NoSQL dạng Key-Value và Document có độ trễ mili-giây đơn?',
    type: 'SINGLE_CHOICE',
    options: ['Amazon Aurora', 'Amazon DynamoDB', 'Amazon Redshift', 'Amazon ElastiCache'],
    correctIndex: 1,
    correctAnswer: 'Amazon DynamoDB',
    score: 1,
    subject: 'Điện toán đám mây',
    topic: 'Amazon DynamoDB NoSQL',
    difficulty: 'EASY',
    imageUrl: '',
  },
  {
    id: 'q-aws-003',
    questionId: 'q-aws-003',
    bankId: 'bank-cloud-01',
    content: 'Mô hình kiến trúc Serverless trên AWS thường kết hợp các dịch vụ nào sau đây cho REST API?',
    type: 'SINGLE_CHOICE',
    options: [
      'EC2 + Auto Scaling + ELB',
      'API Gateway + AWS Lambda + DynamoDB',
      'EKS + RDS + CloudFront',
      'S3 + Route53 + VPC',
    ],
    correctIndex: 1,
    correctAnswer: 'API Gateway + AWS Lambda + DynamoDB',
    score: 2,
    subject: 'Điện toán đám mây',
    topic: 'Serverless Architecture',
    difficulty: 'MEDIUM',
    imageUrl: '',
  },
  {
    id: 'q-aws-004',
    questionId: 'q-aws-004',
    bankId: 'bank-cloud-01',
    content: 'Dịch vụ Amazon Rekognition sử dụng API nào để so sánh khuôn mặt thí sinh với ảnh hồ sơ lưu trên S3?',
    type: 'SINGLE_CHOICE',
    options: ['DetectFaces', 'CompareFaces', 'IndexFaces', 'SearchFacesByImage'],
    correctIndex: 1,
    correctAnswer: 'CompareFaces',
    score: 2,
    subject: 'Điện toán đám mây',
    topic: 'Amazon Rekognition AI',
    difficulty: 'MEDIUM',
    imageUrl: '',
  },
  {
    id: 'q-aws-005',
    questionId: 'q-aws-005',
    bankId: 'bank-cloud-01',
    content: 'Tại sao ứng dụng Single Page Application (SPA React) nên sử dụng Authorization Code kèm PKCE với Cognito?',
    type: 'SINGLE_CHOICE',
    options: [
      'Vì SPA là Public Client chạy trên browser, không thể lưu trữ Client Secret an toàn',
      'Vì PKCE giúp nén kích thước file JavaScript tải nhanh hơn',
      'Vì PKCE bắt buộc phải có máy chủ backend NodeJS trung gian',
      'Vì Cognito không hỗ trợ bất kỳ phương thức đăng nhập nào khác',
    ],
    correctIndex: 0,
    correctAnswer: 'Vì SPA là Public Client chạy trên browser, không thể lưu trữ Client Secret an toàn',
    score: 2,
    subject: 'Điện toán đám mây',
    topic: 'Amazon Cognito & PKCE Security',
    difficulty: 'HARD',
    imageUrl: '',
  },
];

const DEFAULT_CANDIDATES: Candidate[] = [
  {
    studentCode: 'B21DCCN001',
    name: 'Phạm Tuấn Phong',
    email: 'phongpt@example.edu.vn',
    className: 'D21CQCN01-B',
    faceImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    studentCode: 'B21DCCN002',
    name: 'Trần Đức Mạnh',
    email: 'manhtd@example.edu.vn',
    className: 'D21CQCN01-B',
    faceImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    studentCode: 'B21DCCN003',
    name: 'Nguyễn Phúc Tấn',
    email: 'tannp@example.edu.vn',
    className: 'D21CQCN01-B',
    faceImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  {
    studentCode: 'B21DCCN004',
    name: 'Nguyễn Thị Thu Hà',
    email: 'hantt@example.edu.vn',
    className: 'D21CQCN01-B',
    faceImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
  {
    studentCode: 'ORGANIZER-01',
    name: 'Giảng viên CloudExam',
    email: 'organizer@cloudexam.vn',
    className: 'Bộ môn Khoa học Máy tính',
    faceImageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
];

const DEFAULT_SESSIONS: ExamSession[] = [
  {
    id: 'EX20261015001',
    name: 'Thi Cuối Kỳ Điện Toán Đám Mây - Ca 1',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    status: 'RUNNING',
    questionIds: ['q-aws-001', 'q-aws-002', 'q-aws-003', 'q-aws-004', 'q-aws-005'],
    candidateEmails: [
      'phongpt@example.edu.vn',
      'manhtd@example.edu.vn',
      'tannp@example.edu.vn',
      'hantt@example.edu.vn',
      'organizer@cloudexam.vn',
    ],
    link: `${window.location.origin}/?exam=EX20261015001`,
  },
];

const wait = <T>(v: T, ms = 250): Promise<T> =>
  new Promise<T>((resolve) => setTimeout(() => resolve(v), ms));

// ============================================================================
// 1. S3 PRESIGNED URL API (Luồng 4.4 theo đặc tả kiến trúc Giai đoạn 1)
// ============================================================================

export const requestPresignedUrl = async (
  fileName: string,
  contentType: string,
  prefix = 'questions'
): Promise<PresignedUrlResponse> => {
  if (isMockMode()) {
    const ext = fileName.split('.').pop() || 'jpg';
    const key = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    return wait({
      uploadUrl: `https://mock-s3-upload.local/${key}`,
      fileUrl: `https://cloudexam-mock.s3.ap-southeast-1.amazonaws.com/${key}`,
      s3Key: key,
      message: 'Presigned URL mock sinh thành công',
    });
  }

  // Gửi request lên Lambda thông qua API Gateway POST /questions/image-upload
  const res = await api.post('/questions/image-upload', { fileName, contentType, prefix });
  return res.data;
};

// ============================================================================
// 2. QUESTION BANKS APIS (/question-banks)
// ============================================================================

export const getQuestionBanks = async (): Promise<QuestionBank[]> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_question_banks', DEFAULT_QUESTION_BANKS);
    return wait(list);
  }
  const res = await api.get('/question-banks');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];
  return list.map((b: any) => ({
    id: b.id || b.bankId,
    bankId: b.bankId || b.id,
    name: b.name || 'Ngân hàng câu hỏi',
    subject: b.subject || 'Chung',
    description: b.description || '',
    createdAt: b.createdAt,
  }));
};

export const createQuestionBank = async (data: QuestionBankInput): Promise<QuestionBank> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_question_banks', DEFAULT_QUESTION_BANKS);
    const id = data.id || `bank-${Date.now().toString(36)}`;
    const newBank: QuestionBank = {
      ...data,
      id,
      bankId: id,
      createdAt: new Date().toISOString(),
    };
    list.unshift(newBank);
    saveStored('cloudexam_question_banks', list);
    return wait(newBank);
  }
  const res = await api.post('/question-banks', data);
  return res.data;
};

// ============================================================================
// 3. QUESTION APIS (/questions)
// ============================================================================

export const getQuestions = async (): Promise<Question[]> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_questions', DEFAULT_QUESTIONS);
    return wait(list);
  }
  const res = await api.get('/questions');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];
  return list.map((q: any) => ({
    ...q,
    id: q.id ?? q.questionId,
    questionId: q.questionId ?? q.id,
    bankId: q.bankId || 'bank-cloud-01',
    type: q.type || 'SINGLE_CHOICE',
    options: q.options ?? [],
    correctIndex: Number(q.correctIndex ?? 0),
    correctAnswer: q.correctAnswer || (q.options ? q.options[q.correctIndex] : ''),
    score: Number(q.score ?? 1),
    subject: q.subject || 'Điện toán đám mây',
    topic: q.topic || 'AWS Core Services',
    difficulty: q.difficulty || 'EASY',
    imageUrl: q.imageUrl || '',
  }));
};

export const createQuestion = async (data: QuestionInput): Promise<Question> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_questions', DEFAULT_QUESTIONS);
    const id = data.id || `q-${Date.now().toString(36)}`;
    const q: Question = {
      ...data,
      id,
      questionId: id,
      bankId: data.bankId || 'bank-cloud-01',
      type: data.type || 'SINGLE_CHOICE',
      subject: data.subject || 'Điện toán đám mây',
      topic: data.topic || 'AWS Serverless',
      correctAnswer: data.correctAnswer || (data.options[data.correctIndex] || ''),
    };
    list.unshift(q);
    saveStored('cloudexam_questions', list);
    return wait(q);
  }
  const res = await api.post('/questions', data);
  return res.data;
};

export const updateQuestion = async (id: string, data: Partial<QuestionInput>): Promise<any> => {
  if (isMockMode()) {
    let list = loadStored('cloudexam_questions', DEFAULT_QUESTIONS);
    list = list.map((q) => (q.id === id ? { ...q, ...data } : q));
    saveStored('cloudexam_questions', list);
    return wait(true);
  }
  const res = await api.put(`/questions/${id}`, data);
  return res.data;
};

export const deleteQuestion = async (id: string): Promise<any> => {
  if (isMockMode()) {
    let list = loadStored('cloudexam_questions', DEFAULT_QUESTIONS);
    list = list.filter((q) => q.id !== id);
    saveStored('cloudexam_questions', list);
    return wait(true);
  }
  const res = await api.delete(`/questions/${id}`);
  return res.data;
};

// ============================================================================
// 4. CANDIDATES APIS (/candidates)
// ============================================================================

export const getCandidates = async (): Promise<Candidate[]> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_candidates', DEFAULT_CANDIDATES);
    return wait(list);
  }
  const res = await api.get('/candidates');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];
  return list.map((c: any) => ({
    studentCode: c.studentCode || '',
    name: c.name || '',
    email: c.email || '',
    className: c.className || '',
    faceImageUrl: c.faceImageUrl || '',
    createdAt: c.createdAt,
  }));
};

export const createCandidate = async (data: CandidateInput): Promise<Candidate> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_candidates', DEFAULT_CANDIDATES);
    const existingIdx = list.findIndex((c) => c.email.toLowerCase() === data.email.toLowerCase());
    if (existingIdx >= 0) {
      list[existingIdx] = data;
    } else {
      list.unshift(data);
    }
    saveStored('cloudexam_candidates', list);
    return wait(data);
  }
  const res = await api.post('/candidates', data);
  return res.data;
};

export const deleteCandidate = async (email: string): Promise<any> => {
  if (isMockMode()) {
    let list = loadStored('cloudexam_candidates', DEFAULT_CANDIDATES);
    list = list.filter((c) => c.email.toLowerCase() !== email.toLowerCase());
    saveStored('cloudexam_candidates', list);
    return wait(true);
  }
  const res = await api.delete(`/candidates/${encodeURIComponent(email)}`);
  return res.data;
};

// ============================================================================
// 5. EXAM SESSIONS APIS (/sessions)
// ============================================================================

export const getSessions = async (): Promise<ExamSession[]> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_sessions', DEFAULT_SESSIONS);
    return wait(list);
  }
  const res = await api.get('/sessions');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];
  return list.map((s: any) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    status: (s.status as SessionStatus) || 'SCHEDULED',
    questionIds: s.questionIds ?? [],
    candidateEmails: s.candidateEmails ?? [],
    link: s.link || `${window.location.origin}/?exam=${s.id}`,
    createdAt: s.createdAt,
  }));
};

export const getSession = async (id: string): Promise<ExamSession> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_sessions', DEFAULT_SESSIONS);
    const s = list.find((x) => x.id === id);
    if (!s) throw new Error(`Không tìm thấy ca thi #${id}`);
    return wait(s);
  }
  const res = await api.get(`/sessions/${id}`);
  return res.data;
};

export const createSession = async (
  data: Omit<ExamSession, 'id' | 'link' | 'createdAt'> & { id?: string }
): Promise<ExamSession> => {
  if (isMockMode()) {
    const list = loadStored('cloudexam_sessions', DEFAULT_SESSIONS);
    const id = data.id || `EX${Date.now().toString().slice(-8)}`;
    const newSession: ExamSession = {
      ...data,
      id,
      link: `${window.location.origin}/?exam=${id}`,
      createdAt: new Date().toISOString(),
    };
    list.unshift(newSession);
    saveStored('cloudexam_sessions', list);
    return wait(newSession);
  }
  const res = await api.post('/sessions', data);
  return res.data;
};

export const updateSessionStatus = async (id: string, status: SessionStatus): Promise<any> => {
  if (isMockMode()) {
    let list = loadStored('cloudexam_sessions', DEFAULT_SESSIONS);
    list = list.map((s) => (s.id === id ? { ...s, status } : s));
    saveStored('cloudexam_sessions', list);
    return wait({ message: 'Cập nhật thành công', id, status });
  }
  const res = await api.put(`/sessions/${id}`, { status });
  return res.data;
};

export const updateSessionCandidates = async (id: string, candidateEmails: string[]): Promise<any> => {
  if (isMockMode()) {
    let list = loadStored('cloudexam_sessions', DEFAULT_SESSIONS);
    list = list.map((s) => (s.id === id ? { ...s, candidateEmails } : s));
    saveStored('cloudexam_sessions', list);
    return wait({ message: 'Cập nhật danh sách thí sinh ca thi thành công', id, candidateEmails });
  }
  const res = await api.put(`/sessions/${id}`, { candidateEmails });
  return res.data;
};

// ============================================================================
// 6. FACE VERIFICATION API (/auth/face-verify - Amazon Rekognition)
// ============================================================================

export const verifyFace = async (req: FaceVerifyRequest): Promise<FaceVerifyResponse> => {
  if (isMockMode()) {
    await wait(null, 1000); // Giả lập độ trễ Rekognition CompareFaces (1 giây)

    const sessions = loadStored('cloudexam_sessions', DEFAULT_SESSIONS);
    const candidates = loadStored('cloudexam_candidates', DEFAULT_CANDIDATES);

    const session = sessions.find((s) => s.id === req.sessionId);
    if (!session) {
      return {
        status: 'FAIL',
        verified: false,
        similarity: 0,
        message: 'Không tìm thấy ca thi trong cơ sở dữ liệu DynamoDB.',
      };
    }

    // BƯỚC 1 CỦA LAMBDA: Kiểm tra trạng thái ca thi == RUNNING
    if (session.status !== 'RUNNING') {
      return {
        status: 'FAIL',
        verified: false,
        similarity: 0,
        message: `Ca thi chưa bắt đầu hoặc đã kết thúc (Trạng thái hiện tại: ${session.status}). Theo quy chế AWS Lambda, ca thi bắt buộc phải ở trạng thái RUNNING.`,
      };
    }

    // BƯỚC 2 CỦA LAMBDA: Kiểm tra Thí sinh có trong danh sách ca thi không
    const email = req.email || '';
    const isAllowed = session.candidateEmails.some(
      (e) => e.toLowerCase() === email.toLowerCase()
    );
    if (!isAllowed) {
      return {
        status: 'FAIL',
        verified: false,
        similarity: 0,
        message: `Thí sinh (${email}) không nằm trong danh sách được phép tham gia ca thi này. Vui lòng liên hệ Organizer.`,
      };
    }

    // BƯỚC 3 CỦA LAMBDA: Lấy ảnh mẫu gốc của thí sinh từ DynamoDB/S3
    const candidate = candidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (!candidate || !candidate.faceImageUrl) {
      return {
        status: 'FAIL',
        verified: false,
        similarity: 0,
        message: 'Chưa có ảnh khuôn mặt mẫu của thí sinh trong hồ sơ S3. Vui lòng liên hệ Organizer.',
      };
    }

    // BƯỚC 4: Kiểm tra ảnh chụp từ camera
    if (!req.capturedImage) {
      return {
        status: 'FAIL',
        verified: false,
        similarity: 0,
        message: 'Thiếu dữ liệu ảnh khuôn mặt chụp từ webcam.',
      };
    }

    // BƯỚC 5 CỦA LAMBDA: Phân tích và So khớp khuôn mặt (Amazon Rekognition CompareFaces)
    if (req.simulateMode === 'FORCE_NO_FACE') {
      return {
        status: 'FAIL',
        verified: false,
        similarity: 0,
        message: 'Amazon Rekognition: Không phát hiện được khuôn mặt trong ảnh webcam. Hãy nhìn thẳng vào camera và bật đủ đèn.',
      };
    }

    if (req.simulateMode === 'FORCE_MISMATCH') {
      const sim = Math.floor(45 + Math.random() * 20); // 45% - 64%
      return {
        status: 'FAIL',
        verified: false,
        similarity: sim,
        message: `Xác thực khuôn mặt thất bại. Độ tương đồng (${sim}% < 80%). Khuôn mặt không khớp với hồ sơ thí sinh.`,
      };
    }

    // Mặc định hoặc FORCE_PASS: Kết quả tương đồng cao đạt chuẩn
    const baseSim = 91.5 + (Math.random() * 5.5);
    const similarity = parseFloat(baseSim.toFixed(1));

    return {
      status: 'PASS',
      verified: true,
      similarity,
      candidateName: candidate.name,
      message: `Xác thực sinh trắc học thành công (${similarity}% >= 80%). Chào mừng thí sinh ${candidate.name} vào phòng thi!`,
    };
  }

  const res = await api.post('/auth/face-verify', req);
  return res.data;
};

// ============================================================================
// 7. EXAM SUBMISSION API (/exam/submit)
// ============================================================================

export const submitExam = async (req: ExamSubmitRequest): Promise<ExamSubmitResponse> => {
  if (isMockMode()) {
    await wait(null, 700);

    const questions = loadStored('cloudexam_questions', DEFAULT_QUESTIONS);
    const sessions = loadStored('cloudexam_sessions', DEFAULT_SESSIONS);
    const session = sessions.find((s) => s.id === req.sessionId);

    const targetQuestions = session
      ? questions.filter((q) => session.questionIds.includes(q.id))
      : questions;

    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;

    targetQuestions.forEach((q) => {
      maxScore += q.score;
      const chosenIdx = req.answers[q.id];
      if (chosenIdx !== undefined && chosenIdx === q.correctIndex) {
        totalScore += q.score;
        correctCount += 1;
      }
    });

    const result: ExamSubmitResult = {
      id: `${req.sessionId}#${req.candidateEmail || 'user'}`,
      sessionId: req.sessionId,
      candidateEmail: req.candidateEmail || 'candidate@example.edu.vn',
      score: totalScore,
      maxScore,
      correctCount,
      totalQuestions: targetQuestions.length,
      submittedAt: new Date().toISOString(),
      status: 'COMPLETED',
    };

    // Lưu kết quả nộp bài vào localStorage
    const savedResults = loadStored<ExamSubmitResult[]>('cloudexam_results', []);
    savedResults.unshift(result);
    saveStored('cloudexam_results', savedResults);

    return {
      message: 'Nộp bài thi thành công! Điểm đã được chấm và lưu vào DynamoDB.',
      result,
    };
  }

  const res = await api.post('/exam/submit', req);
  return res.data;
};

export default api;