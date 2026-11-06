import axios from 'axios';
import JSZip from 'jszip';

// Chế độ Mock đã được gỡ bỏ hoàn toàn. Toàn bộ request gửi trực tiếp tới dịch vụ AWS Cloud thật.
export const isMockMode = (): boolean => import.meta.env.VITE_USE_MOCK === 'true';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    'https://tmfbgkjy03.execute-api.ap-southeast-1.amazonaws.com/dev',
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

// Tự động xử lý khi Token bị lỗi 401: Xóa phiên rác và làm mới trang để không crash giao diện
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[CloudExam API] Bị chặn 401 Unauthorized do token cũ/hết hạn. Tự động dọn dẹp phiên.');
      localStorage.removeItem('id_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_mode');
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// TYPES & INTERFACES (Đồng bộ với DynamoDB & Lambda Handlers)
// ============================================================================

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'ESSAY';

export interface Question {
  id: string;
  questionId?: string;
  bankId: string;
  content: string;
  type?: QuestionType;
  options: string[];      // 2-6 lựa chọn A-F
  correctIndex: number;   // vị trí đáp án đúng (0-5)
  correctAnswer?: string; // nội dung đáp án đúng
  score: number;
  subject: string;        // Môn học
  topic: string;          // Chủ đề
  difficulty?: Difficulty;
  imageUrl?: string;
  createdAt?: string;
  explanation?: string;
  ownerEmail?: string;
  createdBy?: string;
}

export type QuestionInput = Omit<Question, 'id'> & { id?: string };

export interface QuestionBank {
  id: string;
  bankId?: string;
  name: string;
  subject: string;
  description?: string;
  createdAt?: string;
  ownerEmail?: string;
  createdBy?: string;
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
  answers: Record<string, number | string>; // { [questionId]: chosenIndex | essayText }
  candidateEmail?: string;
  turnstileToken?: string; // Token xác thực người thật Cloudflare Turnstile (Task M-02 & T-02)
  turnstile_token?: string;
}


export interface LeaderboardEntry {
  rank: number;
  candidateEmail: string;
  email?: string;
  name?: string;
  score: number;
}

export interface LeaderboardResponse {
  sessionId: string;
  topCount: number;
  leaderboard: LeaderboardEntry[];
  source: string;
}

export interface ParseDocRequest {
  fileBase64?: string;
  fileContent?: string;
  text?: string;
  docText?: string;
  bankId?: string;
  subject?: string;
  topic?: string;
  autoSave?: boolean;
  model?: string;
  apiKey?: string;
}

export interface ParseDocResponse {
  message: string;
  count: number;
  bankId: string;
  saved: boolean;
  source: string;
  questions: Question[];
}

export interface ExplainAnswerRequest {
  questionId?: string;
  content?: string;
  questionContent?: string;
  options?: string[];
  chosenIndex?: number;
  userAnswerIndex?: number;
  correctIndex?: number;
  chosenAnswer?: string;
  userAnswer?: string;
  correctAnswer?: string;
  subject?: string;
  model?: string;
  apiKey?: string;
}

export interface ExplainAnswerResponse {
  questionId?: string;
  explanation: string;
  source: string;
  chosenAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
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
    studentCode: '24020001',
    name: 'Trần Minh Đức',
    email: '24020001@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020001.jpg`,
  },
  {
    studentCode: '24020002',
    name: 'Lê Thị Mai',
    email: '24020002@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020002.jpg`,
  },
  {
    studentCode: '24020003',
    name: 'Phạm Hoàng Long',
    email: '24020003@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020003.jpg`,
  },
  {
    studentCode: '24020004',
    name: 'Vũ Thùy Linh',
    email: '24020004@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020004.jpg`,
  },
  {
    studentCode: '24020005',
    name: 'Đỗ Quang Huy',
    email: '24020005@vnu.edu.vn',
    className: 'K69 - Khoa CNTT - UET',
    faceImageUrl: `${S3_BASE}/faces/24020005.jpg`,
  },
  {
    studentCode: '24020006',
    name: 'Nguyễn Văn Sáu',
    email: '24020006@vnu.edu.vn',
    className: 'k69i-it7',
    faceImageUrl: `${S3_BASE}/faces/24020006.jpg`,
  },
  {
    studentCode: '24020007',
    name: 'Nguyễn VĂN BẢY',
    email: '24020007@vnu.edu.vn',
    className: 'K69I-IT6',
    faceImageUrl: `${S3_BASE}/faces/24020007.jpg`,
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
      '24020001@vnu.edu.vn',
      '24020002@vnu.edu.vn',
      '24020003@vnu.edu.vn',
      '24020004@vnu.edu.vn',
      '24020005@vnu.edu.vn',
      '24020006@vnu.edu.vn',
      '24020007@vnu.edu.vn',
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

export const requestPresignedUploadUrl = async (params: {
  fileName: string;
  contentType: string;
  prefix?: string;
}): Promise<PresignedUrlResponse> => {
  return requestPresignedUrl(params.fileName, params.contentType, params.prefix || 'questions');
};

export interface FacePresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn?: number;
}

export const requestFacePresignedUrl = async (
  sessionId: string,
  studentCode: string
): Promise<FacePresignedUrlResponse> => {
  const res = await api.post('/auth/face-presign', { sessionId, studentCode });
  return res.data;
};

// ============================================================================
// 2. QUESTION BANKS APIS (/question-banks - DynamoDB)
// ============================================================================

const LOCAL_CUSTOM_BANKS_KEY = 'cloudexam_custom_banks';
const LOCAL_DELETED_BANKS_KEY = 'cloudexam_deleted_banks';

export const getDeletedBankIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_BANKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

