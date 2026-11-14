import { useCallback, useEffect, useState } from 'react';
import {
  redirectToCognitoLogin,
  logout,
  isLoggedIn,
  getCurrentUser,
  loginWithCognitoPassword,
  signUpWithCognito,
  confirmSignUpWithCognito,
  resendConfirmationCode,
} from './services/auth';
import {
  getQuestions,
  getQuestionBanks,
  getCandidates,
  createCandidate,
  deleteCandidate,
  getSessions,
  createSession,
  updateSessionStatus,
  updateSessionCandidates,
  resolveSessionStatus,
  type Question,
  type QuestionBank,
  type Candidate,
  type ExamSession,
  type SessionStatus,
} from './services/apiService';
import { Callback } from './components/Callback';
import { QuestionBankTab } from './components/QuestionBankTab';
import { CandidatesTab } from './components/CandidatesTab';
import { ExamSessionTab } from './components/ExamSessionTab';
import { ExamRoom } from './components/ExamRoom';
import { CandidateRoomLogin } from './components/CandidateRoomLogin';
import { LiveProctorDashboard } from './components/LiveProctorDashboard';
import { useTheme } from './themes/themeContext';
import { useTranslation, type Language } from './locales/i18nContext';
import {
  detectCountryFromLocation,
  switchCountryDomain,
  COUNTRY_DOMAINS,
} from './services/domainService';

type Tab = 'questions' | 'candidates' | 'session' | 'exam_test';

export const CountryLanguageBar = () => {
  const { themeName, setThemeName } = useTheme();
  const { lang, setLang, t } = useTranslation();

  // Tự động phát hiện miền trên URL khi khởi chạy
  useEffect(() => {
    const detected = detectCountryFromLocation();
    if (detected.isCustomDomain && detected.countryId !== themeName) {
      setThemeName(detected.countryId);
      setLang(detected.lang);
    }
  }, []);

  const handleCountryChange = (c: string) => {
    setThemeName(c);
    const domainCfg = COUNTRY_DOMAINS[c];
    if (domainCfg) {
      setLang(domainCfg.defaultLang);
      switchCountryDomain(c);
    }
  };

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    const langToCountry: Record<Language, string> = {
      vi: 'vn',
      en: 'us',
      la: 'la',
      de: 'de',
    };
    const targetCountry = langToCountry[newLang];
    if (targetCountry && targetCountry !== themeName) {
      setThemeName(targetCountry);
      switchCountryDomain(targetCountry);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/80">
        <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[11px] text-slate-500 font-medium">{t('country_label')}:</span>
        <select
          value={themeName}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="text-[11px] bg-transparent border-0 font-medium text-slate-700 cursor-pointer outline-none focus:ring-0"
        >
          <option value="vn">{t('country_vn')}</option>
          <option value="us">{t('country_us')}</option>
          <option value="la">{t('country_la')}</option>
          <option value="de">{t('country_de')}</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/80">
        <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        <span className="text-[11px] text-slate-500 font-medium">{t('lang_label')}:</span>
        <select
          value={lang}
          onChange={(e) => handleLangChange(e.target.value as Language)}
          className="text-[11px] bg-transparent border-0 font-medium text-slate-700 cursor-pointer outline-none focus:ring-0"
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
          <option value="la">ພາສາລາວ</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    </div>
  );
};

const TABS: { id: Tab; labelKey: string; path: string }[] = [
  { id: 'questions', labelKey: 'tab_questions', path: '/questions' },
  { id: 'candidates', labelKey: 'tab_candidates', path: '/candidates' },
  { id: 'session', labelKey: 'tab_sessions', path: '/sessions' },
  { id: 'exam_test', labelKey: 'tab_exam_test', path: '/exam' },
];

