import axios from 'axios';
import JSZip from 'jszip';

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

// Tự động xử lý khi Token bị lỗi 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[CloudExam API] Phản hồi 401 Unauthorized từ API Gateway.');
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
  submissions?: Record<string, any>;
  draftSubmissions?: Record<string, any>;
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
  roomPassword?: string;
  lockedCandidates?: Record<
    string,
    {
      locked: boolean;
      deviceToken: string;
      candidateName?: string;
      lockedAt?: string;
      similarity?: number;
    }
  >;
  createdAt?: string;
  submissions?: Record<string, any>;
  draftSubmissions?: Record<string, any>;
}

export interface FaceVerifyRequest {
  sessionId: string;
  capturedImage?: string; // Chuỗi Base64 chụp từ webcam
  capturedS3Key?: string; // Hoặc S3 key
  email?: string;         // Email thí sinh
  roomPassword?: string;  // Mật khẩu phòng thi
  deviceToken?: string;   // Token định danh thiết bị
}

export interface FaceVerifyResponse {
  status: 'PASS' | 'FAIL';
  verified: boolean;
  similarity: number;
  message: string;
  candidateName?: string;
  deviceToken?: string;
  locked?: boolean;
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
  lang?: string;
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

const BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME || '';
const S3_BASE = BUCKET_NAME ? `https://${BUCKET_NAME}.s3.${import.meta.env.VITE_AWS_REGION || 'ap-southeast-1'}.amazonaws.com` : '';

export const resolveSessionStatus = (
  status?: string | null,
  startTime?: string,
  endTime?: string
): SessionStatus => {
  // Tôn trọng trạng thái rõ ràng do giảng viên/backend đặt (Tạm dừng/Kết thúc...)
  if (status === 'CLOSED' || status === 'RUNNING' || status === 'SCHEDULED') {
    return status;
  }

  const now = Date.now();
  const start = startTime ? new Date(startTime).getTime() : 0;
  const end = endTime ? new Date(endTime).getTime() : Infinity;

  if (now > end) return 'CLOSED';
  if (now >= start && now <= end) {
    return 'RUNNING';
  }
  return 'SCHEDULED';
};

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

export const getQuestionBanks = async (ownerEmail?: string): Promise<QuestionBank[]> => {
  const params = ownerEmail ? { ownerEmail } : undefined;
  const res = await api.get('/question-banks', { params });
  const data = res.data;
  const list = Array.isArray(data) ? data : data.items ?? [];
  return list.map((b: any) => ({
    id: b.id || b.bankId,
    bankId: b.bankId || b.id,
    name: b.name || '',
    subject: b.subject || '',
    description: b.description || '',
    createdAt: b.createdAt,
    ownerEmail: b.ownerEmail || b.createdBy,
    createdBy: b.createdBy || b.ownerEmail,
  }));
};

export const createQuestionBank = async (data: QuestionBankInput): Promise<QuestionBank> => {
  const bankId = data.id || data.bankId || 'bank-' + Math.random().toString(36).substring(2, 10);
  const fullBank: QuestionBank = {
    ...data,
    id: bankId,
    bankId,
    name: data.name,
    subject: data.subject || '',
    description: data.description || '',
    ownerEmail: data.ownerEmail || data.createdBy,
    createdBy: data.createdBy || data.ownerEmail,
    createdAt: new Date().toISOString(),
  };
  const res = await api.post('/question-banks', fullBank);
  return res.data || fullBank;
};

export const deleteQuestionBank = async (bankId: string): Promise<any> => {
  const allQuestions = await getQuestions().catch(() => [] as Question[]);
  await Promise.all(
    allQuestions
      .filter((q) => q.bankId === bankId)
      .map((q) => api.delete(`/questions/${q.id}`).catch(() => undefined))
  );

  try {
    const res = await api.post('/question-banks', { action: 'DELETE', id: bankId });
    return res.data;
  } catch {
    const res = await api.delete(`/question-banks/${bankId}`);
    return res.data;
  }
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
    bankId: q.bankId || '',
    type: q.type || 'SINGLE_CHOICE',
    options: q.options ?? [],
    correctIndex: Number(q.correctIndex ?? 0),
    correctAnswer: q.correctAnswer || (q.options ? q.options[q.correctIndex] : ''),
    score: Number(q.score ?? 1),
    subject: q.subject || '',
    topic: q.topic || '',
    difficulty: q.difficulty || 'EASY',
    imageUrl: q.imageUrl || '',
    explanation: q.explanation || '',
  }));
};