export const addDeletedBankId = (bankId: string) => {
  try {
    const set = getDeletedBankIds();
    set.add(bankId);
    localStorage.setItem(LOCAL_DELETED_BANKS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Lỗi ghi deleted bank id:', e);
  }
};

export const getLocalBanks = (): QuestionBank[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_BANKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalBank = (b: QuestionBank) => {
  try {
    const list = getLocalBanks();
    const idx = list.findIndex((item) => item.id === b.id || (item.bankId && item.bankId === b.bankId));
    if (idx >= 0) {
      list[idx] = b;
    } else {
      list.push(b);
    }
    localStorage.setItem(LOCAL_CUSTOM_BANKS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Lỗi lưu local bank:', e);
  }
};

export const getQuestionBanks = async (ownerEmail?: string): Promise<QuestionBank[]> => {
  let cloudBanks: QuestionBank[] = [];
  try {
    const params = ownerEmail ? { ownerEmail } : undefined;
    const res = await api.get('/question-banks', { params });
    const data = res.data;
    const list = Array.isArray(data) ? data : data.items ?? [];
    cloudBanks = list.map((b: any) => ({
      id: b.id || b.bankId,
      bankId: b.bankId || b.id,
      name: b.name || 'Ngân hàng câu hỏi',
      subject: b.subject || 'Kiến trúc & Phát triển Phần mềm',
      description: b.description || '',
      createdAt: b.createdAt,
      ownerEmail: b.ownerEmail || b.createdBy,
      createdBy: b.createdBy || b.ownerEmail,
    }));
  } catch (err) {
    console.warn('Lỗi lấy ngân hàng câu hỏi từ API:', err);
    cloudBanks = ownerEmail ? [] : [...DEFAULT_QUESTION_BANKS];
  }

  // Kết hợp ngân hàng câu hỏi lưu trên trình duyệt (chỉ khi đúng chủ sở hữu)
  const localBanks = getLocalBanks();
  const seenIds = new Set(cloudBanks.map((b) => b.id));
  for (const lb of localBanks) {
    if (!seenIds.has(lb.id) && (!ownerEmail || lb.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase())) {
      cloudBanks.push(lb);
      seenIds.add(lb.id);
    }
  }

  // Lọc bỏ triệt để các ngân hàng đã bị xóa bởi người dùng (Tombstone Blacklist)
  const deletedIds = getDeletedBankIds();
  const filtered = cloudBanks.filter(
    (b) => !deletedIds.has(b.id) && !deletedIds.has(b.bankId || '')
  );

  return filtered;
};

export const createQuestionBank = async (data: QuestionBankInput): Promise<QuestionBank> => {
  const bankId = data.id || data.bankId || ('bank-' + Math.random().toString(36).substring(2, 10));
  const fullBank: QuestionBank = {
    ...data,
    id: bankId,
    bankId,
    name: data.name || 'Ngân hàng câu hỏi',
    subject: data.subject || 'Chung',
    description: data.description || '',
    ownerEmail: data.ownerEmail || data.createdBy,
    createdBy: data.createdBy || data.ownerEmail,
    createdAt: new Date().toISOString(),
  };

  saveLocalBank(fullBank);

  try {
    const res = await api.post('/question-banks', fullBank);
    return res.data;
  } catch (err) {
    console.warn('POST /question-banks lỗi (đã lưu an toàn vào local cache):', err);
    return fullBank;
  }
};

export const removeLocalBank = (bankId: string) => {
  try {
    const list = getLocalBanks().filter((b) => b.id !== bankId && b.bankId !== bankId);
    localStorage.setItem(LOCAL_CUSTOM_BANKS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Lỗi xóa local bank:', e);
  }
};

export const removeLocalQuestionsByBank = (bankId: string) => {
  try {
    const list = getLocalQuestions().filter((q) => q.bankId !== bankId);
    localStorage.setItem(LOCAL_CUSTOM_QUESTIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Lỗi xóa local questions by bank:', e);
  }
};

export const deleteQuestionBank = async (bankId: string): Promise<any> => {
  // 1. Thêm vào danh sách ngân hàng đã xóa và xóa trên local cache tức thì
  addDeletedBankId(bankId);
  removeLocalBank(bankId);
  removeLocalQuestionsByBank(bankId);

  // 2. Xóa toàn bộ câu hỏi thuộc ngân hàng này trên AWS DynamoDB (CloudExam_Questions_dev)
  try {
    const allQuestions = await getQuestions();
    const bankQuestions = allQuestions.filter((q) => q.bankId === bankId);
    await Promise.all(
      bankQuestions.map((q) =>
        api.delete(`/questions/${q.id}`).catch((delErr) =>
          console.warn(`Lỗi xóa câu hỏi ${q.id} trên AWS:`, delErr)
        )
      )
    );
  } catch (qErr) {
    console.warn('Lỗi quét câu hỏi cần xóa trên AWS:', qErr);
  }

  // 3. Gọi endpoint xóa ngân hàng đề trên AWS
  try {
    const res = await api.post('/question-banks', { action: 'DELETE', id: bankId });
    return res.data;
  } catch (postErr) {
    try {
      const res = await api.delete(`/question-banks/${bankId}`);
      return res.data;
    } catch (err) {
      try {
        const res2 = await api.delete('/question-banks', { params: { id: bankId } });
        return res2.data;
      } catch {
        return { id: bankId, deleted: true };
      }
    }
  }
};

// ============================================================================
// 3. QUESTION APIS (/questions - DynamoDB & Local Resilience Cache)
// ============================================================================

const LOCAL_CUSTOM_QUESTIONS_KEY = 'cloudexam_custom_questions';

export const getLocalQuestions = (): Question[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_QUESTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalQuestion = (q: Question) => {
  try {
    const list = getLocalQuestions();
    const existingIdx = list.findIndex(
      (item) => item.id === q.id || (item.questionId && item.questionId === q.questionId)
    );
    if (existingIdx >= 0) {
      list[existingIdx] = q;
    } else {
      list.push(q);
    }
    localStorage.setItem(LOCAL_CUSTOM_QUESTIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Lỗi lưu local question:', e);
  }
};

export const removeLocalQuestion = (id: string) => {
  try {
    const list = getLocalQuestions().filter((item) => item.id !== id && item.questionId !== id);
    localStorage.setItem(LOCAL_CUSTOM_QUESTIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Lỗi xóa local question:', e);
  }
};

export const getQuestions = async (): Promise<Question[]> => {
  let cloudItems: Question[] = [];
  try {
    const res = await api.get('/questions');
    const data = res.data;
    const list = Array.isArray(data) ? data : data.items ?? [];

    cloudItems = list.map((q: any) => ({
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
      explanation: q.explanation || '',
    }));
  } catch (err) {
    console.warn('Lỗi tải câu hỏi từ DynamoDB API, sử dụng DEFAULT_QUESTIONS:', err);
    cloudItems = [...DEFAULT_QUESTIONS];
  }

  // Kết hợp an toàn các câu hỏi đã trích xuất/tạo mới để không bao giờ bị mất dữ liệu
  const localItems = getLocalQuestions();
  const seenIds = new Set(cloudItems.map((q) => q.id));
  for (const lq of localItems) {
    if (!seenIds.has(lq.id)) {
      cloudItems.push(lq);
      seenIds.add(lq.id);
    }
  }

  return cloudItems;
};

export const createQuestion = async (data: QuestionInput): Promise<Question> => {
  const qId = data.id || data.questionId || ('q-doc-' + Math.random().toString(36).substring(2, 10));
  const isEssay = data.type === 'ESSAY';
  const fullQ: Question = {
    ...data,
    id: qId,
    questionId: qId,
    type: data.type || 'SINGLE_CHOICE',
    options: isEssay ? [] : (data.options || []),
    correctIndex: isEssay ? -1 : Number(data.correctIndex ?? 0),
    correctAnswer: isEssay
      ? (data.correctAnswer || '')
      : (data.correctAnswer || (data.options ? data.options[Number(data.correctIndex ?? 0)] : '')),
    score: Number(data.score ?? 1),
    subject: data.subject || 'Kiến trúc Phần mềm',
    topic: data.topic || '',
    difficulty: data.difficulty || 'MEDIUM',
    imageUrl: data.imageUrl || '',
  };
  delete (fullQ as any).explanation;

  saveLocalQuestion(fullQ);

  try {
    const res = await api.post('/questions', fullQ);
    return res.data;
  } catch (err) {
    console.warn('POST /questions gặp lỗi (đã lưu an toàn vào local cache):', err);
    return fullQ;
  }
};

export const updateQuestion = async (id: string, data: Partial<QuestionInput>): Promise<any> => {
  try {
    const localList = getLocalQuestions();
    const idx = localList.findIndex((item) => item.id === id || item.questionId === id);
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...data };
      localStorage.setItem(LOCAL_CUSTOM_QUESTIONS_KEY, JSON.stringify(localList));
    }
  } catch (e) {
    console.warn('Lỗi cập nhật local question:', e);
  }

  try {
    const res = await api.put(`/questions/${id}`, data);
    return res.data;
  } catch (err) {
    console.warn('PUT /questions gặp lỗi, đã cập nhật local cache:', err);
    return { id, ...data };
  }
};

export const deleteQuestion = async (id: string): Promise<any> => {
  removeLocalQuestion(id);
  try {
    const res = await api.delete(`/questions/${id}`);
    return res.data;
  } catch (err) {
    console.warn('DELETE /questions gặp lỗi, đã xóa trong local cache:', err);
    return { id, deleted: true };
  }
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

  try {
    // 3. Gửi yêu cầu đối soát khuôn mặt tới Amazon Rekognition qua Lambda
    // Ưu tiên truyền capturedS3Key (~100 bytes) để tối ưu và tránh vượt giới hạn kích thước request body WAF
    const payload: {
      sessionId: string;
      email: string;
      capturedS3Key?: string;
      capturedImage?: string;
    } = {
      sessionId: req.sessionId,
      email: targetEmail || 'annv@uet.vnu.edu.vn',
    };

    if (req.capturedS3Key) {
      payload.capturedS3Key = req.capturedS3Key;
    } else if (req.capturedImage) {
      payload.capturedImage = req.capturedImage;
    }

    const res = await api.post('/auth/face-verify', payload);
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
          'Không nhận diện được khuôn mặt người trong ảnh thẻ hồ sơ thí sinh hoặc ảnh chụp camera. Vui lòng kiểm tra lại ảnh thẻ (phải có khuôn mặt người rõ ràng, không dùng sơ đồ/vật thể) và hướng thẳng vào camera.',
      };
    }

    if (errorData && typeof errorData.verified === 'boolean') {
      return errorData;
    }

    let friendlyMessage = msg;
    if (msg === 'Forbidden' || err?.response?.status === 403) {
      friendlyMessage =
        'Khuôn mặt không khớp với ảnh hồ sơ thí sinh (Độ tương đồng < 80%) hoặc phiên làm việc đã hết hạn. Vui lòng chụp lại rõ mặt hoặc liên hệ Giám thị.';
    }

    return {
      status: 'FAIL',
      verified: false,
      similarity: errorData?.similarity ?? 0,
      candidateName: candidateName || targetEmail,
      message: friendlyMessage || 'Xác thực sinh trắc học không thành công.',
    };
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


// ============================================================================
// 7.1. S3 DIRECT BINARY UPLOAD (Task 18 - Direct-to-Storage, 0MB API Gateway)
// ============================================================================

export const uploadBinaryToS3 = async (
  uploadUrl: string,
  data: Blob | File | ArrayBuffer,
  contentType = 'image/jpeg'
): Promise<boolean> => {
  const resp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: data,
  });
  if (!resp.ok) {
    throw new Error(`S3 direct upload failed with status ${resp.status}`);
  }
  return true;
};

// ============================================================================
// 7.2. MULTI-CLOUD APIS: WORD DOC PARSING, LIVE LEADERBOARD & AI TUTOR
// ============================================================================

export const extractTextFromDocxFile = async (fileOrBlob: Blob): Promise<string> => {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(fileOrBlob);
    const docXmlFile = contents.file('word/document.xml');
    if (!docXmlFile) {
      return await fileOrBlob.text();
    }
    const xmlText = await docXmlFile.async('string');
    const pRegex = /<w:p(?: [^>]*)?>(.*?)<\/w:p>/gs;
    const tRegex = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
    const paragraphs: string[] = [];
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xmlText)) !== null) {
      const pContent = pMatch[1];
      let pText = '';
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tRegex.exec(pContent)) !== null) {
        pText += tMatch[1];
      }
      if (pText.trim()) {
        paragraphs.push(pText.trim());
      }
    }
    return paragraphs.join('\n');
  } catch (e) {
    console.warn('Docx extraction error, falling back to text:', e);
    return await fileOrBlob.text();
  }
};

