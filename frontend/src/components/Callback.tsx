import { useEffect, useState } from 'react';
import { handleAuthCallback } from '../services/auth';

export const Callback = () => {
  const [error, setError] = useState('');

  useEffect(() => {
    handleAuthCallback()
      .then(() => window.location.replace('/'))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-red-600">Đăng nhập thất bại</h1>
          <p className="text-sm text-slate-600 break-words">{error}</p>
          <a href="/" className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Quay lại trang đăng nhập
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Đang xác thực tài khoản qua AWS Cognito...</p>
      </div>
    </div>
  );
};
