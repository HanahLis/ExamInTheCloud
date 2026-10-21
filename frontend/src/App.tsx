import { useCallback, useEffect, useState } from 'react';
import {
  redirectToCognitoLogin,
  logout,
  isLoggedIn,
  getCurrentUser,
  loginWithCognitoPassword,
  loginWithDatabaseAccount,
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
  const [accountFilter, setAccountFilter] = useState<'ALL' | 'Organizer' | 'Candidate'>('ALL');

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

  // MÀN HÌNH ĐĂNG NHẬP THỰC TẾ (AWS CLOUD COGNITO AUTHENTICATION)
  if (!loggedIn) {
    const handleLoginWithAccount = (acc: SystemAccount) => {
      try {
        loginWithDatabaseAccount(acc.email, [acc.role], acc.name, acc.studentCode || '');
        window.location.reload();
      } catch (err: any) {
        alert('Lỗi khởi tạo phiên đăng nhập: ' + (err?.message || err));
      }
    };

    const handleDirectCognitoLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginEmail.trim() || !loginPassword.trim()) {
        return alert('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      }
      setLoginLoading(true);
      try {
        await loginWithCognitoPassword(loginEmail.trim(), loginPassword);
        window.location.reload();
      } catch (err: any) {
        alert('Lỗi đăng nhập AWS Cognito: ' + (err?.message || err));
      } finally {
        setLoginLoading(false);
      }
    };

    const filteredAccounts = DATABASE_ACCOUNTS.filter((acc) => {
      if (accountFilter === 'ALL') return true;
      return acc.role === accountFilter;
    });

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="mb-4 flex justify-between items-center max-w-4xl w-full">
          <div>
            <span className="text-xs font-semibold text-slate-800 tracking-wide uppercase">
              Trường Đại học Công nghệ - ĐHQGHN (UET - VNU)
            </span>
          </div>
          <CountryLanguageBar />
        </div>

        <div className="bg-white rounded-xl shadow-sm max-w-4xl w-full border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-100 p-6 text-center bg-gradient-to-b from-white to-slate-50/50">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">CloudExam</h1>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Hệ thống Khảo thí & Điểm danh Trực tuyến Phục vụ Giảng dạy & Đánh giá Năng lực
            </p>
            <div className="mt-3 flex flex-wrap justify-center items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                Cognito User Pool
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                API Gateway REST
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                Amazon DynamoDB
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                Rekognition AI
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Phương thức 1: Đăng nhập qua Cognito Hosted UI */}
            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Cổng Xác thực Tập trung AWS (Amazon Cognito SSO)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đăng nhập bảo mật chuẩn OAuth 2.0 PKCE với tài khoản sinh viên/giảng viên được cấp
                </p>
              </div>

              <button
                onClick={redirectToCognitoLogin}
                className="w-full sm:w-auto sm:min-w-[280px] px-6 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition cursor-pointer shadow-sm"
              >
                Đăng nhập qua Cổng xác thực AWS (Amazon Cognito)
              </button>
            </div>

            {/* Phương thức 2: Form đăng nhập trực tiếp */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <div className="mb-3 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-800">
                    Đăng nhập trực tiếp bằng tài khoản AWS Cognito:
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mật khẩu mẫu hệ thống: <span className="font-mono font-medium text-slate-800 bg-slate-100 px-1 py-0.5 rounded">CloudExam@2026</span>
                  </p>
                </div>
              </div>
              <form onSubmit={handleDirectCognitoLogin} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Email đăng nhập:
                    </label>
                    <input
                      type="email"
                      placeholder="annv@uet.vnu.edu.vn hoặc duc.tm24@vnu.edu.vn"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Mật khẩu (yêu cầu &ge; 8 ký tự, hoa, thường, số, ký tự đặc biệt):
                    </label>
                    <input
                      type="password"
                      placeholder="Ví dụ: CloudExam@2026"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full sm:w-auto px-5 py-2 bg-slate-800 text-white text-xs font-medium rounded-md hover:bg-slate-700 disabled:bg-slate-400 transition cursor-pointer"
                  >
                    {loginLoading ? 'Đang xác thực AWS...' : 'Đăng nhập với AWS Cognito'}
                  </button>
                </div>
              </form>
            </div>

            {/* Danh bạ tài khoản đã cấp trong Cơ sở dữ liệu */}
            <div className="pt-2">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Danh bạ tài khoản đã được cấp phép trong Cơ sở dữ liệu:
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hệ thống đã nạp sẵn tài khoản Giảng viên và 10 Sinh viên theo phân quyền RBAC
                  </p>
                </div>

                {/* Bộ lọc vai trò */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setAccountFilter('ALL')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition ${
                      accountFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả (11)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountFilter('Organizer')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition ${
                      accountFilter === 'Organizer'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Giảng viên (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountFilter('Candidate')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition ${
                      accountFilter === 'Candidate'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sinh viên (10)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredAccounts.map((acc) => (
                  <div
                    key={acc.email}
                    className="p-3 border border-slate-200 rounded-lg bg-white hover:border-slate-400 hover:bg-slate-50/50 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1 gap-1">
                        <span className="font-semibold text-slate-900 text-xs line-clamp-1">
                          {acc.name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                            acc.role === 'Organizer'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {acc.role === 'Organizer' ? 'Giảng viên' : 'Thí sinh'}
                        </span>
                      </div>

                      {acc.studentCode && (
                        <p className="text-[11px] text-slate-500 font-mono mb-0.5">
                          Mã: <span className="font-medium text-slate-700">{acc.studentCode}</span>
                        </p>
                      )}

                      <p className="text-[11px] font-mono text-slate-600 truncate">{acc.email}</p>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{acc.unit}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail(acc.email);
                          setLoginPassword('CloudExam@2026');
                        }}
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        title="Điền email và mật khẩu mẫu vào form"
                      >
                        Điền email & mật khẩu
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoginWithAccount(acc)}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-medium hover:bg-slate-800 transition cursor-pointer"
                      >
                        Đăng nhập vai trò này
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
  };

  const handleRemoveCandidate = async (email: string) => {
    await deleteCandidate(email);
    setCandidates((prev) => prev.filter((c) => c.email !== email));
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
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex justify-between items-center">
          <div>
            <h1 className="text-base font-semibold text-slate-800">Cổng thí sinh - CloudExam</h1>
            <p className="text-xs text-slate-500">
              Thí sinh: <span className="font-medium text-slate-700">{user.email}</span>
              {user.studentCode && ` (MSSV: ${user.studentCode})`}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <CountryLanguageBar />
            <button
              onClick={() => {
                logout();
                window.location.reload();
              }}
              className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
            >
              Đổi tài khoản
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md font-medium hover:bg-slate-200 transition cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto p-6 space-y-4">
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Danh sách ca thi được chỉ định</h2>
                <p className="text-xs text-slate-500">Vui lòng hoàn thành bước xác thực khuôn mặt trước khi vào bài thi.</p>
              </div>
              <button
                onClick={refreshAll}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                Làm mới
              </button>
            </div>

            {mySessions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Hiện tại bạn chưa được gán vào ca thi nào.
              </p>
            ) : (
              <div className="space-y-2.5">
                {mySessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-slate-600">#{s.id}</span>
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
                      <p className="font-medium text-slate-800 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(s.startTime).toLocaleString('vi-VN')} -{' '}
                        {new Date(s.endTime).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveExamSessionId(s.id)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 transition cursor-pointer"
                    >
                      Vào phòng thi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // CỔNG QUẢN LÝ (GIẢNG VIÊN / BAN TỔ CHỨC)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-800">
              CloudExam
            </h1>
            <span className="font-medium px-2 py-0.5 rounded text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200 font-mono">
              AWS Cloud Production
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Hệ thống quản lý kỳ thi và ngân hàng câu hỏi
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <CountryLanguageBar />

          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Dọn sạch câu hỏi/thí sinh cũ và nạp 10 câu hỏi Kiến trúc PTPM + 10 SV và PGS. TS. Nguyễn Văn An lên AWS DynamoDB"
          >
            {syncing ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Đang đồng bộ AWS...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Đồng bộ CSDL lên AWS Cloud</span>
              </>
            )}
          </button>

          <div className="text-right">
            <span className="font-medium text-slate-800 block">{user.email}</span>
            <span className="text-[11px] text-slate-500">
              Vai trò: {user.groups.join(', ') || 'Organizer'}
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.reload();
            }}
            className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
          >
            Đổi tài khoản
          </button>
          <button
            onClick={logout}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md font-medium hover:bg-slate-200 transition cursor-pointer"
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
