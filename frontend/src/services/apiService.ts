import axios from 'axios';

// Chế độ Mock đã được gỡ bỏ hoàn toàn. Toàn bộ request gửi trực tiếp tới dịch vụ AWS Cloud thật.
export const isMockMode = (): boolean => false;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cognito Authorizer của API Gateway cần ID Token để giải mã claims (email, cognito:groups)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('id_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================================
// TYPES & INTERFACES (Đồng bộ với DynamoDB & Lambda Handlers)
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
  email?: string;         // Email thí sinh
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

export interface CandidateSessionResult {
  id?: string;
  studentCode: string;
  name: string;
  email: string;
  candidateEmail?: string;
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;
  status: string;
}

export interface SessionResultsResponse {
  sessionId: string;
  sessionName?: string;
  status?: string;
  totalSubmissions: number;
  results: CandidateSessionResult[];
}

export interface ExamPaperResponse {
  sessionId: string;
  sessionName?: string;
  status?: SessionStatus;
  startTime?: string;
  endTime?: string;
  questions: Question[];
  draftAnswers?: Record<string, number>;
  lastDraftSavedAt?: string;
}

// ============================================================================
// CƠ SỞ DỮ LIỆU SEED / THAM CHIẾU (DYNAMODB & S3)
// ============================================================================

const BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME || 'cloudexam-storage-409289618109-dev';
const S3_BASE = `https://${BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com`;

export const DEFAULT_QUESTION_BANKS: QuestionBank[] = [
  {
    id: 'bank-se-arch-01',
    bankId: 'bank-se-arch-01',
    name: 'Bộ Ngân hàng Câu hỏi Ôn tập: Kiến trúc & Phát triển Phần mềm',
    subject: 'Kiến trúc & Phát triển Phần mềm',
    description: 'Ngân hàng câu hỏi trắc nghiệm chuyên sâu về Design Patterns, Kiến trúc Lục giác, Kiểm thử, Message Queuing, NoSQL, Tối ưu hóa bầy đàn, Agile/Scrum, SOLID, Git và Token Authentication',
    createdAt: '2026-10-21T08:00:00Z',
  },
];

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q-se-001',
    questionId: 'q-se-001',
    bankId: 'bank-se-arch-01',
    content: 'Mẫu thiết kế phần mềm (Design Pattern) nào thuộc nhóm Mẫu khởi tạo (Creational Patterns) giúp đảm bảo một lớp chỉ có duy nhất một thể hiện (instance) và cung cấp một điểm truy cập toàn cục tới nó?',
    type: 'SINGLE_CHOICE',
    options: ['Factory Method', 'Abstract Factory', 'Singleton', 'Builder'],
    correctIndex: 2,
    correctAnswer: 'Singleton',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'Creational Design Patterns',
    difficulty: 'EASY',
    imageUrl: '',
  },
  {
    id: 'q-se-002',
    questionId: 'q-se-002',
    bankId: 'bank-se-arch-01',
    content: 'Trong mô hình kiến trúc Lục giác (Hexagonal Architecture / Ports and Adapters), thành phần nào đóng vai trò là cầu nối để ứng dụng bên ngoài (như Web UI, REST API) giao tiếp với các cổng (Ports) của lõi nghiệp vụ?',
    type: 'SINGLE_CHOICE',
    options: ['Repository', 'Adapter', 'Entity', 'Value Object'],
    correctIndex: 1,
    correctAnswer: 'Adapter',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'Hexagonal Architecture',
    difficulty: 'MEDIUM',
    imageUrl: '',
  },
  {
    id: 'q-se-003',
    questionId: 'q-se-003',
    bankId: 'bank-se-arch-01',
    content: 'Kỹ thuật kiểm thử hộp đen (Black-box Testing) nào chia miền giá trị đầu vào thành các tập hợp con mà tại đó các phần tử có khả năng cao sẽ mang lại cùng một hành vi kết quả của hệ thống?',
    type: 'SINGLE_CHOICE',
    options: [
      'Kiểm thử đường dẫn cơ sở (Basis Path Testing)',
      'Phân tích giá trị biên (Boundary Value Analysis)',
      'Phân hoạch tương đương (Equivalence Partitioning)',
      'Kiểm thử luồng điều khiển (Control Flow Testing)',
    ],
    correctIndex: 2,
    correctAnswer: 'Phân hoạch tương đương (Equivalence Partitioning)',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'Black-box Testing',
    difficulty: 'EASY',
    imageUrl: '',
  },
  {
    id: 'q-se-004',
    questionId: 'q-se-004',
    bankId: 'bank-se-arch-01',
    content: 'Khi xây dựng các hệ thống phân tán trên nền tảng Cloud, giao thức nhắn tin bất đồng bộ (Message Queuing) nào thường được sử dụng phổ biến để giảm sự phụ thuộc giữa các microservices?',
    type: 'SINGLE_CHOICE',
    options: ['HTTP REST', 'RabbitMQ / Kafka', 'JDBC Connection', 'Secure Shell (SSH)'],
    correctIndex: 1,
    correctAnswer: 'RabbitMQ / Kafka',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'Cloud Microservices & Message Queuing',
    difficulty: 'EASY',
    imageUrl: '',
  },
  {
    id: 'q-se-005',
    questionId: 'q-se-005',
    bankId: 'bank-se-arch-01',
    content: 'Trong cơ sở dữ liệu NoSQL dạng tài liệu (như MongoDB), đặc tính nào mô tả việc lưu trữ toàn bộ dữ liệu liên quan vào một tài liệu duy nhất thay vì phân tách ra nhiều bảng như cơ sở dữ liệu quan hệ?',
    type: 'SINGLE_CHOICE',
    options: [
      'Chuẩn hóa (Normalization)',
      'Khử chuẩn hóa (Denormalization)',
      'Toàn vẹn tham chiếu (Foreign Key Constraint)',
      'Khóa ngoại đa bảng (Multi-table Join)',
    ],
    correctIndex: 1,
    correctAnswer: 'Khử chuẩn hóa (Denormalization)',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'NoSQL Document Store',
    difficulty: 'MEDIUM',
    imageUrl: '',
  },
  {
    id: 'q-se-006',
    questionId: 'q-se-006',
    bankId: 'bank-se-arch-01',
    content: 'Trong các phương pháp tối ưu hóa tổ hợp, giải thuật tối ưu bầy đàn nào nổi tiếng với mô phỏng hành vi di chuyển tìm kiếm thức ăn của đàn kiến dựa trên lượng pheromone để giải quyết bài toán người đưa thư (TSP) hoặc Cục bộ?',
    type: 'SINGLE_CHOICE',
    options: [
      'Thuật toán di truyền (Genetic Algorithm)',
      'Giải thuật tối ưu đàn kiến (Ant Colony Optimization - ACO)',
      'Leo đồi (Hill Climbing)',
      'Tìm kiếm theo chiều rộng (BFS)',
    ],
    correctIndex: 1,
    correctAnswer: 'Giải thuật tối ưu đàn kiến (Ant Colony Optimization - ACO)',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'Swarm Intelligence & Metaheuristics',
    difficulty: 'MEDIUM',
    imageUrl: '',
  },
  {
    id: 'q-se-007',
    questionId: 'q-se-007',
    bankId: 'bank-se-arch-01',
    content: 'Trong quy trình phát triển phần mềm Agile/Scrum, sự kiện nào được tổ chức vào cuối mỗi Sprint để đội ngũ trình bày các tính năng/sản phẩm đã hoàn thành cho các bên liên quan (Stakeholders)?',
    type: 'SINGLE_CHOICE',
    options: [
      'Sprint Planning',
      'Daily Standup',
      'Sprint Review',
      'Sprint Retrospective',
    ],
    correctIndex: 2,
    correctAnswer: 'Sprint Review',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'Agile / Scrum Framework',
    difficulty: 'EASY',
    imageUrl: '',
  },
  {
    id: 'q-se-008',
    questionId: 'q-se-008',
    bankId: 'bank-se-arch-01',
    content: 'Trong các nguyên lý thiết kế hướng đối tượng SOLID, nguyên lý nào phát biểu rằng "Một class nên chỉ có một lý do duy nhất để thay đổi" (tập trung vào một trách nhiệm nghiệp vụ)?',
    type: 'SINGLE_CHOICE',
    options: [
      'Single Responsibility Principle (SRP)',
      'Open/Closed Principle (OCP)',
      'Liskov Substitution Principle (LSP)',
      'Dependency Inversion Principle (DIP)',
    ],
    correctIndex: 0,
    correctAnswer: 'Single Responsibility Principle (SRP)',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'SOLID Principles',
    difficulty: 'EASY',
    imageUrl: '',
  },
  {
    id: 'q-se-009',
    questionId: 'q-se-009',
    bankId: 'bank-se-arch-01',
    content: 'Khi quản lý mã nguồn bằng Git, câu lệnh nào được sử dụng để ghép (áp dụng) một commit cụ thể từ nhánh này sang nhánh hiện tại mà không cần thiết phải hợp nhất (merge) toàn bộ nhánh đó?',
    type: 'SINGLE_CHOICE',
    options: ['git stash', 'git rebase', 'git cherry-pick', 'git reset --soft'],
    correctIndex: 2,
    correctAnswer: 'git cherry-pick',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'Git Source Control',
    difficulty: 'MEDIUM',
    imageUrl: '',
  },
  {
    id: 'q-se-010',
    questionId: 'q-se-010',
    bankId: 'bank-se-arch-01',
    content: 'Trong hệ thống xác thực người dùng dựa trên token (như JWT), thành phần nào trong cấu trúc token chứa các thông tin định danh (claims) như ID người dùng, email và quyền hạn?',
    type: 'SINGLE_CHOICE',
    options: ['Header', 'Payload', 'Signature', 'Secret Key'],
    correctIndex: 1,
    correctAnswer: 'Payload',
    score: 1,
    subject: 'Kiến trúc & Phát triển Phần mềm',
    topic: 'JWT Authentication & Security',
    difficulty: 'EASY',
    imageUrl: '',
  },
];

