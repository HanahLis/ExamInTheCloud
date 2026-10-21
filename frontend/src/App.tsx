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
  DEFAULT_QUESTIONS,
  DEFAULT_CANDIDATES,
  DEFAULT_SESSIONS,
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

type Tab = 'questions' | 'candidates' | 'session' | 'exam_test';

export const CountryLanguageBar = () => {
  const { themeName, setThemeName } = useTheme();
  const { lang, setLang, t } = useTranslation();

  const handleCountryChange = (c: string) => {
    setThemeName(c);
    if (c === 'vn') setLang('vi');
    else if (c === 'la') setLang('la');
    else setLang('en');
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
        <span className="text-xs text-slate-500">{t('country_label')}:</span>
        <select
          value={themeName}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 font-medium text-slate-700 cursor-pointer outline-none focus:border-slate-400"
        >
          <option value="vn">Việt Nam</option>
          <option value="la">Lào</option>
          <option value="default">Quốc tế</option>
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
        </select>
      </div>
    </div>
  );
};

const TABS: { id: Tab; labelKey: string }[] = [
  { id: 'questions', labelKey: 'tab_questions' },
  { id: 'candidates', labelKey: 'tab_candidates' },
  { id: 'session', labelKey: 'tab_sessions' },
  { id: 'exam_test', labelKey: 'tab_exam_test' },
];

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
    role: 'Candidate',
    name: 'Trần Minh Đức',
    email: 'duc.tm24@vnu.edu.vn',
    studentCode: '24020001',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Lê Thị Mai',
    email: 'mai.lt24@vnu.edu.vn',
    studentCode: '24020002',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Phạm Hoàng Long',
    email: 'long.ph24@vnu.edu.vn',
    studentCode: '24020003',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Vũ Thùy Linh',
    email: 'linh.vt24@vnu.edu.vn',
    studentCode: '24020004',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Đỗ Quang Huy',
    email: 'huy.dq24@vnu.edu.vn',
    studentCode: '24020005',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Ngô Thị Hương',
    email: 'huong.nt24@vnu.edu.vn',
    studentCode: '24020006',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Bùi Văn Tuấn',
    email: 'tuan.bv24@vnu.edu.vn',
    studentCode: '24020007',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Hoàng Minh Thư',
    email: 'thu.hm24@vnu.edu.vn',
    studentCode: '24020008',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Đặng Minh Quân',
    email: 'quan.dm24@vnu.edu.vn',
    studentCode: '24020009',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
  {
    role: 'Candidate',
    name: 'Nguyễn Quỳnh Chi',
    email: 'chi.nq24@vnu.edu.vn',
    studentCode: '24020010',
    unit: 'Sinh viên K69 - Khoa CNTT - UET',
  },
];

