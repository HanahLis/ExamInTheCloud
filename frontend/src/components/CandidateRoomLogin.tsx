import { useState, useEffect } from 'react';
import {
  getSession,
  getCandidates,
  resolveSessionStatus,
  type ExamSession,
  type Candidate,
  type SessionStatus,
} from '../services/apiService';
import { useTranslation } from '../locales/i18nContext';

interface Props {
  sessionId: string;
  onSuccess: (candidateEmail: string) => void;
  onSwitchToOrganizer: () => void;
  countryLanguageBar?: React.ReactNode;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
  RUNNING: 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_KEYS: Record<SessionStatus, string> = {
  SCHEDULED: 'sess_status_scheduled',
  RUNNING: 'sess_status_running',
  CLOSED: 'sess_status_closed',
};

export const CandidateRoomLogin = ({
  sessionId,
  onSuccess,
  onSwitchToOrganizer,
  countryLanguageBar,
}: Props) => {
  const { t, lang } = useTranslation();
  const dateLocale = lang === 'en' ? 'en-US' : lang === 'de' ? 'de-DE' : lang === 'la' ? 'lo-LA' : 'vi-VN';

  const [session, setSession] = useState<ExamSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSession = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [s, cands] = await Promise.all([
          getSession(sessionId),
          getCandidates().catch(() => []),
        ]);
        if (!isMounted) return;
        setSession(s);
        setCandidates(cands);

        // Tự động điền email đầu tiên nếu có danh sách thí sinh
        if (s.candidateEmails && s.candidateEmails.length > 0) {
          setInputEmail(s.candidateEmails[0]);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMsg(err?.response?.data?.error || err?.message || t('exam_not_found'));
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSession();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inputEmail.trim().toLowerCase();
    const cleanPassword = inputPassword.trim();

    if (!cleanEmail) {
      return alert(t('candidate_email_placeholder'));
    }
    if (!cleanPassword) {
      return alert(t('candidate_room_password_placeholder'));
    }
    if (!session) {
      return alert(t('exam_not_found'));
    }

    setSubmitting(true);
    try {
      // 1. Kiểm tra thí sinh có trong danh sách ca thi không (nếu ca thi có gán thí sinh)
      const allowedEmails = (session.candidateEmails || []).map((e) => e.toLowerCase());
      if (allowedEmails.length > 0 && !allowedEmails.includes(cleanEmail)) {
        alert(t('exam_not_in_candidate_list'));
        return;
      }

      // 2. Kiểm tra mật khẩu phòng thi (mặc định 123456 nếu chưa có)
      const expectedPassword = (session.roomPassword || '123456').trim();
      if (cleanPassword.toLowerCase() !== expectedPassword.toLowerCase()) {
        alert(t('exam_incorrect_room_password'));
        return;
      }

      // 3. Kiểm tra khóa định tài khoản: Thí sinh này đã xác thực và có người vào từ thiết bị khác chưa
      const localTokenKey = `cloudexam_cand_token_${session.id}_${cleanEmail}`;
      const myDeviceToken = localStorage.getItem(localTokenKey) || '';
      const lockInfo = session.lockedCandidates?.[cleanEmail];

      if (lockInfo && lockInfo.locked) {
        const lockedToken = lockInfo.deviceToken || '';
        // Nếu tài khoản đã bị khóa định và trình duyệt này không có token khớp -> Chặn đăng nhập!
        if (!myDeviceToken || (lockedToken && lockedToken !== myDeviceToken)) {
          alert(t('exam_candidate_already_locked', { email: cleanEmail }));
          return;
        }
      }

      // Đăng nhập hợp lệ!
      onSuccess(cleanEmail);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-sky-50/40 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-3">
          <span className="w-9 h-9 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></span>
          <p className="text-xs text-slate-500 font-medium">{t('exam_loading_info')}</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-sky-50/40 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800">{t('exam_not_found')}</h2>
          <p className="text-xs text-slate-600">{errorMsg || t('exam_invalid_id')}</p>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            {t('exam_back')}
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = resolveSessionStatus(session.status, session.startTime, session.endTime);
  const statusStyle = STATUS_STYLES[currentStatus] || STATUS_STYLES.SCHEDULED;
  const statusLabelKey = STATUS_KEYS[currentStatus] || 'sess_status_scheduled';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-sky-50/40 flex flex-col justify-between p-4 md:p-8">
      {/* Top bar với Language & Country selector */}
      <header className="max-w-5xl w-full mx-auto flex justify-between items-center py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">{t('app_title')}</span>
            <span className="hidden sm:inline-block ml-2 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">ExamPortal</span>
          </div>
        </div>
        {countryLanguageBar}
      </header>

      {/* Khối đăng nhập phòng thi 2 cột */}
      <main className="max-w-4xl w-full mx-auto my-6 grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl border border-indigo-100/80 shadow-[0_20px_50px_-12px_rgba(99,102,241,0.12)] overflow-hidden">
        {/* Cột trái: Thông tin Ca thi */}
        <div className="md:col-span-5 bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-sky-50/50 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-indigo-100/60">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                #{session.id}
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle}`}>
                {t(statusLabelKey)}
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              {session.id === 'EX-VNU-2026-01' ? t('default_session_exam_name') : session.name}
            </h2>

            <div className="space-y-2.5 pt-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {new Date(session.startTime).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })} -{' '}
                  {new Date(session.endTime).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{session.questionIds?.length || 0} {t('sess_questions_unit')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{session.candidateEmails?.length || 0} {t('sess_candidates_unit')}</span>
              </div>
            </div>

            {/* Quy định bảo mật phòng thi */}
            <div className="p-3 bg-white/80 rounded-2xl border border-indigo-100 text-[11px] text-slate-600 space-y-1.5 shadow-2xs">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Bảo mật phòng thi chuẩn AWS:</span>
              </div>
              <p>• Xác thực sinh trắc học trực tiếp qua webcam (Amazon Rekognition &ge; 80%).</p>
              <p>• Khóa định tài khoản ngay khi vào phòng để chống đăng nhập song song từ thiết bị khác.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-indigo-100/70 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{t('login_university')}</span>
            <span className="font-mono text-slate-400">v2.4.0</span>
          </div>
        </div>

        {/* Cột phải: Form Đăng nhập Thí sinh */}
        <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center space-y-5">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              Cổng Thí Sinh
            </span>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
              {t('candidate_login_title')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {t('candidate_login_subtitle')}
            </p>
          </div>

          {/* Quick-select chips cho thí sinh trong ca thi */}
          {session.candidateEmails && session.candidateEmails.length > 0 && (
            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2">
              <span className="text-[11px] font-semibold text-slate-600 block">
                {t('candidate_quick_fill_hint')}
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {session.candidateEmails.map((email) => {
                  const c = candidates.find((item) => item.email.toLowerCase() === email.toLowerCase());
                  const isSelected = inputEmail.toLowerCase() === email.toLowerCase();
                  const isLocked = session.lockedCandidates?.[email.toLowerCase()]?.locked;

                  return (
                    <button
                      key={email}
                      type="button"
                      onClick={() => setInputEmail(email)}
                      className={`text-xs px-2.5 py-1 rounded-xl border transition cursor-pointer font-medium flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : isLocked ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                      <span>{c ? c.name : email}</span>
                      {isLocked && <span className="text-[10px]">🔒</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('candidate_email_label')} *
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  placeholder={t('candidate_email_placeholder')}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('candidate_room_password_label')} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder={t('candidate_room_password_placeholder')}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-wider outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-2xl shadow-sm shadow-emerald-200 disabled:opacity-50 transition cursor-pointer text-xs active:scale-[0.99]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{t('candidate_login_loading')}</span>
                </span>
              ) : (
                t('candidate_login_btn')
              )}
            </button>

            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={onSwitchToOrganizer}
                className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>{t('switch_to_organizer_login')}</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer bản quyền */}
      <footer className="text-center text-xs text-slate-400 py-2">
        &copy; 2026 CloudExam • {t('footer_cloud_platform')}
      </footer>
    </div>
  );
};