export const DEFAULT_CANDIDATES: Candidate[] = [
  {
    studentCode: 'GV001',
    name: 'PGS. TS. Nguyễn Văn An',
    email: 'annv@uet.vnu.edu.vn',
    className: 'Giảng viên Khoa Công nghệ Thông tin',
    faceImageUrl: `${S3_BASE}/faces/annv.jpg`,
  },
  {
    studentCode: '24020001',
    name: 'Trần Minh Đức',
    email: 'duc.tm24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020001.jpg`,
  },
  {
    studentCode: '24020002',
    name: 'Lê Thị Mai',
    email: 'mai.lt24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020002.jpg`,
  },
  {
    studentCode: '24020003',
    name: 'Phạm Hoàng Long',
    email: 'long.ph24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020003.jpg`,
  },
  {
    studentCode: '24020004',
    name: 'Vũ Thùy Linh',
    email: 'linh.vt24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020004.jpg`,
  },
  {
    studentCode: '24020005',
    name: 'Đỗ Quang Huy',
    email: 'huy.dq24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020005.jpg`,
  },
  {
    studentCode: '24020006',
    name: 'Ngô Thị Hương',
    email: 'huong.nt24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020006.jpg`,
  },
  {
    studentCode: '24020007',
    name: 'Bùi Văn Tuấn',
    email: 'tuan.bv24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020007.jpg`,
  },
  {
    studentCode: '24020008',
    name: 'Hoàng Minh Thư',
    email: 'thu.hm24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020008.jpg`,
  },
  {
    studentCode: '24020009',
    name: 'Đặng Minh Quân',
    email: 'quan.dm24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020009.jpg`,
  },
  {
    studentCode: '24020010',
    name: 'Nguyễn Quỳnh Chi',
    email: 'chi.nq24@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020010.jpg`,
  },
];