export const createQuestion = async (data: QuestionInput): Promise<Question> => {
  const qId = data.id || data.questionId || 'q-' + Math.random().toString(36).substring(2, 10);
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
    subject: data.subject || '',
    topic: data.topic || '',
    difficulty: data.difficulty || 'MEDIUM',
    imageUrl: data.imageUrl || '',
  };
  delete (fullQ as any).explanation;

  const res = await api.post('/questions', fullQ);
  return res.data || fullQ;
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
  return res.data || data;
};

export const deleteCandidate = async (email: string): Promise<any> => {
  try {
    const res = await api.delete(`/candidates/${email}`);
    return res.data;
  } catch {
    const res = await api.delete(`/candidates/${encodeURIComponent(email)}`);
    return res.data;
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
    name: s.name || s.title || '',
    startTime: s.startTime || '',
    endTime: s.endTime || '',
    status: resolveSessionStatus(s.status, s.startTime, s.endTime),
    questionIds: s.questionIds ?? [],
    candidateEmails: s.candidateEmails ?? [],
    roomPassword: s.roomPassword,
    lockedCandidates: s.lockedCandidates ?? {},
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
  const sessionId = data.id || `EX-${Date.now().toString(36).toUpperCase()}`;
  const roomPassword = data.roomPassword || `${Math.floor(100000 + Math.random() * 900000)}`;
  const res = await api.post('/sessions', { ...data, id: sessionId, roomPassword });
  return res.data || {
    ...data,
    id: sessionId,
    roomPassword,
    link: `${typeof window !== 'undefined' ? window.location.origin : ''}/?exam=${sessionId}`,
    createdAt: new Date().toISOString(),
  };
};

export const updateSessionDetails = async (
  id: string,
  data: Partial<ExamSession>
): Promise<any> => {
  const res = await api.put(`/sessions/${id}`, data);
  return res.data;
};

export const unlockCandidateInSession = async (
  sessionId: string,
  candidateEmail: string
): Promise<any> => {
  const normEmail = candidateEmail.trim().toLowerCase();
  const session = await getSession(sessionId);
  const updated = { ...(session.lockedCandidates || {}) };
  delete updated[normEmail];
  delete updated[candidateEmail];
  return updateSessionDetails(sessionId, { lockedCandidates: updated });
};

export const updateSessionStatus = async (id: string, status: SessionStatus): Promise<any> => {
  const res = await api.put(`/sessions/${id}`, { status });
  return res.data;
};

export const updateSessionCandidates = async (id: string, candidateEmails: string[]): Promise<any> => {
  const res = await api.put(`/sessions/${id}`, { candidateEmails });
  return res.data;
};

// ============================================================================
// 6. FACE VERIFICATION API (/auth/face-verify - Amazon Rekognition)
// ============================================================================

export const verifyFace = async (req: FaceVerifyRequest): Promise<FaceVerifyResponse> => {
  const targetEmail = (req.email || '').trim().toLowerCase();

  let candidateName = '';
  if (targetEmail) {
    const candRes = await api.get(`/candidates/${targetEmail}`).catch(() => null);
    if (candRes?.data) {
      candidateName = candRes.data.name || '';
    } else {
      const allCands = await getCandidates().catch(() => [] as Candidate[]);
      const match = allCands.find((c) => c.email.toLowerCase() === targetEmail);
      if (match) candidateName = match.name;
    }
  }

  const deviceTokenKey = `cloudexam_cand_token_${req.sessionId}_${targetEmail}`;
  let deviceToken = req.deviceToken || localStorage.getItem(deviceTokenKey) || '';
  if (!deviceToken) {
    deviceToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  const payload: {
    sessionId: string;
    email: string;
    capturedS3Key?: string;
    capturedImage?: string;
    roomPassword?: string;
    deviceToken?: string;
  } = {
    sessionId: req.sessionId,
    email: targetEmail,
    roomPassword: req.roomPassword,
    deviceToken,
  };

  if (req.capturedS3Key) {
    payload.capturedS3Key = req.capturedS3Key;
  } else if (req.capturedImage) {
    payload.capturedImage = req.capturedImage;
  }

  try {
    const res = await api.post('/auth/face-verify', payload);
    if (res.data && res.data.verified) {
      localStorage.setItem(deviceTokenKey, res.data.deviceToken || deviceToken);
    }
    return res.data;
  } catch (err: any) {
    const errorData = err?.response?.data;
    const msg =
      errorData?.message || errorData?.error || errorData?.details || err?.message || '';

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
          'Không nhận diện được khuôn mặt trong ảnh thẻ hồ sơ hoặc ảnh chụp camera. Vui lòng kiểm tra lại ảnh thẻ và hướng thẳng vào camera.',
      };
    }

    if (errorData && typeof errorData.verified === 'boolean') {
      return errorData;
    }

    let friendlyMessage = msg;
    if (msg === 'Forbidden' || err?.response?.status === 403) {
      friendlyMessage =
        'Khuôn mặt không khớp với ảnh hồ sơ hoặc phiên làm việc đã hết hạn. Vui lòng chụp lại rõ mặt hoặc liên hệ Giảng viên.';
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

/**
 * Chuẩn hóa tên model Google Gemini sang model chính thức được hỗ trợ (bao gồm cả dòng Gemini 3.8/3.7/3.6 Flash)
 */
export const normalizeGeminiModel = (modelName?: string): string => {
  const m = (modelName || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!m) {
    return 'gemini-3.6-flash';
  }
  if ([
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-lite',
  ].includes(m)) {
    return m;
  }
  return m;
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
  model = 'gemini-3.6-flash',
  lang?: string
): Promise<{ questions: Question[]; modelUsed: string } | null> => {
  if (!apiKey || !apiKey.trim()) return null;

  // Tự động nhận diện ngôn ngữ đích từ yêu cầu hoặc cài đặt
  const detectedLang: 'de' | 'en' | 'la' | 'vi' = (() => {
    if (lang && ['de', 'en', 'la', 'vi'].includes(lang)) return lang as any;
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cloudexam_lang') : null;
    if (saved && ['de', 'en', 'la', 'vi'].includes(saved)) return saved as any;
    const lower = rawText.toLowerCase();
    if (/[\u0E80-\u0EFF]/.test(rawText) || lower.includes('ພາສາລາວ') || lower.includes('ຄຳຖາມ')) return 'la';
    if (/\b(erstelle|fragen?|antworten?|welche[rs]?|deutsch|deutschland|bitte|multiple-choice|wähle|optionen)\b/i.test(lower)) return 'de';
    if (/\b(generate|create|questions?|which|what|choose|select|following|answer|options?)\b/i.test(lower)) return 'en';
    return 'vi';
  })();

  const langDirective = {
    de: `QUAN TRỌNG VỀ NGÔN NGỮ (LANGUAGE REQUIREMENT - CỰC KỲ QUAN TRỌNG):
Người dùng đang yêu cầu bằng TIẾNG ĐỨC (GERMAN / DEUTSCH).
BẮT BUỘC 100% nội dung câu hỏi ("content"), các lựa chọn A, B, C, D ("options"), đáp án đúng ("correctAnswer") và gợi ý chấm điểm PHẢI ĐƯỢC VIẾT HOÀN TOÀN BẰNG TIẾNG ĐỨC (GERMAN).
TUYỆT ĐỐI KHÔNG sinh câu hỏi bằng tiếng Việt hoặc tiếng Anh.`,
    en: `LANGUAGE REQUIREMENT (CRITICAL):
The user requested questions in ENGLISH.
All question contents ("content"), options ("options"), and correct answers ("correctAnswer") MUST BE WRITTEN 100% IN ENGLISH.
DO NOT output in Vietnamese.`,
    la: `ຂໍ້ກຳນົດດ້ານພາສາ (LANGUAGE REQUIREMENT - CRITICAL):
ຜູ້ໃຊ້ຕ້ອງການຄຳຖາມເປັນ ພາສາລາວ (LAO LANGUAGE).
ເນື້ອໃນຄຳຖາມ ("content"), ຕົວເລືອກ ("options") ແລະ ຄຳຕອບທີ່ຖືກຕ້ອງ ("correctAnswer") ທັງໝົດ ຕ້ອງຂຽນເປັນພາສາລາວ.
ຫ້າມສ້າງເປັນພາສາຫວຽດນາມ.`,
    vi: `YÊU CẦU NGÔN NGỮ:
Sinh toàn bộ câu hỏi, phương án và đáp án bằng TIẾNG VIỆT.`,
  }[detectedLang];

  const prompt = `Bạn là chuyên gia số hóa và biên soạn đề thi cho hệ thống Khảo thí CloudExam.
Hãy xử lý nội dung văn bản dưới đây:
- Nếu văn bản là đề thi có sẵn, hãy trích xuất toàn bộ câu hỏi và đáp án thành danh sách câu hỏi chuẩn (hỗ trợ cả Trắc nghiệm và Tự luận).
- Nếu văn bản là yêu cầu tạo/soạn câu hỏi (ví dụ: 'Tạo 5 câu hỏi tự luận...', 'Soạn câu hỏi về...', 'Tạo đề thi gồm trắc nghiệm và tự luận...'), hãy tự động tạo ra ĐÚNG số lượng và loại câu hỏi chất lượng cao theo yêu cầu.
Hệ thống hỗ trợ đa ngôn ngữ quốc tế (Đức, Anh, Lào, Việt).

${langDirective}

QUY TẮC PHÂN LOẠI CÂU HỎI (QUAN TRỌNG):
1. CÂU HỎI TRẮC NGHIỆM (SINGLE_CHOICE):
- Áp dụng khi câu hỏi có các lựa chọn A, B, C, D hoặc người dùng yêu cầu trắc nghiệm.
- "type": "SINGLE_CHOICE"
- "content": Nội dung câu hỏi (loại bỏ tiền tố "Câu 1:", "Question 1:", "Frage 1:", "1." nếu có).
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

  // Ưu tiên các model Google Gemini chính thức hỗ trợ JSON Mode
  // Các model 3.8/3.7-flash có thể treo rất lâu với một số key → xếp sau model phản hồi nhanh (3.6/3.5)
  const normalized = normalizeGeminiModel(model);
  const modelsToTry = Array.from(
    new Set([
      normalized,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash-lite',
    ].filter(Boolean))
  );

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey.trim()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
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

      if (res.status === 401 || res.status === 403) {
        console.warn(`[Gemini Direct] API Key bị từ chối trên model ${m} (HTTP ${res.status})`);
        break; // Dừng ngay khi key bị từ chối, tránh spam request vô ích
      }

      if (!res.ok) {
        console.warn(`[Gemini Direct] Model ${m} trả về HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOut) continue;

      let cleanText = textOut.trim();
      const jsonMatch = cleanText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        cleanText = jsonMatch[1];
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }

      const parsedJson = JSON.parse(cleanText);
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

/**
 * Kiểm tra nhanh API Key Gemini của người dùng (gọi 1 prompt siêu ngắn)
 * Trả về { ok, modelUsed, message } để hiển thị trạng thái trong UI
 */
export const testGeminiApiKey = async (
  apiKey: string,
  model = 'gemini-3.6-flash'
): Promise<{ ok: boolean; modelUsed: string; message: string }> => {
  const key = (apiKey || '').trim();
  if (!key) {
    return { ok: false, modelUsed: '', message: 'key_empty' };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(key)) {
    return { ok: false, modelUsed: '', message: 'key_invalid_format' };
  }

  const normalized = normalizeGeminiModel(model);
  const modelsToTry = Array.from(
    new Set([
      normalized,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash-lite',
    ].filter(Boolean))
  );

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
          // Model thế hệ 3.x tiêu tốn token reasoning trước khi trả text
          // → budget 8 token cũ khiến nội dung rỗng + MAX_TOKENS (tưởng nhầm là lỗi key)
          generationConfig: { maxOutputTokens: 256 },
        }),
      });
      clearTimeout(timeoutId);

      if (res.status === 401 || res.status === 403) {
        return { ok: false, modelUsed: m, message: 'key_rejected' };
      }
      if (res.status === 400) {
        // Google trả 400 INVALID_ARGUMENT với thông báo "API key not valid" khi key sai
        try {
          const errData = await res.json();
          const errMsg = errData?.error?.message || '';
          if (/key/i.test(errMsg)) {
            return { ok: false, modelUsed: m, message: 'key_rejected' };
          }
        } catch {
          /* body không parse được — xử lý như lỗi model, thử model khác */
        }
        continue;
      }
      if (!res.ok) continue;

      const data = await res.json();
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (textOut) {
        return { ok: true, modelUsed: m, message: 'ok' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') continue;
      console.warn(`[Gemini Test] Lỗi khi thử model ${m}:`, err);
    }
  }

  return { ok: false, modelUsed: modelsToTry[0] || '', message: 'key_network_error' };
};