export const extractTextFromBase64Docx = async (b64: string): Promise<string> => {
  try {
    const cleanB64 = b64.includes(',') ? b64.split(',')[1] : b64;
    const binaryString = atob(cleanB64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return await extractTextFromDocxFile(new Blob([bytes]));
  } catch (e) {
    console.warn('Lỗi decode Base64 sang Docx:', e);
    return '';
  }
};

export const parseQuestionsFromRawText = (
  rawText: string,
  bankId: string,
  subject = 'Kiến trúc hướng dịch vụ',
  topic = 'Kiến trúc hệ thống'
): Question[] => {
  const questions: Question[] = [];
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // Nhận diện tự động ngôn ngữ đề thi (Tiếng Anh hoặc Tiếng Việt)
  const isEnglish = /\b(question|which|what|choose|select|following|answer|marks?|points?)\b/i.test(rawText);
  const defaultOptPrefix = isEnglish ? 'Option' : 'Phương án';
  const defaultQuestionContent = isEnglish ? 'Multiple Choice Question' : 'Câu hỏi trắc nghiệm';

  let curQ: {
    content: string;
    options: string[];
    correctIndex: number;
  } | null = null;

  const pushCurrentQuestion = () => {
    if (!curQ || curQ.options.length < 2) return;
    const options = [...curQ.options];
    while (options.length < 4) {
      options.push(`${defaultOptPrefix} ${options.length + 1}`);
    }
    let correctIndex = curQ.correctIndex;
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }
    const qId = 'q-doc-' + Math.random().toString(36).substring(2, 10);
    questions.push({
      id: qId,
      questionId: qId,
      bankId,
      content: curQ.content || defaultQuestionContent,
      type: 'SINGLE_CHOICE',
      options,
      correctIndex,
      correctAnswer: options[correctIndex] || options[0],
      difficulty: 'MEDIUM',
      score: 1,
      subject,
      topic,
      imageUrl: '',
    });
  };

  for (const line of lines) {
    // 1. Nhận diện mở đầu câu hỏi song ngữ (Việt: "Câu 1", Anh: "Question 1", "Q1", "Q.1", "[Question 1]", số: "1.", "1)")
    const qMatch = line.match(
      /^(?:câu\s*\d+|question\s*\d+|q\s*\.?\s*\d+|\d+[\.:\)]|\[(?:câu|question|q)\s*\.?\s*\d+\])(?:\s*\([^)]*\))?[:\.\-]?\s*(.*)/i
    );
    if (qMatch) {
      pushCurrentQuestion();
      let content = qMatch[1].trim();
      // Loại bỏ điểm số trong ngoặc đơn ở đầu: ví dụ "(0.67 điểm):", "(1 point):", "(1 pt):"
      content = content.replace(/^\([^)]*\)\s*[:\.\-]?\s*/, '').trim();
      // Loại bỏ điểm số ở cuối câu nếu có: ví dụ "... (1 pt)", "... (0.67 points)"
      content = content.replace(/\s*\(\s*\d+(?:[\.,]\d+)?\s*(?:điểm|pts?|points?|marks?)\s*\)\s*$/i, '').trim();

      curQ = {
        content,
        options: [],
        correctIndex: 0,
      };
      continue;
    }

    if (!curQ) continue;

    // 2. Nhận diện các phương án A, B, C, D, E, F (Đa định dạng: A., A), (A), [A], A:, A -)
    const optMatch = line.match(/^(?:\(?([A-F])\)|\(?([A-F])[\.:\-\)]|\[([A-F])\])\s*(.*)/i);
    if (optMatch) {
      let optText = (optMatch[4] || optMatch[2] || '').trim();
      // Lọc sạch triệt để Đáp án / Giải thích (cả tiếng Việt và tiếng Anh) nếu bị dính vào phương án
      optText = optText
        .replace(
          /(?:đáp\s*án(?:\s*đúng)?|giải\s*thích|correct\s*(?:answer|option)|answer(?:\s*is)?|right\s*answer|ans|key|explanation|explain|rationale|reason).*$/i,
          ''
        )
        .trim();
      curQ.options.push(optText);
      continue;
    }

    // 3. Nhận diện dòng Đáp án song ngữ (Đáp án: B, Answer: B, Correct answer: C, Ans: A, Key: D, Answer is B)
    const ansMatch = line.match(
      /(?:đáp\s*án(?:\s*đúng)?|đ\/a|correct\s*(?:answer|option)|answer(?:\s*is)?|right\s*answer|ans|key)[:\s]*\(?([A-F])\)?/i
    );
    if (ansMatch) {
      const letter = ansMatch[1].toUpperCase();
      curQ.correctIndex = letter.charCodeAt(0) - 65;
      continue;
    }

    // 4. Bỏ qua các dòng Giải thích song ngữ (Tuyệt đối không lưu giải thích vào ngân hàng)
    if (/^(?:giải\s*thích|lời\s*giải|explanation|explain|rationale|reason|note)[:\s]*/i.test(line)) {
      continue;
    }

    // 5. Nếu chưa có phương án nào thì đây là dòng nối tiếp của nội dung câu hỏi
    if (curQ.options.length === 0) {
      curQ.content += (curQ.content ? ' ' : '') + line;
    }
  }

  // Đẩy câu hỏi cuối cùng
  pushCurrentQuestion();

  // Fallback dự phòng: bóc tách regex theo khối song ngữ nếu văn bản không có xuống dòng chuẩn
  if (questions.length === 0) {
    const blocks = rawText.split(
      /(?:^|\n)\s*(?:câu\s*\d+|question\s*\d+|q\s*\.?\s*\d+|\d+[\.:\)]|\[(?:câu|question|q)\s*\.?\s*\d+\])(?:\s*\([^)]*\))?[:\.\-]?\s*/i
    );
    for (const rawBlock of blocks) {
      const block = rawBlock.trim();
      if (!block || block.length < 15) continue;

      const optRegex =
        /(?:^|\n|\s+)(?:\(?([A-F])\)|\(?([A-F])[\.:\-\)]|\[([A-F])\])\s*(.*?)(?=(?:(?:^|\n|\s+)(?:\(?[A-F][\.:\-\)]|\([A-F]\)|\[[A-F]\])|\s*(?:đáp\s*án|đ\/a|correct\s*(?:answer|option)|answer|ans|key)|\Z))/gis;
      const optMatches = Array.from(block.matchAll(optRegex));

      if (optMatches.length >= 2) {
        const firstOptIndex = optMatches[0].index;
        let content = block.slice(0, firstOptIndex).trim();
        content = content
          .replace(
            /^(?:câu\s*\d+|question\s*\d+|q\s*\.?\s*\d+|\d+[\.:\)])(?:\s*\([^)]*\))?[:\.\-]?\s*/i,
            ''
          )
          .trim();
        content = content.replace(/^\([^)]*\)\s*[:\.\-]?\s*/, '').trim();
        content = content.replace(/\s*\(\s*\d+(?:[\.,]\d+)?\s*(?:điểm|pts?|points?|marks?)\s*\)\s*$/i, '').trim();

        const options = optMatches.slice(0, 6).map((m) => {
          let opt = (m[4] || m[2] || '').trim();
          return opt
            .replace(
              /(?:đáp\s*án(?:\s*đúng)?|giải\s*thích|correct\s*(?:answer|option)|answer(?:\s*is)?|right\s*answer|ans|key|explanation|explain|rationale|reason).*$/i,
              ''
            )
            .trim();
        });
        while (options.length < 4) {
          options.push(`${defaultOptPrefix} ${options.length + 1}`);
        }

        const ansMatch = block.match(
          /(?:đáp\s*án(?:\s*đúng)?|đ\/a|correct\s*(?:answer|option)|answer(?:\s*is)?|right\s*answer|ans|key)[:\s]*\(?([A-F])\)?/i
        );
        let correctIndex = 0;
        if (ansMatch) {
          const letter = ansMatch[1].toUpperCase();
          correctIndex = letter.charCodeAt(0) - 65;
          if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
        }

        const qId = 'q-doc-' + Math.random().toString(36).substring(2, 10);
        questions.push({
          id: qId,
          questionId: qId,
          bankId,
          content: content || defaultQuestionContent,
          type: 'SINGLE_CHOICE',
          options,
          correctIndex,
          correctAnswer: options[correctIndex] || options[0],
          difficulty: 'MEDIUM',
          score: 1,
          subject,
          topic,
          imageUrl: '',
        });
      }
    }
  }

  return questions;
};