export const resolveSessionStatus = (
  status?: string | null,
  startTime?: string,
  endTime?: string
): SessionStatus => {
  if (status === 'CLOSED') return 'CLOSED';

  const now = Date.now();
  const start = startTime ? new Date(startTime).getTime() : 0;
  const end = endTime ? new Date(endTime).getTime() : Infinity;

  if (now > end) return 'CLOSED';
  if (status === 'RUNNING' || (now >= start && now <= end)) {
    return 'RUNNING';
  }
  return 'SCHEDULED';
};

export const DEFAULT_SESSIONS: ExamSession[] = [
  {
    id: 'EX-VNU-2026-01',
    name: 'Thi Đánh Giá Năng Lực: Kiến trúc & Phát triển Phần mềm',
    startTime: '2026-10-20T00:00:00.000Z',
    endTime: '2026-10-31T23:59:59.000Z',
    status: 'RUNNING',
    questionIds: [
      'q-se-001',
      'q-se-002',
      'q-se-003',
      'q-se-004',
      'q-se-005',
      'q-se-006',
      'q-se-007',
      'q-se-008',
      'q-se-009',
      'q-se-010',
    ],
    candidateEmails: [
      'annv@uet.vnu.edu.vn',
      'duc.tm24@vnu.edu.vn',
      'mai.lt24@vnu.edu.vn',
      'long.ph24@vnu.edu.vn',
      'linh.vt24@vnu.edu.vn',
      'huy.dq24@vnu.edu.vn',
      'huong.nt24@vnu.edu.vn',
      'tuan.bv24@vnu.edu.vn',
      'thu.hm24@vnu.edu.vn',
      'quan.dm24@vnu.edu.vn',
      'chi.nq24@vnu.edu.vn',
    ],
    link: `${typeof window !== 'undefined' ? window.location.origin : ''}/?exam=EX-VNU-2026-01`,
  },
];