const parseRouteFromUrl = (): { tab: Tab; examId: string | null } => {
  const pathname = window.location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const examParam = searchParams.get('sessionId') || searchParams.get('exam');

  if (pathname.startsWith('/exam/')) {
    const id = window.location.pathname.replace(/^\/exam\//, '').trim();
    return { tab: 'exam_test', examId: id || null };
  }
  if (pathname === '/exam' || pathname === '/exam_test') {
    return { tab: 'exam_test', examId: examParam || null };
  }
  if (pathname === '/candidates' || pathname === '/candidate') {
    return { tab: 'candidates', examId: null };
  }
  if (pathname === '/sessions' || pathname === '/session') {
    return { tab: 'session', examId: null };
  }
  if (pathname === '/questions' || pathname === '/question') {
    return { tab: 'questions', examId: null };
  }

  const tabParam = searchParams.get('tab') as Tab;
  if (tabParam && ['questions', 'candidates', 'session', 'exam_test'].includes(tabParam)) {
    return { tab: tabParam, examId: examParam || null };
  }

  return { tab: 'questions', examId: examParam || null };
};

export default function App() {
  const { t } = useTranslation();
  const initialRoute = parseRouteFromUrl();
  const [activeTab, setActiveTab] = useState<Tab>(initialRoute.tab);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(false);

  // ID ca thi đang mở (nếu đang ở trong phòng thi)
  const [activeExamSessionId, setActiveExamSessionId] = useState<string | null>(initialRoute.examId);
  const [candidateAuthEmail, setCandidateAuthEmail] = useState<string>(() => {
    const eid = initialRoute.examId;
    if (eid) {
      return sessionStorage.getItem(`cloudexam_auth_${eid}`) || '';
    }
    return '';
  });
  const [showOrganizerLogin, setShowOrganizerLogin] = useState(false);

  const navigateToTab = (tab: Tab) => {
    setActiveTab(tab);
    setActiveExamSessionId(null);
    let path = '/questions';
    if (tab === 'candidates') path = '/candidates';
    else if (tab === 'session') path = '/sessions';
    else if (tab === 'exam_test') path = '/exam';

    if (window.location.pathname !== path || window.location.search) {
      window.history.pushState({ tab }, '', path);
    }
  };

  const openExamRoom = (sessionId: string) => {
    setActiveExamSessionId(sessionId);
    setActiveTab('exam_test');
    const path = `/exam?sessionId=${encodeURIComponent(sessionId)}`;
    if (window.location.pathname + window.location.search !== path) {
      window.history.pushState({ sessionId }, '', path);
    }
  };

  const exitExamRoom = () => {
    if (activeExamSessionId) {
      sessionStorage.removeItem(`cloudexam_auth_${activeExamSessionId}`);
    }
    setCandidateAuthEmail('');
    setActiveExamSessionId(null);
    const u = getCurrentUser();
    const isOrg = u?.groups?.includes('Organizer') ?? false;
    const targetPath = isOrg
      ? activeTab === 'exam_test'
        ? '/exam'
        : activeTab === 'session'
        ? '/sessions'
        : `/${activeTab}`
      : '/questions';
    window.history.pushState({}, '', targetPath);
  };

  const [notice, setNotice] = useState<string | null>(null);

  // Tab chuyển đổi Đăng nhập / Đăng ký
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');

  // Form đăng nhập trực tiếp
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Form đăng ký tài khoản mới kèm lựa chọn vai trò
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'Candidate' | 'Proctor' | 'Organizer'>('Candidate');
  const [regStudentCode, setRegStudentCode] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Modal xác thực mã kích hoạt OTP
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPassword, setOtpPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  const loggedIn = isLoggedIn();
  const user = getCurrentUser();

  // Tải dữ liệu an toàn (luôn có dữ liệu chuẩn, không bao giờ bị trống)
  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, cs, ss, bs] = await Promise.all([
        getQuestions().catch((e) => {
          console.error('Lỗi tải câu hỏi:', e);
          return null;
        }),
        getCandidates().catch((e) => {
          console.error('Lỗi tải thí sinh:', e);
          return null;
        }),
        getSessions().catch((e) => {
          console.error('Lỗi tải ca thi:', e);
          return null;
        }),
        getQuestionBanks().catch((e) => {
          console.error('Lỗi tải ngân hàng câu hỏi:', e);
          return null;
        }),
      ]);
      if (Array.isArray(qs)) setQuestions(qs);
      if (Array.isArray(cs)) setCandidates(cs);
      if (Array.isArray(ss)) setSessions(ss);
      if (Array.isArray(bs)) setQuestionBanks(bs);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateSessionStatus = async (sessionId: string, newStatus: SessionStatus) => {
    await updateSessionStatus(sessionId, newStatus);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: newStatus } : s))
    );
  };

  const handleUpdateSessionCandidates = async (sessionId: string, candidateEmails: string[]) => {
    await updateSessionCandidates(sessionId, candidateEmails);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, candidateEmails } : s))
    );
  };

  // Lắng nghe sự kiện Back/Forward của trình duyệt để đồng bộ Tab & URL
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromUrl();
      setActiveTab(route.tab);
      setActiveExamSessionId(route.examId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Tự động gán endpoint URL rõ ràng ngay khi vào trang nếu URL đang ở "/"
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      let path = '/questions';
      if (activeExamSessionId) path = `/exam?sessionId=${encodeURIComponent(activeExamSessionId)}`;
      else if (activeTab === 'candidates') path = '/candidates';
      else if (activeTab === 'session') path = '/sessions';
      else if (activeTab === 'exam_test') path = '/exam';
      window.history.replaceState({ tab: activeTab }, '', path);
    }
  }, [activeTab, activeExamSessionId]);

  useEffect(() => {
    if (loggedIn) {
      refreshAll();
    }
  }, [loggedIn, refreshAll]);

  if (window.location.pathname === '/callback') return <Callback />;

  // XỬ LÝ PHÒNG THI KHI TRUY CẬP LIÊN KẾT CA THI (?exam=... HOẶC activeExamSessionId)
  if (activeExamSessionId) {
    const currentUser = loggedIn ? getCurrentUser() : null;
    const isProctorUser = currentUser?.groups?.includes('Proctor') || (currentUser?.email?.toLowerCase().includes('laladoraema') ?? false);
    const isOrgUser = currentUser?.groups?.some((g: string) => ['Admin', 'Organizer'].includes(g)) ?? false;

    // Nếu Cán bộ Giám thị truy cập link ca thi -> mở thẳng Bàn Giám sát ca thi đó!
    if (isProctorUser && currentUser) {
      return (
        <LiveProctorDashboard
          user={currentUser}
          sessions={sessions}
          candidates={candidates}
          onRefresh={refreshAll}
          onUpdateSessionCandidates={handleUpdateSessionCandidates}
          onUpdateSessionStatus={handleUpdateSessionStatus}
          countryLanguageBar={<CountryLanguageBar />}
        />
      );
    }

    // Nếu chưa xác thực phòng thi bằng email thí sinh VÀ (không phải Giảng viên hoặc chưa đăng nhập)
    if (!candidateAuthEmail && (!isOrgUser || !loggedIn)) {
      if (!showOrganizerLogin) {
        return (
          <CandidateRoomLogin
            sessionId={activeExamSessionId}
            onSuccess={(candEmail) => {
              sessionStorage.setItem(`cloudexam_auth_${activeExamSessionId}`, candEmail);
              setCandidateAuthEmail(candEmail);
            }}
            onSwitchToOrganizer={() => setShowOrganizerLogin(true)}
            countryLanguageBar={<CountryLanguageBar />}
          />
        );
      }
    } else {
      // Đã xác thực phòng thi hoặc Giảng viên mở phòng thi
      const emailForRoom = candidateAuthEmail || currentUser?.email || '';
      const isOrgForRoom = isOrgUser && !candidateAuthEmail;

      return (
        <div className="min-h-screen bg-slate-50 py-6 px-4">
          <ExamRoom
            sessionId={activeExamSessionId}
            currentUserEmail={emailForRoom}
            isOrganizer={isOrgForRoom}
            onExit={exitExamRoom}
          />
        </div>
      );
    }
  }

  // MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ TÀI KHOẢN (EDUCATIONAL PASTEL PORTAL)
  if (!loggedIn) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      let cleanEmail = loginEmail.trim().toLowerCase();
      if (cleanEmail === 'laladoraema') cleanEmail = 'laladoraema@gmail.com';
      else if (cleanEmail === 'annv') cleanEmail = 'annv@uet.vnu.edu.vn';

      if (!cleanEmail || !loginPassword.trim()) {
        return alert(t('alert_enter_email_password'));
      }
      setLoginLoading(true);
      try {
        await loginWithCognitoPassword(cleanEmail, loginPassword);
        window.location.reload();
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('Mật khẩu không chính xác') || msg.includes('Incorrect password') || msg.includes('NotAuthorizedException')) {
          let alertMsg = t('alert_incorrect_password');
          if (['laladoraema@gmail.com', 'annv@uet.vnu.edu.vn', 'duc.tm24@vnu.edu.vn'].includes(cleanEmail)) {
            alertMsg += '\n\n💡 Lưu ý: Mật khẩu mặc định của tài khoản mẫu trên AWS Cognito là: 12345678';
          }
          alert(alertMsg);
        } else if (msg.includes('Tài khoản không tồn tại') || msg.includes('User not found') || msg.includes('UserNotFoundException')) {
          alert(t('alert_user_not_found'));
        } else if (msg.includes('chưa được xác thực') || msg.includes('UserNotConfirmed')) {
          setOtpEmail(cleanEmail);
          setOtpPassword(loginPassword);
          setShowOtpModal(true);
        } else {
          alert(msg || t('alert_login_failed'));
        }
      } finally {
        setLoginLoading(false);
      }
    };

    const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      let cleanEmail = regEmail.trim().toLowerCase();
      if (cleanEmail === 'laladoraema') cleanEmail = 'laladoraema@gmail.com';
      else if (cleanEmail === 'annv') cleanEmail = 'annv@uet.vnu.edu.vn';

      if (!regName.trim() || !cleanEmail || !regPassword.trim()) {
        return alert(t('alert_enter_email_password'));
      }
      if (regPassword !== regConfirmPassword) {
        return alert(t('register_password_mismatch'));
      }
      if (regPassword.length < 8 || !/\d/.test(regPassword)) {
        return alert(t('register_password_min'));
      }

      setRegLoading(true);
      try {
        await signUpWithCognito(
          cleanEmail,
          regPassword,
          regName.trim(),
          regRole,
          regStudentCode.trim()
        );
        setOtpEmail(cleanEmail);
        setOtpPassword(regPassword);
        setOtpNotice(null);
        setOtpCode('');
        setShowOtpModal(true);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('USER_ALREADY_EXISTS') || msg.includes('UsernameExistsException') || msg.includes('đã có tài khoản')) {
          const isDemoAccount = ['laladoraema@gmail.com', 'annv@uet.vnu.edu.vn', 'duc.tm24@vnu.edu.vn', '24020001@vnu.edu.vn', 'phongpt@vnu.edu.vn'].includes(cleanEmail);

          let alertMsg = `Tài khoản "${cleanEmail}" đã tồn tại trên AWS Cognito.`;
          if (isDemoAccount) {
            alertMsg += `\n\nĐây là tài khoản mẫu có sẵn của hệ thống! Mật khẩu mặc định là: 12345678.\nHệ thống sẽ chuyển sang màn hình Đăng nhập để bạn có thể vào ngay.`;
          } else {
            alertMsg += `\n\nVui lòng đăng nhập với mật khẩu đã tạo, hoặc nhập mã OTP kích hoạt nếu tài khoản chưa được xác thực.`;
          }
          alert(alertMsg);
          setAuthTab('signin');
          setLoginEmail(cleanEmail);
          if (isDemoAccount) {
            setLoginPassword('12345678');
          }
        } else {
          alert(msg || 'Đăng ký thất bại. Vui lòng thử lại.');
        }
      } finally {
        setRegLoading(false);
      }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otpCode.trim()) return alert('Vui lòng nhập mã kích hoạt 6 chữ số!');
      setOtpLoading(true);
      setOtpNotice(null);
      try {
        await confirmSignUpWithCognito(otpEmail, otpCode.trim());
        if (otpPassword) {
          await loginWithCognitoPassword(otpEmail, otpPassword);
          window.location.reload();
        } else {
          alert('Tài khoản đã được kích hoạt thành công! Vui lòng đăng nhập.');
          setShowOtpModal(false);
          setAuthTab('signin');
          setLoginEmail(otpEmail);
        }
      } catch (err: any) {
        setOtpNotice(err?.message || 'Xác thực mã OTP thất bại.');
      } finally {
        setOtpLoading(false);
      }
    };

    const handleResendOtp = async () => {
      if (!otpEmail) return;
      setOtpResending(true);
      try {
        await resendConfirmationCode(otpEmail);
        setOtpNotice(t('otp_resend_success'));
      } catch (err: any) {
        setOtpNotice(err?.message || 'Không thể gửi lại mã xác thực.');
      } finally {
        setOtpResending(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 md:p-8">
        {/* Top bar với Language & Country selector */}
        <header className="max-w-5xl w-full mx-auto flex justify-between items-center py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 text-sm tracking-tight">{t('app_title')}</span>
          </div>
          <CountryLanguageBar />
        </header>

        {/* Khối đăng nhập trung tâm 2 cột */}
        <main className="max-w-4xl w-full mx-auto my-6 grid grid-cols-1 md:grid-cols-12 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Cột trái: nhận diện thương hiệu */}
          <div className="md:col-span-5 relative bg-slate-900 p-6 md:p-8 flex flex-col justify-between overflow-hidden">
            <svg className="absolute -right-20 -bottom-24 w-72 h-72 text-white/[0.05]" viewBox="0 0 200 200" fill="none" aria-hidden="true">
              <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="100" r="64" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="100" r="3" fill="currentColor" />
            </svg>

            <div className="relative space-y-3">
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-indigo-300">
                {t('login_hero_badge')}
              </p>
              <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-snug">
                {t('login_hero_title')}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('login_hero_desc')}
              </p>
            </div>

            <div className="relative pt-6 mt-8 border-t border-white/10 text-[11px] text-slate-400">
              {t('login_university')}
            </div>
          </div>

          {/* Cột phải: Form Đăng nhập / Đăng ký */}
          <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center space-y-4">
            {/* Tabs chuyển đổi giữa Đăng nhập & Đăng ký */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setAuthTab('signin')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  authTab === 'signin'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('tab_signin')}
              </button>
              <button
                type="button"
                onClick={() => setAuthTab('signup')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  authTab === 'signup'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('tab_signup')}
              </button>
            </div>

            {authTab === 'signin' ? (
              <>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{t('login_title')}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('login_hint')}
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t('cand_table_email')}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder={t('login_email_placeholder')}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full pl-3 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                        required
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t('login_password')}
                    </label>
                    <input
                      type="password"
                      placeholder={t('login_password_placeholder')}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-3 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {loginLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        {t('login_loading')}
                      </span>
                    ) : (
                      t('login_btn')
                    )}
                  </button>

                  <div className="pt-2 text-center border-t border-slate-100 flex flex-col gap-1.5">
                    {activeExamSessionId && showOrganizerLogin && (
                      <button
                        type="button"
                        onClick={() => setShowOrganizerLogin(false)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 cursor-pointer font-bold inline-flex items-center justify-center gap-1"
                      >
                        <span>{t('switch_to_candidate_login')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => redirectToCognitoLogin(false)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium hover:underline inline-flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span>{t('login_candidate_portal')}</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* FORM ĐĂNG KÝ TÀI KHOẢN KÈM LỰA CHỌN VAI TRÒ */
              <>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{t('register_title')}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('register_hint')}
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  {/* BẮT BUỘC CHỌN VAI TRÒ: THÍ SINH, GIÁM THỊ HOẶC GIẢNG VIÊN / GIÁM KHẢO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('register_role_title')} <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegRole('Candidate')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          regRole === 'Candidate'
                            ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-900">{t('register_role_candidate')}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">{t('register_role_candidate_desc')}</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegRole('Proctor')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          regRole === 'Proctor'
                            ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-900">{t('register_role_proctor')}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">{t('register_role_proctor_desc')}</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegRole('Organizer')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          regRole === 'Organizer'
                            ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-900">{t('register_role_organizer')}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">{t('register_role_organizer_desc')}</p>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('register_name_label')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={t('register_name_placeholder')}
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {regRole === 'Candidate'
                          ? t('register_code_student')
                          : regRole === 'Proctor'
                          ? t('register_code_proctor')
                          : t('register_code_lecturer')}
                      </label>
                      <input
                        type="text"
                        placeholder={t('register_code_placeholder')}
                        value={regStudentCode}
                        onChange={(e) => setRegStudentCode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t('register_email_label')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder={t('register_email_placeholder')}
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('register_password_label')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder={t('register_password_placeholder')}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('register_confirm_password_label')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder={t('register_confirm_password_placeholder')}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {regLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        {t('register_loading')}
                      </span>
                    ) : (
                      t('register_submit_btn')
                    )}
                  </button>

                  <div className="pt-2 text-center border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => redirectToCognitoLogin(true, regRole)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium hover:underline inline-flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                      </svg>
                      <span>{t('register_sso_btn')}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </main>

        {/* MODAL NHẬP MÃ OTP KÍCH HOẠT TÀI KHOẢN COGNITO */}
        {showOtpModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
              <div className="text-center space-y-1.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900">{t('otp_modal_title')}</h3>
                <p className="text-xs text-slate-500 leading-snug">
                  {t('otp_modal_desc')}{' '}
                  <span className="font-semibold text-slate-700 block font-mono">{otpEmail}</span>
                </p>
              </div>

              {otpNotice && (
                <div className={`p-2.5 rounded-xl text-xs ${otpNotice.includes('thành công') || otpNotice.includes('đã được gửi') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {otpNotice}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 text-center">
                    Nhập mã xác thực 6 chữ số
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder={t('otp_input_placeholder')}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[0.3em] font-mono py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={otpLoading || otpCode.length < 4}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {otpLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Đang xác thực...
                    </span>
                  ) : (
                    t('otp_verify_btn')
                  )}
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpResending}
                    className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                  >
                    {otpResending ? t('otp_resending') : t('otp_resend_btn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer bản quyền */}
        <footer className="text-center text-xs text-slate-400 py-2">
          &copy; 2026 CloudExam · {t('footer_cloud_platform')}
        </footer>
      </div>
    );
  }

  // RBAC: vai trò lấy từ Cognito groups hoặc nhận diện tài khoản giám thị
  const isProctor = user.groups.includes('Proctor') || user.email.toLowerCase().includes('laladoraema');
  const isCandidateOnly = !isProctor && user.groups.includes('Candidate');

  const handleAddCandidate = async (candidate: Candidate) => {
    const saved = await createCandidate(candidate);
    setCandidates((prev) => [...prev.filter((c) => c.email !== saved.email), saved]);
    setNotice(t('notice_candidate_saved'));
  };

  const handleRemoveCandidate = async (email: string) => {
    await deleteCandidate(email);
    setCandidates((prev) => prev.filter((c) => c.email !== email));
    setNotice(t('notice_candidate_deleted'));
  };

  const handleCreateSession = async (
    sessionData: Omit<ExamSession, 'id' | 'link' | 'createdAt'> & { id?: string }
  ) => {
    const created = await createSession(sessionData);
    setSessions((prev) => [created, ...prev]);
  };




  // CỔNG THÍ SINH
  if (isCandidateOnly) {
    const mySessions = sessions.filter((s) =>
      (s.candidateEmails || []).some((e) => e.toLowerCase() === user.email.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col justify-between">
        {/* Header Cổng Thí Sinh */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold text-slate-900 tracking-tight">{t('app_title')}</h1>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    {t('student_portal')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {user.name} · {t('cand_table_code')}: <span className="font-mono font-medium text-slate-700">{user.studentCode || 'N/A'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-xs flex-wrap">
              <CountryLanguageBar />

              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-medium border border-slate-200/60 transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Nội dung danh sách ca thi của thí sinh */}
        <main className="max-w-4xl w-full mx-auto p-4 md:p-8 flex-1 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 tracking-tight">
              {t('assigned_sessions_title')}
            </h2>
            <p className="text-xs text-slate-500 max-w-xl">
              {t('student_exam_notice')}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('assigned_sessions')} · {mySessions.length}
              </h3>
            </div>

            {mySessions.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-slate-500">{t('sess_empty')}</p>
                <p className="text-[11px] text-slate-400">{t('no_assigned_exams')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {mySessions.map((s) => {
                  const status = resolveSessionStatus(s.status, s.startTime, s.endTime);
                  const isRunning = status === 'RUNNING';
                  const isUpcoming = status === 'SCHEDULED';
                  const isClosed = status === 'CLOSED';

                  return (
                    <div
                      key={s.id}
                      className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                            #{s.id}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                              isRunning
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isUpcoming
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {isRunning ? t('sess_status_running') : isUpcoming ? t('sess_status_scheduled') : t('sess_status_closed')}
                          </span>
                        </div>

                        <h4 className="font-semibold text-slate-900 text-sm">
                          {s.name}
                        </h4>

                        <div className="space-y-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>
                              {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(s.startTime).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>{s.questionIds?.length || 0} {t('questions_multiple_essay')}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => openExamRoom(s.id)}
                        disabled={isClosed}
                        className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                          isRunning
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                            : isUpcoming
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span>{isRunning ? t('enter_room_now') : isUpcoming ? t('preview_room') : t('session_closed')}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-200">
          &copy; 2026 CloudExam · {t('footer_uet_title')}
        </footer>
      </div>
    );
  }

  // CỔNG CÁN BỘ COI THI (LIVE PROCTOR DASHBOARD)
  if (isProctor) {
    return (
      <LiveProctorDashboard
        user={user}
        sessions={sessions}
        candidates={candidates}
        onRefresh={refreshAll}
        onUpdateSessionCandidates={handleUpdateSessionCandidates}
        onUpdateSessionStatus={handleUpdateSessionStatus}
        countryLanguageBar={<CountryLanguageBar />}
      />
    );
  }

  // CỔNG QUẢN LÝ (GIẢNG VIÊN / BAN TỔ CHỨC)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col justify-between">
      {/* Header Giảng viên / Ban tổ chức */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-900 tracking-tight">{t('app_title')}</h1>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  {t('role_organizer_title')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {user.name || user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <CountryLanguageBar />

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-medium border border-slate-200/60 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto p-4 md:p-6 space-y-5 flex-1">
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer" aria-label="Close">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Thanh chuyển Tab Segmented Control */}
        <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 border border-slate-200 overflow-x-auto">
          {TABS.map((tItem) => {
            const isActive = activeTab === tItem.id;
            return (
              <button
                key={tItem.id}
                onClick={() => navigateToTab(tItem.id)}
                className={`flex-1 min-w-[130px] py-2 px-3.5 rounded-lg font-medium text-xs transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tItem.id === 'questions' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
                {tItem.id === 'candidates' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                {tItem.id === 'session' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                {tItem.id === 'exam_test' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                <span>{t(tItem.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Ngân hàng câu hỏi */}
        {activeTab === 'questions' && (
          <QuestionBankTab
            questions={questions}
            onRefresh={refreshAll}
          />
        )}

        {/* Tab 2: Thí sinh */}
        {activeTab === 'candidates' && (
          <CandidatesTab
            candidates={candidates}
            loading={loading}
            onAddCandidate={handleAddCandidate}
            onRemoveCandidate={handleRemoveCandidate}
            onRefresh={refreshAll}
          />
        )}

        {/* Tab 3: Ca thi */}
        {activeTab === 'session' && (
          <ExamSessionTab
            questions={questions}
            candidates={candidates}
            sessions={sessions}
            questionBanks={questionBanks}
            loading={loading}
            onCreateSession={handleCreateSession}
            onUpdateStatus={handleUpdateSessionStatus}
            onUpdateCandidates={handleUpdateSessionCandidates}
            onOpenExam={(id) => openExamRoom(id)}
            onRefresh={refreshAll}
          />
        )}

        {/* Tab 4: Phòng thi */}
        {activeTab === 'exam_test' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                {t('exam_online_room')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('exam_select_session_desc')}
              </p>
            </div>

            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                {t('sess_empty')}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-5 border border-slate-200 rounded-xl bg-white hover:border-slate-300 hover:shadow-sm transition space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono font-medium text-slate-500 block">#{s.id}</span>
                        <h4 className="font-semibold text-slate-900 text-sm mt-0.5">{s.name}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                          s.status === 'RUNNING'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{s.questionIds?.length || 0} {t('sess_questions_unit')}</span>
                      <span className="text-slate-300">·</span>
                      <span>{s.candidateEmails?.length || 0} {t('sess_candidates_unit')}</span>
                    </p>

                    <button
                      onClick={() => openExamRoom(s.id)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
                    >
                      {t('enter_exam')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-200">
        &copy; 2026 CloudExam · {t('footer_copyright')}
      </footer>
    </div>
  );
}