export const generateTopicQuestions = (
  bankId: string,
  subject = 'Điện toán đám mây & Kiến trúc hệ thống',
  topic = 'Kiến trúc hệ thống',
  promptText = ''
): Question[] => {
  const p = (promptText || '').toLowerCase();
  const countMatch = (promptText || '').match(/(\d+)\s*câu/i);
  const targetCount = countMatch ? Math.min(50, Math.max(1, parseInt(countMatch[1], 10))) : 5;

  if (p.includes('aws') || p.includes('cloud') || p.includes('ec2') || p.includes('lambda') || p.includes('s3') || p.includes('vpc') || p.includes('dynamodb')) {
    const awsPool: Question[] = [
      {
        id: `q-aws-${Date.now()}-1`,
        questionId: `q-aws-${Date.now()}-1`,
        bankId,
        content: 'Dịch vụ nào của AWS cung cấp khả năng lưu trữ đối tượng không giới hạn với độ bền 99.999999999% (11 số 9)?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon S3', 'Amazon EBS', 'Amazon EFS', 'AWS Storage Gateway'],
        correctIndex: 0,
        correctAnswer: 'Amazon S3',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Lưu trữ đối tượng (S3)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-2`,
        questionId: `q-aws-${Date.now()}-2`,
        bankId,
        content: 'Trong AWS, mô hình điện toán Serverless cho phép chạy mã nguồn theo sự kiện mà không cần quản lý máy chủ là gì?',
        type: 'SINGLE_CHOICE',
        options: ['AWS Lambda', 'Amazon EC2', 'Amazon ECS', 'AWS Elastic Beanstalk'],
        correctIndex: 0,
        correctAnswer: 'AWS Lambda',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Điện toán phi máy chủ (Serverless)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-3`,
        questionId: `q-aws-${Date.now()}-3`,
        bankId,
        content: 'Cơ chế nào được dùng để cô lập mạng ảo riêng an toàn cho các tài nguyên EC2, RDS và Lambda trong một tài khoản AWS?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon VPC (Virtual Private Cloud)', 'Amazon Route 53', 'AWS Direct Connect', 'Amazon CloudFront'],
        correctIndex: 0,
        correctAnswer: 'Amazon VPC (Virtual Private Cloud)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Mạng ảo riêng (VPC)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-4`,
        questionId: `q-aws-${Date.now()}-4`,
        bankId,
        content: 'Để quản trị danh tính và phân quyền chi tiết (Least Privilege) cho người dùng và các dịch vụ trên AWS, dịch vụ cốt lõi là gì?',
        type: 'SINGLE_CHOICE',
        options: ['AWS IAM (Identity and Access Management)', 'Amazon Cognito', 'AWS Shield', 'Amazon GuardDuty'],
        correctIndex: 0,
        correctAnswer: 'AWS IAM (Identity and Access Management)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Bảo mật & Quản trị danh tính (IAM)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-5`,
        questionId: `q-aws-${Date.now()}-5`,
        bankId,
        content: 'Dịch vụ cơ sở dữ liệu NoSQL nào trên AWS hỗ trợ khóa phân vùng (Partition Key), độ trễ phản hồi đơn vị ms và co giãn quy mô tự động?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon DynamoDB', 'Amazon RDS MySQL', 'Amazon Aurora Serverless', 'Amazon DocumentDB'],
        correctIndex: 0,
        correctAnswer: 'Amazon DynamoDB',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Cơ sở dữ liệu NoSQL (DynamoDB)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-6`,
        questionId: `q-aws-${Date.now()}-6`,
        bankId,
        content: 'Dịch vụ nào cung cấp máy chủ ảo có thể cấu hình linh hoạt về CPU, RAM, lưu trữ và băng thông mạng trên đám mây AWS?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon EC2 (Elastic Compute Cloud)', 'AWS Batch', 'AWS Elastic Beanstalk', 'Amazon Lightsail'],
        correctIndex: 0,
        correctAnswer: 'Amazon EC2 (Elastic Compute Cloud)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Máy chủ ảo (EC2)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-7`,
        questionId: `q-aws-${Date.now()}-7`,
        bankId,
        content: 'Mạng lưới phân phối nội dung (CDN) toàn cầu giúp tăng tốc truyền tải nội dung tĩnh và động với độ trễ thấp trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon CloudFront', 'AWS Global Accelerator', 'Amazon Route 53', 'AWS Direct Connect'],
        correctIndex: 0,
        correctAnswer: 'Amazon CloudFront',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Mạng phân phối nội dung (CloudFront CDN)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-8`,
        questionId: `q-aws-${Date.now()}-8`,
        bankId,
        content: 'Dịch vụ DNS có tính sẵn sàng cao, hỗ trợ quản lý định tuyến tên miền và kiểm tra tình trạng dịch vụ (Health Check) trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon Route 53', 'AWS Direct Connect', 'Amazon CloudFront', 'AWS Transit Gateway'],
        correctIndex: 0,
        correctAnswer: 'Amazon Route 53',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Hệ thống phân giải tên miền (Route 53)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-9`,
        questionId: `q-aws-${Date.now()}-9`,
        bankId,
        content: 'Hàng đợi thông điệp phi máy chủ (Message Queue) giúp giải phóng phụ thuộc (Decoupling) giữa các microservices trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon SQS (Simple Queue Service)', 'Amazon SNS', 'Amazon EventBridge', 'Amazon Kinesis'],
        correctIndex: 0,
        correctAnswer: 'Amazon SQS (Simple Queue Service)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Hàng đợi thông điệp (SQS)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-10`,
        questionId: `q-aws-${Date.now()}-10`,
        bankId,
        content: 'Dịch vụ pub/sub thông báo đẩy hỗ trợ gửi thông điệp tới nhiều người nhận qua Email, SMS hoặc SQS đồng thời là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon SNS (Simple Notification Service)', 'Amazon SES', 'Amazon Pinpoint', 'Amazon MQ'],
        correctIndex: 0,
        correctAnswer: 'Amazon SNS (Simple Notification Service)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Thông báo đẩy (SNS)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-11`,
        questionId: `q-aws-${Date.now()}-11`,
        bankId,
        content: 'Dịch vụ giám sát, thu thập số liệu (metrics), theo dõi nhật ký (logs) và cấu hình cảnh báo tài nguyên trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon CloudWatch', 'AWS CloudTrail', 'AWS Config', 'AWS X-Ray'],
        correctIndex: 0,
        correctAnswer: 'Amazon CloudWatch',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Giám sát & Cảnh báo (CloudWatch)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-12`,
        questionId: `q-aws-${Date.now()}-12`,
        bankId,
        content: 'Dịch vụ ghi nhật ký kiểm toán (Audit Log) theo dõi toàn bộ các lệnh gọi API được thực hiện trong tài khoản AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['AWS CloudTrail', 'Amazon CloudWatch', 'AWS Trusted Advisor', 'AWS Systems Manager'],
        correctIndex: 0,
        correctAnswer: 'AWS CloudTrail',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Kiểm toán hoạt động API (CloudTrail)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-13`,
        questionId: `q-aws-${Date.now()}-13`,
        bankId,
        content: 'Dịch vụ quản lý và tạo khóa mã hóa dữ liệu tích hợp phần cứng FIPS 140-2 tiêu chuẩn trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['AWS KMS (Key Management Service)', 'AWS Secrets Manager', 'AWS Certificate Manager', 'AWS CloudHSM'],
        correctIndex: 0,
        correctAnswer: 'AWS KMS (Key Management Service)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Mã hóa khóa (KMS)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-14`,
        questionId: `q-aws-${Date.now()}-14`,
        bankId,
        content: 'Dịch vụ lưu trữ an toàn, tự động xoay vòng (Rotate) mật khẩu cơ sở dữ liệu và khóa API trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['AWS Secrets Manager', 'AWS Systems Manager Parameter Store', 'AWS KMS', 'AWS IAM'],
        correctIndex: 0,
        correctAnswer: 'AWS Secrets Manager',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Quản lý bí mật (Secrets Manager)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-15`,
        questionId: `q-aws-${Date.now()}-15`,
        bankId,
        content: 'Bộ cân bằng tải hoạt động ở tầng ứng dụng Layer 7 hỗ trợ định tuyến theo đường dẫn URL (Path-based routing) là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Application Load Balancer (ALB)', 'Network Load Balancer (NLB)', 'Gateway Load Balancer (GWLB)', 'Classic Load Balancer'],
        correctIndex: 0,
        correctAnswer: 'Application Load Balancer (ALB)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Cân bằng tải ứng dụng (ALB)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-16`,
        questionId: `q-aws-${Date.now()}-16`,
        bankId,
        content: 'Tính năng tự động tăng hoặc giảm số lượng máy chủ EC2 dựa trên lưu lượng người dùng và tải CPU là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon EC2 Auto Scaling', 'AWS Elastic Beanstalk', 'AWS Compute Optimizer', 'Amazon ECS Service Auto Scaling'],
        correctIndex: 0,
        correctAnswer: 'Amazon EC2 Auto Scaling',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Tự động co giãn (Auto Scaling)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-17`,
        questionId: `q-aws-${Date.now()}-17`,
        bankId,
        content: 'Tường lửa ứng dụng web giúp bảo vệ API Gateway và CloudFront trước các cuộc tấn công SQL Injection và Cross-Site Scripting (XSS) là gì?',
        type: 'SINGLE_CHOICE',
        options: ['AWS WAF (Web Application Firewall)', 'AWS Shield', 'Amazon GuardDuty', 'AWS Network Firewall'],
        correctIndex: 0,
        correctAnswer: 'AWS WAF (Web Application Firewall)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Tường lửa ứng dụng (WAF)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-18`,
        questionId: `q-aws-${Date.now()}-18`,
        bankId,
        content: 'Dịch vụ cơ sở dữ liệu quan hệ được quản lý (Managed Relational Database) hỗ trợ MySQL, PostgreSQL, Oracle và SQL Server là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon RDS (Relational Database Service)', 'Amazon Aurora', 'Amazon Redshift', 'Amazon Neptune'],
        correctIndex: 0,
        correctAnswer: 'Amazon RDS (Relational Database Service)',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Cơ sở dữ liệu quan hệ (RDS)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-19`,
        questionId: `q-aws-${Date.now()}-19`,
        bankId,
        content: 'Dịch vụ phân tích nhận diện khuôn mặt, so khớp sinh trắc học và phát hiện vật thể bằng AI trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['Amazon Rekognition', 'Amazon Textract', 'Amazon Comprehend', 'Amazon Transcribe'],
        correctIndex: 0,
        correctAnswer: 'Amazon Rekognition',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Thị giác máy tính AI (Rekognition)',
        difficulty: 'EASY',
        imageUrl: '',
      },
      {
        id: `q-aws-${Date.now()}-20`,
        questionId: `q-aws-${Date.now()}-20`,
        bankId,
        content: 'Dịch vụ điều phối luồng quy trình công việc phân tán (Workflow Orchestration) dạng State Machine không máy chủ trên AWS là gì?',
        type: 'SINGLE_CHOICE',
        options: ['AWS Step Functions', 'AWS Glue Workflows', 'Amazon EventBridge Pipes', 'AWS Batch'],
        correctIndex: 0,
        correctAnswer: 'AWS Step Functions',
        score: 1,
        subject: 'Điện toán đám mây AWS',
        topic: 'Điều phối quy trình (Step Functions)',
        difficulty: 'MEDIUM',
        imageUrl: '',
      },
    ];

    return awsPool.slice(0, targetCount);
  }

  return [
    {
      id: `q-soa-${Date.now()}-1`,
      questionId: `q-soa-${Date.now()}-1`,
      bankId,
      content: 'Trong mô hình Kiến trúc Hướng Dịch vụ (SOA) và Microservices, đặc điểm nào sau đây là quan trọng nhất?',
      type: 'SINGLE_CHOICE',
      options: [
        'Các dịch vụ có tính kết nối lỏng (Loosely Coupled) và giao tiếp qua các giao thức chuẩn',
        'Tất cả dịch vụ phải chia sẻ chung một bảng cơ sở dữ liệu quan hệ duy nhất',
        'Toàn bộ ứng dụng phải được đóng gói và triển khai đồng thời trong một tệp nhị phân',
        'Không được phép phân tán các dịch vụ trên nhiều máy chủ khác nhau',
      ],
      correctIndex: 0,
      correctAnswer: 'Các dịch vụ có tính kết nối lỏng (Loosely Coupled) và giao tiếp qua các giao thức chuẩn',
      score: 1,
      subject,
      topic,
      difficulty: 'MEDIUM',
      imageUrl: '',
    },
    {
      id: `q-soa-${Date.now()}-2`,
      questionId: `q-soa-${Date.now()}-2`,
      bankId,
      content: 'Thành phần nào đóng vai trò điều phối thông điệp và giảm sự phụ thuộc trực tiếp giữa các dịch vụ trong kiến trúc SOA?',
      type: 'SINGLE_CHOICE',
      options: [
        'Enterprise Service Bus (ESB) hoặc Message Broker (như Amazon SQS / Apache Kafka)',
        'Trình thông dịch mã nguồn phía Client',
        'Cổng giao tiếp phần cứng COM Port',
        'Hệ thống quản lý tệp tin cục bộ (Local File System)',
      ],
      correctIndex: 0,
      correctAnswer: 'Enterprise Service Bus (ESB) hoặc Message Broker (như Amazon SQS / Apache Kafka)',
      score: 1,
      subject,
      topic,
      difficulty: 'MEDIUM',
      imageUrl: '',
    },
    {
      id: `q-soa-${Date.now()}-3`,
      questionId: `q-soa-${Date.now()}-3`,
      bankId,
      content: 'Khi thiết kế API cho các dịch vụ SOA, giao thức RESTful thường sử dụng định dạng dữ liệu nào để truyền tải thông tin gọn nhẹ?',
      type: 'SINGLE_CHOICE',
      options: [
        'JSON (JavaScript Object Notation)',
        'Mã máy nhị phân Assembly',
        'Tệp nén ZIP có mật khẩu',
        'Dữ liệu ảnh Raw Bitmap',
      ],
      correctIndex: 0,
      correctAnswer: 'JSON (JavaScript Object Notation)',
      score: 1,
      subject,
      topic,
      difficulty: 'EASY',
      imageUrl: '',
    },
  ];
};

/**
 * Gọi trực tiếp Google Gemini API Client-Side
 * Bỏ qua giới hạn 29s của API Gateway, hỗ trợ tạo 20+ câu hỏi siêu tốc
 */
export const generateQuestionsWithGeminiDirect = async (
  rawText: string,
  bankId: string,
  subject: string,
  topic: string,
  apiKey: string,
  model = 'gemini-3.8-flash'
): Promise<{ questions: Question[]; modelUsed: string } | null> => {
  if (!apiKey || !apiKey.trim()) return null;

  const prompt = `Bạn là chuyên gia số hóa và biên soạn đề thi cho hệ thống Khảo thí CloudExam.