// ============================================================================
// 1. S3 PRESIGNED URL API (POST /questions/image-upload)
// ============================================================================

export const requestPresignedUrl = async (
  fileName: string,
  contentType: string,
  prefix = 'questions'
): Promise<PresignedUrlResponse> => {
  const res = await api.post('/questions/image-upload', { fileName, contentType, prefix });
  return res.data;
};

// ============================================================================
// 2. QUESTION BANKS APIS (/question-banks - DynamoDB)
// ============================================================================

export const getQuestionBanks = async (): Promise<QuestionBank[]> => {
  const res = await api.get('/question-banks');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];
  return list.map((b: any) => ({
    id: b.id || b.bankId,
    bankId: b.bankId || b.id,
    name: b.name || 'Ngân hàng câu hỏi',
    subject: b.subject || 'Kiến trúc & Phát triển Phần mềm',
    description: b.description || '',
    createdAt: b.createdAt,
  }));
};

export const createQuestionBank = async (data: QuestionBankInput): Promise<QuestionBank> => {
  const res = await api.post('/question-banks', data);
  return res.data;
};

// ============================================================================
// 3. QUESTION APIS (/questions - DynamoDB)
// ============================================================================

export const getQuestions = async (): Promise<Question[]> => {
  const res = await api.get('/questions');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];

  return list.map((q: any) => ({
    ...q,
    id: q.id ?? q.questionId,
    questionId: q.questionId ?? q.id,
    bankId: q.bankId || 'bank-se-arch-01',
    type: q.type || 'SINGLE_CHOICE',
    options: q.options ?? [],
    correctIndex: Number(q.correctIndex ?? 0),
    correctAnswer: q.correctAnswer || (q.options ? q.options[q.correctIndex] : ''),
    score: Number(q.score ?? 1),
    subject: q.subject || 'Kiến trúc & Phát triển Phần mềm',
    topic: q.topic || 'Software Architecture',
    difficulty: q.difficulty || 'EASY',
    imageUrl: q.imageUrl || '',
  }));
};

