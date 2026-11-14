import { useState, useEffect } from 'react';
import {
  getSession,
  resolveSessionStatus,
  type ExamSession,
  type SessionStatus,
} from '../services/apiService';
import { getCurrentUser } from '../services/auth';
import { useTranslation } from '../locales/i18nContext';

interface Props {
  sessionId: string;
  onSuccess: (candidateEmail: string) => void;
  onSwitchToOrganizer: () => void;
  countryLanguageBar?: React.ReactNode;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  SCHEDULED: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
  RUNNING: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
  CLOSED: 'bg-slate-500/10 text-slate-400 border-slate-500/25',
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
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchSession = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const s = await getSession(sessionId);
        if (!isMounted) return;
        setSession(s);

        const currentUser = getCurrentUser();
        const assigned = (s.candidateEmails || []).map((e) => e.toLowerCase());
        if (currentUser?.email && assigned.includes(currentUser.email.toLowerCase())) {
          setInputEmail(currentUser.email);
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
    setSubmitError('');
    try {
      const allowedEmails = (session.candidateEmails || []).map((e) => e.toLowerCase());
      if (!allowedEmails.includes(cleanEmail)) {
        alert(t('exam_not_in_candidate_list'));
        return;
      }

      const expectedPassword = (session.roomPassword || '').trim();
      if (!expectedPassword || cleanPassword !== expectedPassword) {
        alert(t('exam_incorrect_room_password'));
        return;
      }

      const localTokenKey = `cloudexam_cand_token_${session.id}_${cleanEmail}`;
      const myDeviceToken = localStorage.getItem(localTokenKey) || '';
      const lockInfo = session.lockedCandidates?.[cleanEmail];

      if (lockInfo && lockInfo.locked) {
        const lockedToken = lockInfo.deviceToken || '';
        if (!myDeviceToken || (lockedToken && lockedToken !== myDeviceToken)) {
          setSubmitError(t('exam_candidate_already_locked', { email: cleanEmail }));
          return;
        }
      }

      onSuccess(cleanEmail);
    } finally {
      setSubmitting(false);
    }
  };

  const pageBackground = (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse at 50% 0%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 20%, transparent 75%)',
      }}
    />
  );

  const brandHeader = (
    <header className="relative max-w-4xl w-full mx-auto flex justify-between items-center py-2">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-slate-900 text-sm tracking-tight">{t('app_title')}</p>
          <p className="text-[10px] text-slate-500">{t('login_university')}</p>
        </div>
      </div>
      {countryLanguageBar}
    </header>
  );

  if (loading) {
    return (
      <div className="relative min-h-screen bg-slate-50 flex flex-col overflow-hidden">
        {pageBackground}
        <div className="relative flex-1 flex flex-col justify-center items-center p-4 gap-3">
          <span className="w-8 h-8 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-500">{t('exam_loading_info')}</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="relative min-h-screen bg-slate-50 flex flex-col overflow-hidden">
        {pageBackground}
        <div className="relative flex-1 flex flex-col justify-center items-center p-4">
          <div className="max-w-sm w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-11 h-11 mx-auto rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">{t('exam_not_found')}</h2>
              <p className="text-xs text-slate-500 leading-relaxed">{errorMsg || t('exam_invalid_id')}</p>
            </div>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              {t('exam_back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStatus = resolveSessionStatus(session.status, session.startTime, session.endTime);
  const statusStyle = STATUS_STYLES[currentStatus] || STATUS_STYLES.SCHEDULED;
  const statusLabelKey = STATUS_KEYS[currentStatus] || 'sess_status_scheduled';
  const questionCount = session.questionIds?.length || 0;
  const candidateCount = session.candidateEmails?.length || 0;

  return (
    <div className="relative min-h-screen bg-slate-50 flex flex-col justify-between p-4 md:p-6 overflow-hidden">
      {pageBackground}
      {brandHeader}

      <main className="relative max-w-4xl w-full mx-auto my-6 grid grid-cols-1 md:grid-cols-12 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="relative md:col-span-5 bg-slate-900 text-white p-6 md:p-8 flex flex-col justify-between overflow-hidden">
          <svg
            className="pointer-events-none absolute -right-16 -bottom-20 w-72 h-72 text-indigo-400/15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            viewBox="0 0 200 200"
          >
            <circle cx="100" cy="100" r="90" />
            <circle cx="100" cy="100" r="64" />
            <circle cx="100" cy="100" r="38" />
            <path d="M10 100h180M100 10v180" />
          </svg>

          <div className="relative space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                #{session.id}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${statusStyle}`}>
                {t(statusLabelKey)}
              </span>
            </div>

            <h2 className="text-lg md:text-xl font-semibold tracking-tight leading-snug">{session.name}</h2>

            <dl className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="leading-relaxed">
                  {new Date(session.startTime).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}
                  <span className="text-slate-500 mx-1">→</span>
                  {new Date(session.endTime).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{questionCount} {t('sess_questions_unit')}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{candidateCount} {t('sess_candidates_unit')}</span>
              </div>
            </dl>
          </div>

          <div className="relative pt-8 mt-8 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500">
            <span>{t('login_university')}</span>
            <span className="font-mono">CloudExam</span>
          </div>
        </div>

        <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">
              {t('candidate_login_title')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {t('candidate_login_subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('candidate_email_label')}
              </label>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder={t('candidate_email_placeholder')}
                autoComplete="email"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('candidate_room_password_label')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder={t('candidate_room_password_placeholder')}
                  autoComplete="off"
                  className="w-full px-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 012.563-3.795M6.228 6.228A10.02 10.02 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer text-xs"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('candidate_login_loading')}</span>
                </span>
              ) : (
                t('candidate_login_btn')
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onSwitchToOrganizer}
                className="text-xs text-slate-500 hover:text-indigo-600 cursor-pointer font-medium transition-colors"
              >
                {t('switch_to_organizer_login')}
              </button>
            </div>
          </form>
        </div>
      </main>

      <footer className="relative text-center text-[11px] text-slate-400 py-2">
        &copy; 2026 CloudExam · {t('footer_cloud_platform')}
      </footer>
    </div>
  );
};