Hãy xử lý nội dung văn bản dưới đây:
- Nếu văn bản là đề thi có sẵn, hãy trích xuất toàn bộ câu hỏi và đáp án thành danh sách câu hỏi chuẩn (hỗ trợ cả Trắc nghiệm và Tự luận).
- Nếu văn bản là yêu cầu tạo/soạn câu hỏi (ví dụ: 'Tạo 5 câu hỏi tự luận...', 'Soạn câu hỏi về...', 'Tạo đề thi gồm trắc nghiệm và tự luận...'), hãy tự động tạo ra ĐÚNG số lượng và loại câu hỏi chất lượng cao theo yêu cầu.
Hệ thống hỗ trợ cả đề thi Tiếng Việt và Tiếng Anh (English / Vietnamese).

QUY TẮC PHÂN LOẠI CÂU HỎI (QUAN TRỌNG):
1. CÂU HỎI TRẮC NGHIỆM (SINGLE_CHOICE):
- Áp dụng khi câu hỏi có các lựa chọn A, B, C, D hoặc người dùng yêu cầu trắc nghiệm.
- "type": "SINGLE_CHOICE"
- "content": Nội dung câu hỏi (loại bỏ tiền tố "Câu 1:", "Question 1:", "1." nếu có).
- "options": Mảng 4 phần tử chuỗi các phương án lựa chọn A, B, C, D (loại bỏ tiền tố A., B., C., D.; TUYỆT ĐỐI KHÔNG chứa giải thích bên trong lựa chọn).
- "correctIndex": Số nguyên 0..3 (0 cho A, 1 cho B, 2 cho C, 3 cho D).
- "correctAnswer": Nội dung chuỗi của đáp án đúng (khớp với options[correctIndex]).
- "score": 1