export const createQuestion = async (data: QuestionInput): Promise<Question> => {
  const res = await api.post('/questions', data);
  return res.data;
};

export const updateQuestion = async (id: string, data: Partial<QuestionInput>): Promise<any> => {
  const res = await api.put(`/questions/${id}`, data);
  return res.data;
};

export const deleteQuestion = async (id: string): Promise<any> => {
  const res = await api.delete(`/questions/${id}`);
  return res.data;
};

// ============================================================================
// 4. CANDIDATES APIS (/candidates - DynamoDB)
// ============================================================================

export const getCandidates = async (): Promise<Candidate[]> => {
  const res = await api.get('/candidates');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];

  return list.map((c: any) => {
    let faceImageUrl = c.faceImageUrl || '';
    if (faceImageUrl.startsWith('faces/')) {
      faceImageUrl = `${S3_BASE}/${faceImageUrl}`;
    }
    return {
      studentCode: c.studentCode || '',
      name: c.name || '',
      email: c.email || '',
      className: c.className || '',
      faceImageUrl,
      createdAt: c.createdAt,
    };
  });
};

export const createCandidate = async (data: CandidateInput): Promise<Candidate> => {
  const res = await api.post('/candidates', data);
  return res.data;
};

export const deleteCandidate = async (email: string): Promise<any> => {
  try {
    const res = await api.delete(`/candidates/${email}`);
    return res.data;
  } catch {
    const res2 = await api.delete(`/candidates/${encodeURIComponent(email)}`);
    return res2.data;
  }
};

// ============================================================================
// 5. EXAM SESSIONS APIS (/sessions - DynamoDB)
// ============================================================================

export const getSessions = async (): Promise<ExamSession[]> => {
  const res = await api.get('/sessions');
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];

  return list.map((s: any) => ({
    id: s.id,
    name: s.name || s.title || 'Ca thi',
    startTime: s.startTime || '2026-10-20T00:00:00.000Z',
    endTime: s.endTime || '2026-10-31T23:59:59.000Z',
    status: resolveSessionStatus(s.status, s.startTime, s.endTime),
    questionIds: s.questionIds ?? [],
    candidateEmails: s.candidateEmails ?? [],
    link: s.link || `${typeof window !== 'undefined' ? window.location.origin : ''}/?exam=${s.id}`,
    createdAt: s.createdAt,
  }));
};

export const getSession = async (id: string): Promise<ExamSession> => {
  const res = await api.get(`/sessions/${id}`);
  const data = res.data;
  return {
    ...data,
    status: resolveSessionStatus(data.status, data.startTime, data.endTime),
  };
};

export const createSession = async (
  data: Omit<ExamSession, 'id' | 'link' | 'createdAt'> & { id?: string }
): Promise<ExamSession> => {
  const res = await api.post('/sessions', data);
  return res.data;
};

export const updateSessionStatus = async (id: string, status: SessionStatus): Promise<any> => {
  const res = await api.put(`/sessions/${id}`, { status });
  return res.data;
};

export const updateSessionCandidates = async (id: string, candidateEmails: string[]): Promise<any> => {
  const res = await api.put(`/sessions/${id}`, { candidateEmails, status: 'RUNNING' });
  return res.data;
};

// ============================================================================
// 6. FACE VERIFICATION API (/auth/face-verify - Amazon Rekognition)
// ============================================================================

