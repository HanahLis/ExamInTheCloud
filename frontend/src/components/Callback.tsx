import { useEffect } from 'react';
import { handleAuthCallback } from '../services/auth';

export const Callback = () => {
  useEffect(() => {
    handleAuthCallback(); // Bóc id_token & access_token rồi về trang chính
  }, []);

  return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Đang xác thực tài khoản qua AWS Cognito...</p>
      </div>
    </div>
  );
};