export const parseQuestionsFromDoc = async (payload: ParseDocRequest): Promise<ParseDocResponse> => {
  const bankId = payload.bankId || 'bank-se-arch-01';
  const subject = payload.subject || 'Kiến trúc hướng dịch vụ';
  const topic = payload.topic || 'Kiến trúc hệ thống';
  const rawText = payload.docText || payload.text || '';
  const localStoredKey = typeof window !== 'undefined' ? localStorage.getItem('cloudexam_gemini_key') || '' : '';
  const localStoredModel = typeof window !== 'undefined' ? localStorage.getItem('cloudexam_gemini_model') || '' : '';
  const activeApiKey = payload.apiKey || localStoredKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  const activeModel = normalizeGeminiModel(payload.model || localStoredModel || import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash');
  const targetLang = payload.lang || (typeof window !== 'undefined' ? localStorage.getItem('cloudexam_lang') || 'vi' : 'vi');

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
          activeModel,
          targetLang
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
      lang: targetLang,
      apiKey: activeApiKey || undefined,
      model: activeModel,
    });
    if (res.data && res.data.questions && res.data.questions.length > parsed.length) {
      return res.data;
    }
  } catch (err: any) {
    console.warn('[CloudExam] API Gateway /questions/parse-doc trả về lỗi:', err.response?.status, err.message);
  }

  // 5. Không còn câu hỏi: không tự bịa đề, báo lỗi rõ ràng
  const noQuestionsMsg: Record<string, string> = {
    vi: 'Không thể trích xuất câu hỏi từ nội dung đã nhập. Vui lòng kiểm tra lại tệp hoặc cấu hình API Key Gemini.',
    en: 'Could not extract any questions from the provided content. Please check the file or configure a Gemini API key.',
    de: 'Aus dem eingegebenen Inhalt konnten keine Fragen extrahiert werden. Bitte prüfen Sie die Datei oder hinterlegen Sie einen Gemini-API-Schlüssel.',
    la: 'ບໍ່ສາມາດດຶງຄຳຖາມຈາກເນື້ອຫາທີ່ໃສ່ໄດ້. ກະລຸນາກວດສອບໄຟລ໌ ຫຼື ຕັ້ງຄ່າ API Key Gemini.',
  };
  throw new Error(noQuestionsMsg[targetLang] || noQuestionsMsg.en);
};