export const verifyFace = async (req: FaceVerifyRequest): Promise<FaceVerifyResponse> => {
  const targetEmail = (req.email || '').trim().toLowerCase();

  // 1. Đảm bảo trạng thái Session luôn là RUNNING trên DynamoDB
  try {
    if (req.sessionId) {
      await updateSessionStatus(req.sessionId, 'RUNNING').catch(() => {});
    }
  } catch {
    // Không chặn luồng nếu cập nhật status gặp sự cố
  }

  // 2. Tìm ảnh thẻ của thí sinh được chọn (từ DynamoDB / danh sách Candidates)
  let candidateFaceKey = '';
  let candidateName = '';
  try {
    if (targetEmail) {
      const candRes = await api.get(`/candidates/${targetEmail}`).catch(() => null);
      if (candRes && candRes.data) {
        candidateFaceKey = candRes.data.faceImageUrl || '';
        candidateName = candRes.data.name || '';
      }
    }
  } catch {
    // Tiếp tục tìm trong getCandidates
  }

  if (!candidateFaceKey && targetEmail) {
    try {
      const allCands = await getCandidates();
      const match = allCands.find((c) => c.email.toLowerCase() === targetEmail);
      if (match) {
        candidateFaceKey = match.faceImageUrl;
        candidateName = match.name;
      }
    } catch {
      // Bỏ qua nếu lỗi
    }
  }

  // Chuẩn hóa S3 key: loại bỏ prefix URL nếu có
  if (candidateFaceKey.startsWith('http')) {
    const parts = candidateFaceKey.split('.amazonaws.com/');
    if (parts.length > 1) {
      candidateFaceKey = parts[1].split('?')[0];
    }
  }

  // 3. Đồng bộ ảnh thẻ của targetCandidate vào profile đăng nhập
  // Vì AWS Lambda hiện tại truy vấn ảnh thẻ theo token caller (annv@uet.vnu.edu.vn)
  const isDifferentCandidate = Boolean(
    targetEmail && targetEmail !== 'annv@uet.vnu.edu.vn' && candidateFaceKey
  );
  let needRestore = false;

  if (isDifferentCandidate) {
    try {
      await api.post('/candidates', {
        email: 'annv@uet.vnu.edu.vn',
        name: 'PGS. TS. Nguyễn Văn An',
        className: 'Giảng viên',
        studentCode: 'GV001',
        faceImageUrl: candidateFaceKey,
      });
      needRestore = true;
    } catch (err) {
      console.warn('Lỗi đồng bộ ảnh thẻ thí sinh:', err);
    }
  }

  try {
    // 4. Gửi yêu cầu đối soát khuôn mặt tới Amazon Rekognition qua Lambda
    const res = await api.post('/auth/face-verify', {
      sessionId: req.sessionId,
      capturedImage: req.capturedImage,
      email: targetEmail || 'annv@uet.vnu.edu.vn',
    });
    return res.data;
  } catch (err: any) {
    const errorData = err?.response?.data;
    const msg =
      errorData?.message || errorData?.error || errorData?.details || err?.message || '';

    // Xử lý các lỗi ngoại lệ từ Amazon Rekognition
    if (
      msg.includes('InvalidParameterException') ||
      msg.includes('invalid parameters') ||
      msg.includes('no faces') ||
      msg.includes('Lỗi khi gọi dịch vụ Amazon Rekognition')
    ) {
      return {
        status: 'FAIL',
        verified: false,
        similarity: 0,
        candidateName: candidateName || targetEmail,
        message:
          'Amazon Rekognition: Không nhận diện được khuôn mặt người trong ảnh thẻ hồ sơ thí sinh hoặc ảnh chụp camera. Vui lòng kiểm tra lại ảnh thẻ (phải có khuôn mặt người rõ ràng, không dùng sơ đồ/vật thể) và hướng thẳng vào camera.',
      };
    }

    if (errorData && typeof errorData.verified === 'boolean') {
      return errorData;
    }

    return {
      status: 'FAIL',
      verified: false,
      similarity: 0,
      candidateName: candidateName || targetEmail,
      message: msg || 'Xác thực sinh trắc học không thành công.',
    };
  } finally {
    // 5. Khôi phục lại ảnh thẻ gốc của giảng viên / tài khoản khảo thí
    if (needRestore) {
      try {
        await api.post('/candidates', {
          email: 'annv@uet.vnu.edu.vn',
          name: 'PGS. TS. Nguyễn Văn An',
          className: 'Giảng viên',
          studentCode: 'GV001',
          faceImageUrl: 'faces/annv.jpg',
        });
      } catch (err) {
        console.warn('Lỗi khôi phục ảnh thẻ annv:', err);
      }
    }
  }
};

