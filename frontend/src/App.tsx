import { useCallback, useEffect, useState } from 'react';
import {
  redirectToCognitoLogin,
  logout,
  isLoggedIn,
  getCurrentUser,
  loginWithCognitoPassword,
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
  syncCloudDatabaseToProduction,
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

  const currentDomain = COUNTRY_DOMAINS[themeName]?.domain || COUNTRY_DOMAINS.default.domain;

  return (
    <div className="flex items-center gap-2">
      {/* Huy hiệu tên miền tương ứng với quốc gia */}
      <span
        className="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-mono bg-indigo-50/70 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100 shadow-2xs"
        title={`${t('domain_current_hint')} https://${currentDomain}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        {currentDomain}
      </span>

      <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/80">
        <span className="text-[11px] text-slate-500 font-medium">{t('country_label')}:</span>
        <select
          value={themeName}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="text-[11px] bg-transparent border-0 font-medium text-slate-700 cursor-pointer outline-none focus:ring-0"
        >
          <option value="vn">🇻🇳 {t('country_vn')} (vietnam.cloudexam.com)</option>
          <option value="la">🇱🇦 {t('country_la')} (lao.cloudexam.com)</option>
          <option value="de">🇩🇪 {t('country_de')} (germany.cloudexam.com)</option>
          <option value="default">🌐 {t('country_intl')} (cloudexam.com)</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/80">
        <span className="text-[11px] text-slate-500 font-medium">{t('lang_label')}:</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
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

export interface SystemAccount {
  role: 'Organizer' | 'Candidate';
  name: string;
  email: string;
  studentCode?: string;
  unit: string;
}

const DATABASE_ACCOUNTS: SystemAccount[] = [
  {
    role: 'Organizer',
    name: 'PGS. TS. Nguyễn Văn An',
    email: 'annv@uet.vnu.edu.vn',
    studentCode: 'GV001',
    unit: 'Giảng viên Khoa Công nghệ Thông tin - ĐH Công nghệ (UET)',
  },
  {
    role: 'Organizer',
    name: 'Giám thị Laladoraema',
    email: 'laladoraema@gmail.com',
    studentCode: 'GT002',
    unit: 'Cán bộ Giám thị - Hội đồng thi CloudExam',
  },
  {
    role: 'Candidate',
    name: 'Trần Minh Đức',
    email: '24020001@vnu.edu.vn',
    studentCode: '24020001',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Lê Thị Mai',
    email: '24020002@vnu.edu.vn',
    studentCode: '24020002',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Phạm Hoàng Long',
    email: '24020003@vnu.edu.vn',
    studentCode: '24020003',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Vũ Thùy Linh',
    email: '24020004@vnu.edu.vn',
    studentCode: '24020004',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Đỗ Quang Huy',
    email: '24020005@vnu.edu.vn',
    studentCode: '24020005',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Nguyễn Văn Sáu',
    email: '24020006@vnu.edu.vn',
    studentCode: '24020006',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Nguyễn VĂN BẢY',
    email: '24020007@vnu.edu.vn',
    studentCode: '24020007',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
];

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
    setActiveExamSessionId(null);
    const u = getCurrentUser();
    const isOrg = u?.groups?.includes('Organizer') ?? false;
    const targetPath = isOrg
      ? activeTab === 'exam_test'
        ? '/exam'
        : activeTab === 'session'
        ? '/sessions'
        : `/${activeTab}`
      : '/sessions';
    window.history.pushState({}, '', targetPath);
  };

  // Trạng thái đồng bộ CSDL AWS Cloud
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Form đăng nhập trực tiếp
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const loggedIn = isLoggedIn();

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

  const handleSyncToCloud = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await syncCloudDatabaseToProduction();
      setSyncNotice(res.message || t('notice_sync_success'));
      await refreshAll();
    } catch (err: any) {
      setSyncNotice(`${t('notice_sync_error')} ${err?.response?.data?.error || err?.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  if (window.location.pathname === '/callback') return <Callback />;

  // MÀN HÌNH ĐĂNG NHẬP (EDUCATIONAL PASTEL PORTAL)
  if (!loggedIn) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginEmail.trim() || !loginPassword.trim()) {
        return alert(t('alert_enter_email_password'));
      }
      setLoginLoading(true);
      try {
        await loginWithCognitoPassword(loginEmail.trim(), loginPassword);
        window.location.reload();
      } catch (err: any) {
        alert(err?.message || t('alert_login_failed'));
      } finally {
        setLoginLoading(false);
      }
    };

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
              <span className="hidden sm:inline-block ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">EduPortal</span>
            </div>
          </div>
          <CountryLanguageBar />
        </header>

        {/* Khối đăng nhập trung tâm 2 cột */}
        <main className="max-w-4xl w-full mx-auto my-6 grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl border border-indigo-100/80 shadow-[0_20px_50px_-12px_rgba(99,102,241,0.12)] overflow-hidden">
          {/* Cột trái: Thông tin học vụ & Giới thiệu hệ thống */}
          <div className="md:col-span-5 bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-sky-50/50 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-indigo-100/60">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-white/80 px-3 py-1 rounded-full border border-indigo-100 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Nền Tảng Khảo Thí Trực Tuyến
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                Đánh giá năng lực chuẩn xác & công bằng
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống thi trực tuyến thế hệ mới tích hợp điểm danh sinh trắc học, giám sát thi tự động và chấm điểm tức thì.
              </p>

              <div className="space-y-2.5 pt-2">
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span>Xác thực danh tính khuôn mặt thí sinh với độ chính xác cao</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span>Bóc tách đề thi Word & phân tích sư phạm bằng AI</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span>Hỗ trợ đa ngôn ngữ và hạ tầng đám mây phân tán</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-indigo-100/70 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Đại học Quốc gia Hà Nội (VNU - UET)</span>
              <span className="font-mono text-slate-400">v2.4.0</span>
            </div>
          </div>

          {/* Cột phải: Form Đăng nhập & Quick Demo Chips */}
          <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{t('login_title')}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Sử dụng tài khoản VNU hoặc tài khoản được cấp để truy cập hệ thống
              </p>
            </div>

            {/* Quick Demo Chips */}
            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                Tài khoản trải nghiệm nhanh (Click để tự động điền):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('annv@uet.vnu.edu.vn');
                    setLoginPassword('12345678');
                  }}
                  className="p-2.5 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/60 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-800 text-[11px] font-bold flex items-center justify-center">GV</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-indigo-900 truncate">PGS. TS. Nguyễn Văn An</p>
                      <p className="text-[10px] text-indigo-700 truncate font-mono">annv@uet.vnu.edu.vn</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('24020001@vnu.edu.vn');
                    setLoginPassword('12345678');
                  }}
                  className="p-2.5 rounded-xl bg-sky-50/70 hover:bg-sky-100/80 border border-sky-200/60 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-200 text-sky-800 text-[11px] font-bold flex items-center justify-center">TS</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-sky-900 truncate">Trần Minh Đức</p>
                      <p className="text-[10px] text-sky-700 truncate font-mono">24020001@vnu.edu.vn</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('cand_table_email')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    list="vnu-accounts"
                    placeholder="annv@uet.vnu.edu.vn hoặc 24020001@vnu.edu.vn"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-3 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                    required
                    autoComplete="username"
                  />
                </div>
                <datalist id="vnu-accounts">
                  {DATABASE_ACCOUNTS.map((acc) => (
                    <option key={acc.email} value={acc.email}>
                      {acc.name} ({acc.role === 'Organizer' ? (t('app_subtitle_organizer') || 'Giảng viên') : acc.studentCode})
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('login_password')}
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu (Mặc định: 12345678)"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-3 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/40 transition"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-200 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
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

              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => redirectToCognitoLogin(false)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium hover:underline inline-flex items-center gap-1"
                >
                  <span>{t('login_candidate_portal')}</span>
                </button>
              </div>
            </form>
          </div>
        </main>

        {/* Footer bản quyền */}
        <footer className="text-center text-xs text-slate-400 py-2">
          &copy; 2026 CloudExam • Phát triển trên nền tảng Điện Toán Đám Mây Đa Vùng • UET VNU
        </footer>
      </div>
    );
  }

  const user = getCurrentUser();
  const isAdminOrOrganizer = user.groups.some((g) => ['Admin', 'Organizer'].includes(g));
  const isCandidateOnly = user.groups.includes('Candidate') && !isAdminOrOrganizer;

  const handleAddCandidate = async (candidate: Candidate) => {
    const saved = await createCandidate(candidate);
    setCandidates((prev) => [...prev.filter((c) => c.email !== saved.email), saved]);
    setSyncNotice(`${t('notice_candidate_saved')} (${candidate.name} - ${candidate.email})`);
  };

  const handleRemoveCandidate = async (email: string) => {
    await deleteCandidate(email);
    setCandidates((prev) => prev.filter((c) => c.email !== email));
    setSyncNotice(`${t('notice_candidate_deleted')} (${email})`);
  };

  const handleCreateSession = async (
    sessionData: Omit<ExamSession, 'id' | 'link' | 'createdAt'> & { id?: string }
  ) => {
    const created = await createSession(sessionData);
    setSessions((prev) => [created, ...prev]);
  };

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

  // PHÒNG THI
  if (activeExamSessionId) {
    return (
      <div className="min-h-screen bg-slate-50 py-6 px-4">
        <ExamRoom
          sessionId={activeExamSessionId}
          currentUserEmail={user.email}
          isOrganizer={isAdminOrOrganizer}
          onExit={exitExamRoom}
        />
      </div>
    );
  }

  // CỔNG THÍ SINH
  if (isCandidateOnly) {
    const mySessions = sessions.filter(
      (s) =>
        !s.candidateEmails ||
        s.candidateEmails.length === 0 ||
        s.candidateEmails.some((e) => e.toLowerCase() === user.email.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-sky-50/30 text-slate-700 flex flex-col justify-between">
        {/* Header Cổng Thí Sinh */}
        <header className="bg-white/80 backdrop-blur-md border-b border-indigo-100/80 px-4 md:px-8 py-3.5 sticky top-0 z-40 shadow-xs">
          <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-slate-900 tracking-tight">{t('app_title')}</h1>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                    Cổng Thí Sinh
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {user.name} • MSSV: <span className="font-mono font-semibold text-slate-700">{user.studentCode || 'N/A'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
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
          <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-100 rounded-3xl p-6 relative overflow-hidden">
            <div className="relative z-10 space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-white/90 px-3 py-1 rounded-full border border-indigo-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Chào mừng bạn, {user.name}
              </span>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                Danh sách các ca thi được chỉ định
              </h2>
              <p className="text-xs text-slate-600 max-w-xl">
                Vui lòng chuẩn bị webcam, không gian yên tĩnh và kiểm tra đường truyền mạng trước khi bắt đầu bài thi.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('assigned_sessions')} ({mySessions.length})
              </h3>
            </div>

            {mySessions.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-slate-500">{t('sess_empty')}</p>
                <p className="text-[11px] text-slate-400">Bạn chưa có lịch thi nào được chỉ định tại thời điểm này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {mySessions.map((s) => {
                  const now = Date.now();
                  const start = new Date(s.startTime).getTime();
                  const end = new Date(s.endTime).getTime();
                  const isRunning = now >= start && now <= end;
                  const isUpcoming = now < start;
                  const isClosed = now > end;

                  return (
                    <div
                      key={s.id}
                      className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-indigo-200 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                            #{s.id}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                              isRunning
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse'
                                : isUpcoming
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {isRunning ? 'Đang diễn ra' : isUpcoming ? 'Sắp diễn ra' : 'Đã kết thúc'}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition">
                          {s.name}
                        </h4>

                        <div className="space-y-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>
                              {new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(s.startTime).toLocaleDateString('vi-VN')})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>{s.questionIds?.length || 0} câu hỏi trắc nghiệm / tự luận</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => openExamRoom(s.id)}
                        disabled={isClosed}
                        className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                          isRunning
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-emerald-200 active:scale-[0.99]'
                            : isUpcoming
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span>{isRunning ? 'Vào phòng thi ngay' : isUpcoming ? 'Xem trước phòng thi' : 'Ca thi đã kết thúc'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-200/50">
          &copy; 2026 CloudExam • Đại học Quốc gia Hà Nội (VNU - UET)
        </footer>
      </div>
    );
  }

  // CỔNG QUẢN LÝ (GIẢNG VIÊN / BAN TỔ CHỨC)
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-700 flex flex-col justify-between">
      {/* Header Giảng viên / Ban tổ chức */}
      <header className="bg-white/85 backdrop-blur-md border-b border-indigo-100/70 px-4 md:px-8 py-3 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-xs shadow-indigo-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">{t('app_title')}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {user.groups.includes('Organizer') ? (t('app_subtitle_organizer') || 'Giảng viên') : 'Quản trị viên'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {user.name || user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <CountryLanguageBar />

            <button
              onClick={handleSyncToCloud}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-200/80 transition cursor-pointer disabled:opacity-50"
              title={t('sync_cloud')}
            >
              <svg className={`w-3.5 h-3.5 text-indigo-600 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{syncing ? t('syncing_cloud') : t('sync_cloud')}</span>
            </button>

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
        {syncNotice && (
          <div className="bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">✓</span>
              <span>{syncNotice}</span>
            </div>
            <button onClick={() => setSyncNotice(null)} className="font-bold text-slate-400 hover:text-slate-700 cursor-pointer text-sm">✕</button>
          </div>
        )}

        {/* Thanh chuyển Tab Segmented Control */}
        <div className="bg-slate-100/90 p-1.5 rounded-2xl flex space-x-1 border border-slate-200/70 overflow-x-auto shadow-2xs">
          {TABS.map((tItem) => {
            const isActive = activeTab === tItem.id;
            return (
              <button
                key={tItem.id}
                onClick={() => navigateToTab(tItem.id)}
                className={`flex-1 min-w-[130px] py-2 px-3.5 rounded-xl font-semibold text-xs transition-all duration-200 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
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
                    className="p-5 border border-slate-200/80 rounded-2xl bg-white hover:border-indigo-200 hover:shadow-md transition-all duration-200 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono font-semibold text-slate-500 block">#{s.id}</span>
                        <h4 className="font-bold text-slate-900 text-sm mt-0.5">{s.name}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
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
                      <span>•</span>
                      <span>{s.candidateEmails?.length || 0} {t('sess_candidates_unit')}</span>
                    </p>

                    <button
                      onClick={() => openExamRoom(s.id)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-xs active:scale-[0.99]"
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

      <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-200/50">
        &copy; 2026 CloudExam • Hệ thống Khảo thí Trực tuyến • UET VNU
      </footer>
    </div>
  );
}
