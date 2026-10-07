import React, { useState, useEffect } from 'react';
import { redirectToCognitoLogin, logout } from '../services/auth';
import { uploadQuestionImage } from '../services/s3Service';
import { getQuestions, createQuestion } from '../services/apiService';

export const QuestionManager = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [difficulty, setDifficulty] = useState('EASY');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const token = localStorage.getItem('access_token');

  useEffect(() => {
    if (token) fetchQuestions();
  }, [token]);

  const fetchQuestions = async () => {
    try {
      const res = await getQuestions();
      setQuestions(res.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách câu hỏi', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let imageUrl = '';
      // 1. Upload ảnh lên S3 (nếu có chọn file)
      if (imageFile) {
        imageUrl = await uploadQuestionImage(imageFile);
      }

      // 2. Gửi dữ liệu câu hỏi + URL ảnh về API Gateway -> Lambda -> DynamoDB
      await createQuestion({
        content,
        difficulty,
        imageUrl,
      });

      alert('Thêm câu hỏi thành công!');
      setContent('');
      setImageFile(null);
      fetchQuestions(); // Reload danh sách
    } catch (err) {
      alert('Thất bại: ' + err);
    } finally {
      setUploading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <h1 className="text-3xl font-bold mb-4">Hệ thống Ngân hàng Câu hỏi CloudExam</h1>
        <button
          onClick={redirectToCognitoLogin}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition"
        >
          Đăng nhập bằng AWS Cognito
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quản lý Ngân hàng Câu hỏi</h1>
        <button onClick={logout} className="text-red-600 hover:underline">
          Đăng xuất
        </button>
      </div>

      {/* Form Tạo/Sửa câu hỏi */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4">Thêm câu hỏi mới</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Nội dung câu hỏi</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border p-2 rounded-md"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Mức độ</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border p-2 rounded-md"
            >
              <option value="EASY">Dễ</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HARD">Khó</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hình ảnh đính kèm (S3)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          {uploading ? 'Đang upload ảnh & lưu...' : 'Lưu câu hỏi'}
        </button>
      </form>

      {/* Danh sách câu hỏi */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Danh sách câu hỏi hiện có</h2>
        <ul className="divide-y">
          {questions.map((q) => (
            <li key={q.questionId} className="py-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{q.content}</p>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded mr-2">{q.difficulty}</span>
                {q.imageUrl && (
                  <a
                    href={q.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 underline ml-2"
                  >
                    Xem ảnh đính kèm
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};