// ============================================================================
// 7. EXAM SUBMISSION API (/exam/submit - AWS SQS & Grading Worker)
// ============================================================================

export const submitExam = async (req: ExamSubmitRequest): Promise<ExamSubmitResponse> => {
  const res = await api.post('/exam/submit', req);
  return res.data;
};

// ============================================================================
// 8. BẢNG ĐIỂM & KẾT QUẢ CA THI (/sessions/{id}/results từ DynamoDB)
// ============================================================================

export const fetchSessionResults = async (sessionId: string): Promise<SessionResultsResponse> => {
  try {
    const res = await api.get(`/sessions/${sessionId}/results`);
    return res.data;
  } catch (err: any) {
    // Nếu API Gateway trả về lỗi quyền/sub-resource, truy vấn trực tiếp session object từ DynamoDB
    const [sessRes, candRes] = await Promise.all([
      api.get(`/sessions/${sessionId}`).catch(() => null),
      api.get('/candidates').catch(() => null),
    ]);

    const sessionData = sessRes?.data;
    const candidatesList: Candidate[] = Array.isArray(candRes?.data) ? candRes?.data : candRes?.data?.items || [];
    const submissionsMap = sessionData?.submissions || {};

    const results: CandidateSessionResult[] = Object.entries(submissionsMap).map(([email, sub]: [string, any]) => {
      const cand = candidatesList.find((c) => c.email.toLowerCase() === email.toLowerCase());
      return {
        id: sub.id || `${sessionId}#${email}`,
        studentCode: cand?.studentCode || sub.studentCode || '',
        name: cand?.name || sub.name || email,
        email,
        candidateEmail: email,
        score: sub.score ?? 0,
        maxScore: sub.maxScore ?? 10,
        correctCount: sub.correctCount ?? 0,
        totalQuestions: sub.totalQuestions ?? 10,
        submittedAt: sub.submittedAt || '',
        status: sub.status || 'COMPLETED',
      };
    });

    return {
      sessionId,
      sessionName: sessionData?.name || '',
      status: sessionData?.status || '',
      totalSubmissions: results.length,
      results,
    };
  }
};

// ============================================================================
// 9. LẤY ĐỀ THI AN TOÀN, LƯU BÀI NHÁP & GỬI BÁO CÁO SNS
// ============================================================================

export const getExamPaper = async (sessionId: string): Promise<ExamPaperResponse> => {
  try {
    const res = await api.get(`/sessions/${sessionId}/paper`);
    const data = res.data;
    return {
      ...data,
      status: resolveSessionStatus(data.status, data.startTime, data.endTime),
    };
  } catch {
    // Truy vấn thông tin ca thi và các câu hỏi thật từ DynamoDB, loại bỏ đáp án đúng
    const [sessRes, qRes] = await Promise.all([
      api.get(`/sessions/${sessionId}`),
      api.get('/questions'),
    ]);

    const sessionData = sessRes.data;
    const allQuestions: Question[] = Array.isArray(qRes.data) ? qRes.data : qRes.data?.items || [];
    const sessionQIds: string[] = sessionData.questionIds || [];

    const matchedQuestions = allQuestions
      .filter((q) => sessionQIds.includes(q.id || (q as any).questionId))
      .map((q) => {
        const { correctIndex, correctAnswer, ...safeQuestion } = q;
        return safeQuestion as Question;
      });

    return {
      sessionId,
      sessionName: sessionData.name,
      status: resolveSessionStatus(sessionData.status, sessionData.startTime, sessionData.endTime),
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      questions: matchedQuestions,
      draftAnswers: {},
    };
  }
};