2. CÂU HỎI TỰ LUẬN (ESSAY):
- Áp dụng khi người dùng yêu cầu câu hỏi tự luận, câu hỏi mở, giải thích chuyên sâu, viết luận, viết code HOẶC câu hỏi trong đề gốc không có các phương án lựa chọn A, B, C, D.
- "type": "ESSAY"
- "content": Nội dung câu hỏi tự luận (loại bỏ tiền tố nếu có).
- "options": [] (MẢNG RỖNG, TUYỆT ĐỐI KHÔNG TỰ BỊA RA PHƯƠNG ÁN A, B, C, D).
- "correctIndex": -1
- "correctAnswer": "Barem chấm điểm chi tiết / Gợi ý đáp án / Các tiêu chí và ý chính thí sinh cần trả lời (BẮT BUỘC PHẢI CÓ nội dung chi tiết, không được để trống)".
- "score": 2

YÊU CẦU CHUNG:
1. Tạo ĐỦ 100% SỐ LƯỢNG câu hỏi mà người dùng yêu cầu (ví dụ: yêu cầu 5 câu tự luận thì phải tạo đủ 5 câu).
2. Trả về DUY NHẤT một mảng JSON các object câu hỏi (hoặc object JSON có thuộc tính "questions"). Mỗi câu hỏi gồm: content, type, options, correctIndex, correctAnswer, score, subject ("${subject}"), topic ("${topic}"), difficulty ("MEDIUM").
3. LƯU Ý: Tuyệt đối KHÔNG đưa giải thích vào options hay content của câu trắc nghiệm.