export const parseDocWithGemini = parseQuestionsFromDoc;

export const fetchLeaderboard = async (sessionId: string): Promise<LeaderboardResponse> => {
  const res = await api.get(`/sessions/${sessionId}/leaderboard`);
  return res.data;
};

export const getLiveLeaderboard = fetchLeaderboard;

export const explainAnswerWithAI = async (payload: ExplainAnswerRequest): Promise<ExplainAnswerResponse> => {
  const localStoredKey = typeof window !== 'undefined' ? localStorage.getItem('cloudexam_gemini_key') || '' : '';
  const localStoredModel = typeof window !== 'undefined' ? localStorage.getItem('cloudexam_gemini_model') || '' : '';
  const activeApiKey = payload.apiKey || localStoredKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  const activeModel = normalizeGeminiModel(payload.model || localStoredModel || import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash');
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
    // API Gateway không có route con /results: dựng kết quả từ session object
    const [sessRes, candRes] = await Promise.all([
      api.get(`/sessions/${sessionId}`),
      api.get('/candidates').catch(() => null),
    ]);

    const sessionData = sessRes.data;
    const rawCands = candRes?.data;
    const candidatesList: Candidate[] = Array.isArray(rawCands) ? rawCands : rawCands?.items || [];
    const submissionsMap = sessionData?.submissions || {};

    const results: CandidateSessionResult[] = Object.entries(submissionsMap).map(
      ([email, sub]: [string, any]) => {
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
          totalQuestions: sub.totalQuestions ?? 0,
          submittedAt: sub.submittedAt || '',
          status: sub.status || 'COMPLETED',
        };
      }
    );

    return {
      sessionId,
      sessionName: sessionData?.name || '',
      status: sessionData?.status || 'RUNNING',
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
    // Truy vấn thông tin ca thi và các câu hỏi, loại bỏ đáp án đúng (Anti-F12 theo Quy trình C)
    const [sessionData, allQuestions] = await Promise.all([
      getSession(sessionId),
      getQuestions(),
    ]);

    const sessionQIds: string[] = sessionData.questionIds || [];

    const matchedQuestions = allQuestions
      .filter((q) => sessionQIds.length === 0 || sessionQIds.includes(q.id || (q as any).questionId))
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
      questions: matchedQuestions.length > 0 ? matchedQuestions : allQuestions.slice(0, 5).map((q) => {
        const { correctIndex: _ci, correctAnswer: _ca, ...safeQuestion } = q as any;
        return safeQuestion as Question;
      }),
      draftAnswers: {},
    };
  }
};

export const saveExamProgress = async (
  sessionId: string,
  answers: Record<string, number | string>,
  candidateEmail?: string
): Promise<{ saved: boolean; updatedAt: string }> => {
  try {
    const res = await api.post('/exam/save-progress', {
      sessionId,
      candidateEmail,
      answers,
    });
    return res.data;
  } catch (err) {
    console.warn('[ExamProgress] Không lưu được tiến độ lên Cloud:', err);
    return { saved: false, updatedAt: new Date().toISOString() };
  }
};

export const sendSessionReport = async (sessionId: string): Promise<{ message: string }> => {
  const res = await api.post(`/sessions/${sessionId}/send-report`);
  return res.data;
};

export default api;