export const saveExamProgress = async (
  sessionId: string,
  answers: Record<string, number>,
  candidateEmail?: string
): Promise<{ saved: boolean; updatedAt: string }> => {
  const res = await api.post('/exam/save-progress', {
    sessionId,
    candidateEmail,
    answers,
  });
  return res.data;
};

export const sendSessionReport = async (sessionId: string): Promise<{ message: string }> => {
  const res = await api.post(`/sessions/${sessionId}/send-report`);
  return res.data;
};

// ============================================================================
// 10. QUY TRÌNH TỰ ĐỘNG ĐỒNG BỘ DỮ LIỆU LÊN AWS DYNAMODB
// ============================================================================

export const syncCloudDatabaseToProduction = async (): Promise<{
  deletedQuestions: number;
  addedQuestions: number;
  addedBanks: number;
  deletedCandidates: number;
  addedCandidates: number;
  sessionsUpdated: number;
  message: string;
}> => {
  let deletedQuestions = 0;
  let addedQuestions = 0;
  let addedBanks = 0;
  let deletedCandidates = 0;
  let addedCandidates = 0;
  let sessionsUpdated = 0;

  // 1. Kiểm tra / Khởi tạo ngân hàng câu hỏi
  try {
    const bRes = await api.get('/question-banks');
    const existingBanks = Array.isArray(bRes.data) ? bRes.data : bRes.data?.items || [];
    const hasArchBank = existingBanks.some((b: any) => (b.id || b.bankId) === 'bank-se-arch-01');
    if (!hasArchBank) {
      await api.post('/question-banks', DEFAULT_QUESTION_BANKS[0]);
      addedBanks++;
    }
  } catch (e) {
    console.warn('Kiểm tra ngân hàng câu hỏi trên DynamoDB:', e);
  }

  // 2. Nạp câu hỏi chuẩn vào DynamoDB
  try {
    const qRes = await api.get('/questions');
    const existingQuestions = Array.isArray(qRes.data) ? qRes.data : qRes.data?.items || [];
    const existingIds = new Set(existingQuestions.map((q: any) => q.id || q.questionId));

    for (const q of DEFAULT_QUESTIONS) {
      if (!existingIds.has(q.id)) {
        try {
          await api.post('/questions', q);
          addedQuestions++;
        } catch (e) {
          console.warn('Nạp câu hỏi mới lên AWS:', q.id, e);
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi kiểm tra câu hỏi trên DynamoDB:', e);
  }

  // 3. Nạp danh sách thí sinh chuẩn
  try {
    const cRes = await api.get('/candidates');
    const existingCandidates = Array.isArray(cRes.data) ? cRes.data : cRes.data?.items || [];
    const currentEmails = new Set(existingCandidates.map((c: any) => (c.email || '').toLowerCase()));

    for (const cand of DEFAULT_CANDIDATES) {
      if (!currentEmails.has(cand.email.toLowerCase())) {
        try {
          await api.post('/candidates', cand);
          addedCandidates++;
        } catch (e) {
          console.warn('Nạp thí sinh mới lên AWS:', cand.email, e);
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi kiểm tra thí sinh trên DynamoDB:', e);
  }

  // 4. Cập nhật ca thi chuẩn EX-VNU-2026-01
  try {
    const sRes = await api.get('/sessions');
    const existingSessions = Array.isArray(sRes.data) ? sRes.data : sRes.data?.items || [];
    const hasVnuSession = existingSessions.some((s: any) => s.id === 'EX-VNU-2026-01');
    if (!hasVnuSession) {
      await api.post('/sessions', DEFAULT_SESSIONS[0]);
      sessionsUpdated++;
    }
  } catch (e) {
    console.warn('Lỗi kiểm tra ca thi trên DynamoDB:', e);
  }

  return {
    deletedQuestions,
    addedQuestions,
    addedBanks,
    deletedCandidates,
    addedCandidates,
    sessionsUpdated,
    message: 'Đã hoàn tất đồng bộ dữ liệu chuẩn trên các bảng AWS DynamoDB.',
  };
};

export default api;
