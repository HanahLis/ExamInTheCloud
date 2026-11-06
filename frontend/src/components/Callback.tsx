import { useEffect, useState } from 'react';
import { handleAuthCallback } from '../services/auth';
import { useTranslation } from '../locales/i18nContext';

export const Callback = () => {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  useEffect(() => {
    handleAuthCallback()
      .then(() => window.location.replace('/'))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 p-4">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm max-w-sm w-full text-center space-y-3">
          <h1 className="text-base font-semibold text-rose-600">{t('auth_login_failed_title')}</h1>
          <p className="text-xs text-slate-600 break-words">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition"
          >
            {t('auth_back_to_login')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
      <div className="text-center">
        <p className="text-xs text-slate-500">{t('auth_processing_login')}</p>
      </div>
    </div>
  );
};