export default function App() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(false);

  // ID ca thi đang mở (nếu đang ở trong phòng thi)
  const [activeExamSessionId, setActiveExamSessionId] = useState<string | null>(null);

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
          return DEFAULT_QUESTIONS;
        }),
        getCandidates().catch((e) => {
          console.error('Lỗi tải thí sinh:', e);
          return DEFAULT_CANDIDATES;
        }),
        getSessions().catch((e) => {
          console.error('Lỗi tải ca thi:', e);
          return DEFAULT_SESSIONS;
        }),
      ]);
      setQuestions(qs && qs.length > 0 ? qs : DEFAULT_QUESTIONS);
      setCandidates(cs && cs.length > 0 ? cs : DEFAULT_CANDIDATES);
      setSessions(ss && ss.length > 0 ? ss : DEFAULT_SESSIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Kiểm tra URL param `?exam=ID`
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const examParam = params.get('exam');
    if (examParam) {
      setActiveExamSessionId(examParam);
    }
  }, []);

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
      const res = await syncCloudDatabaseToProduction();
      setSyncNotice(res.message);
      await refreshAll();
    } catch (err: any) {
      setSyncNotice('Lỗi đồng bộ CSDL AWS: ' + (err?.response?.data?.error || err?.message || err));
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
        return alert('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      }
      setLoginLoading(true);
      try {
        await loginWithCognitoPassword(loginEmail.trim(), loginPassword);
        window.location.reload();
      } catch (err: any) {
        alert(err?.message || 'Đăng nhập thất bại.');
      } finally {
        setLoginLoading(false);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-xs max-w-sm w-full border border-slate-200 p-6 space-y-5">
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">CloudExam</h1>
            <p className="text-xs text-slate-500 mt-0.5">Đăng nhập tài khoản</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                list="vnu-accounts"
                placeholder="annv@uet.vnu.edu.vn hoặc duc.tm24@vnu.edu.vn"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-800 transition"
                required
                autoComplete="username"
              />
              <datalist id="vnu-accounts">
                {DATABASE_ACCOUNTS.map((acc) => (
                  <option key={acc.email} value={acc.email}>
                    {acc.name} ({acc.role === 'Organizer' ? 'Giảng viên' : acc.studentCode})
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mật khẩu
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
              <p className="text-[11px] text-slate-400 mt-1">
                Mật khẩu mặc định: <span className="font-mono text-slate-600 font-medium">12345678</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 disabled:bg-slate-400 transition cursor-pointer"
            >
              {loginLoading ? 'Đang xác thực...' : 'Đăng nhập với AWS Cognito'}
            </button>

            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={redirectToCognitoLogin}
                className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer underline"
              >
                Đăng nhập qua AWS Cognito Hosted UI
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
    setSyncNotice(`Đã lưu thí sinh "${candidate.name}" (${candidate.email}) trực tiếp lên AWS DynamoDB.`);
  };

  const handleRemoveCandidate = async (email: string) => {
    await deleteCandidate(email);
    setCandidates((prev) => prev.filter((c) => c.email !== email));
    setSyncNotice(`Đã xóa thí sinh "${email}" khỏi CSDL AWS DynamoDB.`);
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
          onExit={() => {
            setActiveExamSessionId(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('exam');
            window.history.replaceState({}, '', url.pathname);
          }}
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
            <h1 className="text-sm font-bold text-slate-900">CloudExam</h1>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-600">Thí sinh: {user.name} ({user.studentCode || user.email})</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <CountryLanguageBar />
            <button
              onClick={logout}
              className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200 transition cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6 space-y-4">
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3">
            <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Ca thi được chỉ định</h2>
            {mySessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Chưa có ca thi nào.</p>
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
                    onClick={() => setActiveExamSessionId(s.id)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition cursor-pointer"
                  >
                    Vào phòng thi
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
          <h1 className="text-sm font-bold text-slate-900">CloudExam</h1>
          <span className="text-xs text-slate-300">|</span>
          <span className="text-xs text-slate-600">{user.name || user.email} ({user.groups.includes('Organizer') ? 'Giảng viên' : 'Admin'})</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <CountryLanguageBar />
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="px-2.5 py-1 text-slate-700 hover:text-slate-900 border border-slate-200 rounded text-xs transition cursor-pointer disabled:opacity-50"
            title="Đồng bộ CSDL lên AWS Cloud"
          >
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloud'}
          </button>
          <button
            onClick={logout}
            className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200 transition cursor-pointer"
          >
            Đăng xuất
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
              onClick={() => setActiveTab(tItem.id)}
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
            onOpenExam={(id) => setActiveExamSessionId(id)}
            onRefresh={refreshAll}
          />
        )}

        {/* Tab 4: Phòng thi */}
        {activeTab === 'exam_test' && (
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Phòng thi trực tuyến
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn một ca thi để mở giao diện phòng thi dành cho thí sinh.
              </p>
            </div>

            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Chưa có ca thi nào. Hãy tạo ca thi ở mục Ca thi trước.
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
                      {s.questionIds?.length || 0} câu hỏi • {s.candidateEmails?.length || 0} thí sinh
                    </p>

                    <button
                      onClick={() => setActiveExamSessionId(s.id)}
                      className="w-full py-2 bg-slate-900 text-white font-medium rounded-md text-xs hover:bg-slate-800 transition cursor-pointer"
                    >
                      Vào phòng thi
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
