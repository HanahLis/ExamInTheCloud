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
  getCandidates,
  createCandidate,
  deleteCandidate,
  getSessions,
  createSession,
  updateSessionStatus,
  updateSessionCandidates,
  syncCloudDatabaseToProduction,
  type Question,
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
        className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
        title={`${t('domain_current_hint')} https://${currentDomain}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        {currentDomain}
      </span>

      <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
        <span className="text-xs text-slate-500">{t('country_label')}:</span>
        <select
          value={themeName}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 font-medium text-slate-700 cursor-pointer outline-none focus:border-slate-400"
        >
          <option value="vn">🇻🇳 {t('country_vn')} (vietnam.cloudexam.com)</option>
          <option value="la">🇱🇦 {t('country_la')} (lao.cloudexam.com)</option>
          <option value="de">🇩🇪 {t('country_de')} (germany.cloudexam.com)</option>
          <option value="default">🌐 {t('country_intl')} (cloudexam.com)</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
        <span className="text-xs text-slate-500">{t('lang_label')}:</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
          className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 font-medium text-slate-700 cursor-pointer outline-none focus:border-slate-400"
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
];

export default function App() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const initialRoute = parseRouteFromUrl();
  const [activeTab, setActiveTab] = useState<Tab>(initialRoute.tab);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
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
      const [qs, cs, ss] = await Promise.all([
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
      ]);
      if (Array.isArray(qs)) setQuestions(qs);
      if (Array.isArray(cs)) setCandidates(cs);
      if (Array.isArray(ss)) setSessions(ss);
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
      const u = getCurrentUser();
      const hasSyncedKey = 'cloudexam_synced_v2_' + u.email;
      if (!sessionStorage.getItem(hasSyncedKey) && (u.email === 'laladoraema@gmail.com' || u.groups.includes('Organizer'))) {
        sessionStorage.setItem(hasSyncedKey, '1');
        syncCloudDatabaseToProduction()
          .then((res) => {
            if (res.deletedQuestions > 0 || res.addedQuestions > 0 || res.deletedCandidates > 0) {
              setSyncNotice(res.message);
              refreshAll();
            }
          })
          .catch((e) => console.log('Auto-sync check on login:', e));
      }
    }
  }, [loggedIn, refreshAll]);

  const handleSyncToCloud = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      await syncCloudDatabaseToProduction();
      setSyncNotice(t('notice_sync_success'));
      await refreshAll();
    } catch (err: any) {
      setSyncNotice(`${t('notice_sync_error')} ${err?.response?.data?.error || err?.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  if (window.location.pathname === '/callback') return <Callback />;

  // MÀN HÌNH ĐĂNG NHẬP (AWS COGNITO AUTHENTICATION)
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-xs max-w-sm w-full border border-slate-200 p-6 space-y-5">
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t('app_title')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('login_title')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t('cand_table_email')}
              </label>
              <input
                type="email"
                list="vnu-accounts"
                placeholder="annv@uet.vnu.edu.vn hoặc 24020001@vnu.edu.vn"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-800 transition"
                required
                autoComplete="username"
              />
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
                placeholder="12345678"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-800 transition"
                required
                autoComplete="current-password"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {t('login_lecturer_hint')} <span className="font-mono text-slate-700 font-medium">annv@uet.vnu.edu.vn</span> (MK: <span className="font-mono text-slate-700 font-medium">12345678</span>)
              </p>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 disabled:bg-slate-400 transition cursor-pointer"
            >
              {loginLoading ? t('login_loading') : t('login_btn')}
            </button>

            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => redirectToCognitoLogin(false)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium"
              >
                {t('login_candidate_portal')}
              </button>
            </div>
          </form>
        </div>
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
      <div className="min-h-screen bg-slate-50 text-slate-700">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900">{t('app_title')}</h1>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-600">{t('tab_candidates')}: {user.name} ({user.studentCode || user.email})</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <CountryLanguageBar />
            <button
              onClick={logout}
              className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200 transition cursor-pointer"
            >
              {t('logout')}
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6 space-y-4">
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3">
            <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">{t('assigned_sessions')}</h2>
            {mySessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">{t('sess_empty')}</p>
            ) : (
              mySessions.map((s) => (
                <div key={s.id} className="p-3.5 border border-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <p className="font-medium text-slate-900 text-xs">{s.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => openExamRoom(s.id)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition cursor-pointer"
                  >
                    {t('enter_exam')}
                  </button>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    );
  }

  // CỔNG QUẢN LÝ (GIẢNG VIÊN / BAN TỔ CHỨC)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-slate-900">{t('app_title')}</h1>
          <span className="text-xs text-slate-300">|</span>
          <span className="text-xs text-slate-600">{user.name || user.email} ({user.groups.includes('Organizer') ? (t('app_subtitle_organizer') || 'Giảng viên') : 'Admin'})</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <CountryLanguageBar />
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="px-2.5 py-1 text-slate-700 hover:text-slate-900 border border-slate-200 rounded text-xs transition cursor-pointer disabled:opacity-50"
            title={t('sync_cloud')}
          >
            {syncing ? t('syncing_cloud') : t('sync_cloud')}
          </button>
          <button
            onClick={logout}
            className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200 transition cursor-pointer"
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-5">
        {syncNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{syncNotice}</span>
            </div>
            <button onClick={() => setSyncNotice(null)} className="font-bold text-slate-400 hover:text-slate-700 cursor-pointer text-sm">✕</button>
          </div>
        )}
        {/* Thanh chuyển Tab */}
        <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto">
          {TABS.map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => navigateToTab(tItem.id)}
              className={`pb-2.5 px-4 font-medium text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === tItem.id
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              style={{
                borderColor: activeTab === tItem.id ? theme.colors.primary : 'transparent',
                color: activeTab === tItem.id ? theme.colors.primary : undefined,
              }}
            >
              {t(tItem.labelKey)}
            </button>
          ))}
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
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {t('exam_online_room')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('exam_select_session_desc')}
              </p>
            </div>

            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                {t('sess_empty')}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2.5 hover:border-slate-300 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[11px] font-mono font-medium text-slate-500 block">#{s.id}</span>
                        <h4 className="font-medium text-slate-800 text-sm">{s.name}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                          s.status === 'RUNNING'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      {s.questionIds?.length || 0} {t('sess_questions_unit')} • {s.candidateEmails?.length || 0} {t('sess_candidates_unit')}
                    </p>

                    <button
                      onClick={() => openExamRoom(s.id)}
                      className="w-full py-2 bg-slate-900 text-white font-medium rounded-md text-xs hover:bg-slate-800 transition cursor-pointer"
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
    </div>
  );
}
