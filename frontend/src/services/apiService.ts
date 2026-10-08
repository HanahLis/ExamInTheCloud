import axios from 'axios';

const MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

// Cognito Authorizer của API Gateway mặc định cần id_token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('id_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Question {
  id: string;
  content: string;
  options: string[];      // 4 đáp án A-D
  correctIndex: number;   // vị trí đáp án đúng (0-3)
  score: number;
  difficulty: Difficulty;
  imageUrl?: string;
}

export type QuestionInput = Omit<Question, 'id'>;

let mockDb: Question[] = [
  {
    id: '1',
    content: 'Dịch vụ lưu trữ đối tượng của AWS là gì?',
    options: ['Amazon S3', 'Amazon RDS', 'Amazon SQS', 'Amazon VPC'],
    correctIndex: 0,
    score: 1,
    difficulty: 'EASY',
    imageUrl: '',
  },
];
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 200));

export const getQuestions = async (): Promise<Question[]> => {
  if (MOCK) return wait([...mockDb]);
  const data = (await api.get('/questions')).data;
  const list = Array.isArray(data) ? data : data.items ?? [];
  // Backend có thể trả `questionId`, map về `id` cho thống nhất
  return list.map((q: any) => ({
    ...q,
    id: q.id ?? q.questionId,
    options: q.options ?? [],
    correctIndex: q.correctIndex ?? 0,
    score: q.score ?? 1,
  }));
};

export const createQuestion = async (data: QuestionInput) => {
  if (MOCK) {
    const q = { ...data, id: crypto.randomUUID() };
    mockDb.push(q);
    return wait(q);
  }
  return (await api.post('/questions', data)).data;
};

export const updateQuestion = async (id: string, data: Partial<QuestionInput>) => {
  if (MOCK) {
    mockDb = mockDb.map((q) => (q.id === id ? { ...q, ...data } : q));
    return wait(true);
  }
  return (await api.put(`/questions/${id}`, data)).data;
};

export const deleteQuestion = async (id: string) => {
  if (MOCK) {
    mockDb = mockDb.filter((q) => q.id !== id);
    return wait(true);
  }
  return (await api.delete(`/questions/${id}`)).data;
};

export default api;