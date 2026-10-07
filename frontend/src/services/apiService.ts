import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Interceptor: Đính kèm Token vào Header trước khi gửi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Định nghĩa các hàm CRUD gọi API của Tấn
export const getQuestions = () => api.get('/questions');
export const createQuestion = (data: any) => api.post('/questions', data);
export const updateQuestion = (id: string, data: any) => api.put(`/questions/${id}`, data);
export const deleteQuestion = (id: string) => api.delete(`/questions/${id}`);