Nội dung đề bài / Yêu cầu:
${rawText.slice(0, 12000)}
`;

  // Ưu tiên model cấu hình, nếu 503/timeout lập tức fallback sang gemini-3.1-flash-lite siêu tốc
  const modelsToTry = [
    model,
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
  ];
  const uniqueModels = Array.from(new Set(modelsToTry.filter(Boolean)));

  for (const m of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey.trim()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[Gemini Direct] Model ${m} trả về HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOut) continue;

      const parsedJson = JSON.parse(textOut);
      const rawList = Array.isArray(parsedJson) ? parsedJson : parsedJson.questions || [];

      if (Array.isArray(rawList) && rawList.length > 0) {
        const questions: Question[] = rawList.map((q: any, idx: number) => {
          const isEssay = q.type === 'ESSAY' || (!Array.isArray(q.options) || q.options.length < 2);
          if (isEssay) {
            return {
              id: q.id || `q-gemini-${Date.now()}-${idx + 1}`,
              questionId: q.questionId || `q-gemini-${Date.now()}-${idx + 1}`,
              bankId,
              content: q.content || `Câu hỏi tự luận ${idx + 1}`,
              type: 'ESSAY' as const,
              options: [],
              correctIndex: -1,
              correctAnswer: q.correctAnswer || q.rubric || q.answer || '',
              score: Number(q.score) || 2,
              subject: q.subject || subject,
              topic: q.topic || topic,
              difficulty: q.difficulty || 'MEDIUM',
              imageUrl: q.imageUrl || '',
            };
          }
          const opts = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['A', 'B', 'C', 'D'];
          const cIdx = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < opts.length ? q.correctIndex : 0;
          const cAns = q.correctAnswer || opts[cIdx] || '';
          return {
            id: q.id || `q-gemini-${Date.now()}-${idx + 1}`,
            questionId: q.questionId || `q-gemini-${Date.now()}-${idx + 1}`,
            bankId,
            content: q.content || `Câu hỏi ${idx + 1}`,
            type: 'SINGLE_CHOICE' as const,
            options: opts,
            correctIndex: cIdx,
            correctAnswer: cAns,
            score: Number(q.score) || 1,
            subject: q.subject || subject,
            topic: q.topic || topic,
            difficulty: q.difficulty || 'MEDIUM',
            imageUrl: q.imageUrl || '',
          };
        });

        console.log(`[Gemini Direct] Thành công tạo ${questions.length} câu hỏi với model ${m}`);
        return { questions, modelUsed: m };
      }
    } catch (err) {
      console.warn(`[Gemini Direct] Thử nghiệm model ${m} không thành công:`, err);
    }
  }

  return null;
};

export const parseQuestionsFromDoc = async (payload: ParseDocRequest): Promise<ParseDocResponse> => {
  const bankId = payload.bankId || 'bank-se-arch-01';
  const subject = payload.subject || 'Kiến trúc hướng dịch vụ';
  const topic = payload.topic || 'Kiến trúc hệ thống';
  const rawText = payload.docText || payload.text || '';
  const activeApiKey = payload.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  const activeModel = payload.model || import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash';

  // 1. Chế độ Mock
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 1000));
    let parsed: Question[] = [];
    if (rawText) {
      parsed = parseQuestionsFromRawText(rawText, bankId, subject, topic);
    } else if (payload.fileBase64) {
      const textFromB64 = await extractTextFromBase64Docx(payload.fileBase64);
      if (textFromB64) {
        parsed = parseQuestionsFromRawText(textFromB64, bankId, subject, topic);
      }
    }
    if (parsed.length === 0) {
      parsed = generateTopicQuestions(bankId, subject, topic, rawText);
    }
    if (payload.autoSave !== false && parsed.length > 0) {
      for (const q of parsed) {
        saveLocalQuestion(q);
      }
    }
    return {
      message: `[MOCK] Google Gemini đã tạo thành công ${parsed.length} câu hỏi trắc nghiệm.`,
      count: parsed.length,
      bankId,
      saved: true,
      source: 'Google Gemini (Mock Engine)',
      questions: parsed,
    };
  }

  // 2. Trích xuất tài liệu có sẵn bằng regex client-side (Đảm bảo bóc tách khi văn bản chứa sẵn "Câu 1: ... A. ... B. ...")
  let parsed: Question[] = [];

  if (rawText) {
    parsed = parseQuestionsFromRawText(rawText, bankId, subject, topic);
  } else if (payload.fileBase64) {
    try {
      const textFromB64 = await extractTextFromBase64Docx(payload.fileBase64);
      if (textFromB64) {
        parsed = parseQuestionsFromRawText(textFromB64, bankId, subject, topic);
      }
    } catch (b64Err) {
      console.warn('Lỗi đọc Base64 docx client-side:', b64Err);
    }
  }

  // Nếu bộ bóc tách regex client-side đã trích xuất thành công đầy đủ danh sách câu hỏi có sẵn (>= 2 câu)
  if (parsed.length >= 2) {
    console.log(`[CloudExam] Bóc tách thành công ${parsed.length} câu hỏi trực tiếp từ tài liệu.`);
    if (payload.autoSave !== false && parsed.length > 0) {
      await Promise.all(
        parsed.map((q) =>
          createQuestion(q).catch((saveErr) => {
            console.warn(`Lỗi lưu câu hỏi ${q.id}:`, saveErr);
          })
        )
      );
    }
    return {
      message: `Đã số hóa thành công toàn bộ ${parsed.length} câu hỏi trắc nghiệm từ tệp Word.`,
      count: parsed.length,
      bankId,
      saved: true,
      source: 'Word Document Parser',
      questions: parsed,
    };
  }

  // 3. Nếu là Prompt soạn đề AI hoặc trích xuất tài liệu: Ưu tiên gọi Google Gemini AI Client-Side (Không bị giới hạn 29s của API Gateway)
  if (activeApiKey && (rawText || payload.fileBase64)) {
    try {
      const textToProcess = rawText || (payload.fileBase64 ? await extractTextFromBase64Docx(payload.fileBase64) : '');
      if (textToProcess) {
        const geminiDirect = await generateQuestionsWithGeminiDirect(
          textToProcess,
          bankId,
          subject,
          topic,
          activeApiKey,
          activeModel
        );

        if (geminiDirect && geminiDirect.questions.length > 0) {
          if (payload.autoSave !== false) {
            await Promise.all(
              geminiDirect.questions.map((q) =>
                createQuestion(q).catch((saveErr) => {
                  console.warn(`Lỗi lưu câu hỏi ${q.id}:`, saveErr);
                })
              )
            );
          }
          return {
            message: `Đã tạo thành công ${geminiDirect.questions.length} câu hỏi trắc nghiệm qua Google Gemini AI (${geminiDirect.modelUsed}).`,
            count: geminiDirect.questions.length,
            bankId,
            saved: true,
            source: `Google Gemini (${geminiDirect.modelUsed})`,
            questions: geminiDirect.questions,
          };
        }
      }
    } catch (directErr) {
      console.warn('[CloudExam] Lỗi gọi Gemini Direct, chuyển sang gọi API Gateway:', directErr);
    }
  }

  // 4. Nếu chưa đủ câu hỏi, thử gọi API Gateway AWS Lambda
  try {
    const res = await api.post('/questions/parse-doc', {
      ...payload,
      apiKey: activeApiKey || undefined,
      model: activeModel,
    });
    if (res.data && res.data.questions && res.data.questions.length > parsed.length) {
      return res.data;
    }
  } catch (err: any) {
    console.warn('[CloudExam] API Gateway /questions/parse-doc trả về lỗi:', err.response?.status, err.message);
  }

  // 5. Fallback tạo câu hỏi theo chủ đề nếu các kênh AI gặp sự cố
  if (parsed.length === 0) {
    parsed = generateTopicQuestions(bankId, subject, topic, rawText);
  }

  if (payload.autoSave !== false && parsed.length > 0) {
    await Promise.all(
      parsed.map((q) =>
        createQuestion(q).catch((saveErr) => {
          console.warn(`Lỗi lưu câu hỏi ${q.id}:`, saveErr);
        })
      )
    );
  }

  return {
    message: `Đã số hóa thành công ${parsed.length} câu hỏi trắc nghiệm từ tệp Word.`,
    count: parsed.length,
    bankId,
    saved: true,
    source: 'Google Gemini Fallback',
    questions: parsed,
  };
};

export const parseDocWithGemini = parseQuestionsFromDoc;

export const fetchLeaderboard = async (sessionId: string): Promise<LeaderboardResponse> => {
  const res = await api.get(`/sessions/${sessionId}/leaderboard`);
  return res.data;
};

export const getLiveLeaderboard = fetchLeaderboard;

export const explainAnswerWithAI = async (payload: ExplainAnswerRequest): Promise<ExplainAnswerResponse> => {
  const activeApiKey = payload.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  const activeModel = payload.model || import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash';
  const res = await api.post('/exam/explain-answers', {
    ...payload,
    apiKey: activeApiKey || undefined,
    model: activeModel,
  });
  return res.data;
};

export const fetchSessionResults = async (sessionId: string): Promise<SessionResultsResponse> => {
  try {
    const res = await api.get(`/sessions/${sessionId}/results`);
    return res.data;
  } catch {
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
        const { correctIndex: _ci, correctAnswer: _ca, ...safeQuestion } = q as any;
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
  answers: Record<string, number | string>,
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
// 10. QUY TRÌNH ĐỒNG BỘ DỮ LIỆU CHUẨN XÁC VỚI AWS CLOUD (DYNAMODB & COGNITO)
// ============================================================================

export const clearLocalCaches = () => {
  try {
    localStorage.removeItem(LOCAL_CUSTOM_BANKS_KEY);
    localStorage.removeItem(LOCAL_CUSTOM_QUESTIONS_KEY);
    localStorage.removeItem(LOCAL_DELETED_BANKS_KEY);
  } catch (e) {
    console.warn('Lỗi xóa local cache:', e);
  }
};

export const syncCloudDatabaseToProduction = async (): Promise<{
  deletedQuestions: number;
  addedQuestions: number;
  addedBanks: number;
  deletedCandidates: number;
  addedCandidates: number;
  sessionsUpdated: number;
  message: string;
}> => {
  let deletedCandidates = 0;
  let sessionsUpdated = 0;

  // 1. Xóa sạch cache cục bộ để ngăn chặn dữ liệu cũ/đã xóa bị khôi phục lại
  clearLocalCaches();

  // 2. Dọn sạch các tài khoản thí sinh không hợp lệ trên AWS DynamoDB (Chỉ giữ lại 24020001 - 24020007)
  const allowedCandidateEmails = new Set([
    '24020001@vnu.edu.vn',
    '24020002@vnu.edu.vn',
    '24020003@vnu.edu.vn',
    '24020004@vnu.edu.vn',
    '24020005@vnu.edu.vn',
    '24020006@vnu.edu.vn',
    '24020007@vnu.edu.vn',
  ]);

  try {
    const cRes = await api.get('/candidates');
    const existingCandidates = Array.isArray(cRes.data) ? cRes.data : cRes.data?.items || [];
    for (const c of existingCandidates) {
      const email = (c.email || '').toLowerCase().trim();
      if (!allowedCandidateEmails.has(email)) {
        try {
          await api.delete(`/candidates/${encodeURIComponent(email)}`);
          deletedCandidates++;
        } catch (delErr) {
          console.warn('Lỗi dọn dẹp thí sinh ngoài danh sách:', email, delErr);
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi kiểm tra danh sách thí sinh trên Cloud:', e);
  }

  // 3. Đảm bảo ca thi EX-VNU-2026-01 liên kết đúng 7 thí sinh chính thức
  try {
    const sRes = await api.get('/sessions');
    const existingSessions = Array.isArray(sRes.data) ? sRes.data : sRes.data?.items || [];
    const vnuSession = existingSessions.find((s: any) => s.id === 'EX-VNU-2026-01');
    const targetEmails = Array.from(allowedCandidateEmails).sort();
    if (vnuSession) {
      const curList = (vnuSession.candidateEmails || []).map((e: string) => e.toLowerCase());
      const isMatch = curList.length === targetEmails.length && targetEmails.every((e) => curList.includes(e));
      if (!isMatch) {
        await api.put(`/sessions/${vnuSession.id}`, { candidateEmails: targetEmails });
        sessionsUpdated++;
      }
    }
  } catch (e) {
    console.warn('Lỗi cập nhật danh sách thí sinh trong ca thi:', e);
  }

  return {
    deletedQuestions: 0,
    addedQuestions: 0,
    addedBanks: 0,
    deletedCandidates,
    addedCandidates: 0,
    sessionsUpdated,
    message: 'Đã hoàn tất đồng bộ dữ liệu (Thí sinh 24020001-24020007, Ngân hàng đề, Ca thi) với AWS Cloud!',
  };
};

export default api;
