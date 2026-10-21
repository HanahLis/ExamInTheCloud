import { useCallback, useEffect, useState } from 'react';
import {
  redirectToCognitoLogin,
  logout,
  isLoggedIn,
  isMockSession,
  getCurrentUser,
  loginWithMockAccount,
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

const PRESET_ACCOUNTS = [
  {
    role: 'Organizer',
    label: 'Giảng viên',
    email: 'organizer@cloudexam.vn',
    groups: ['Organizer'],
    desc: 'Quản lý câu hỏi, danh sách thí sinh và ca thi',
  },
  {
    role: 'Candidate',
    label: 'Thí sinh 1 (Phạm Tuấn Phong)',
    email: 'phongpt@example.edu.vn',
    studentCode: 'B21DCCN001',
    groups: ['Candidate'],
    desc: 'MSSV: B21DCCN001 - Lớp D21CQCN01-B',
  },
  {
    role: 'Candidate',
    label: 'Thí sinh 2 (Trần Đức Mạnh)',
    email: 'manhtd@example.edu.vn',
    studentCode: 'B21DCCN002',
    groups: ['Candidate'],
    desc: 'MSSV: B21DCCN002 - Lớp D21CQCN01-B',
  },
  {
    role: 'Candidate',
    label: 'Thí sinh 3 (Nguyễn Thị Thu Hà)',
    email: 'hantt@example.edu.vn',
    studentCode: 'B21DCCN004',
    groups: ['Candidate'],
    desc: 'MSSV: B21DCCN004 - Lớp D21CQCN01-B',
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

  // Custom login state
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [customRole, setCustomRole] = useState<'Organizer' | 'Candidate' | 'Admin'>('Organizer');

  const loggedIn = isLoggedIn();
  const isMock = isMockSession();

  // Tải dữ liệu
  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, cs, ss] = await Promise.all([
        getQuestions().catch((e) => {
          console.error('Lỗi tải câu hỏi:', e);
          return [] as Question[];
        }),
        getCandidates().catch((e) => {
          console.error('Lỗi tải thí sinh:', e);
          return [] as Candidate[];
        }),
        getSessions().catch((e) => {
          console.error('Lỗi tải ca thi:', e);
          return [] as ExamSession[];
        }),
      ]);
      setQuestions(qs);
      setCandidates(cs);
      setSessions(ss);
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
    }
  }, [loggedIn, refreshAll]);

  if (window.location.pathname === '/callback') return <Callback />;

  // MÀN HÌNH ĐĂNG NHẬP
  if (!loggedIn) {
    const handleQuickLogin = (acc: typeof PRESET_ACCOUNTS[0]) => {
      loginWithMockAccount(acc.email, acc.groups, acc.studentCode || '');
      window.location.reload();
    };

    const handleCustomLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (!customEmail.trim()) return alert('Vui lòng nhập Email.');
      loginWithMockAccount(customEmail.trim(), [customRole]);
      window.location.reload();
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="mb-4 flex justify-end max-w-lg w-full">
          <CountryLanguageBar />
        </div>
        <div className="bg-white rounded-xl shadow-sm max-w-lg w-full border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 p-6 text-center">
            <h1 className="text-xl font-semibold text-slate-800">CloudExam</h1>
            <p className="text-xs text-slate-500 mt-1">Hệ thống thi và quản lý kỳ thi trực tuyến</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Đăng nhập hệ thống tổ chức */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-600">Đăng nhập bằng tài khoản tổ chức qua cổng xác thực:</p>
              <button
                onClick={redirectToCognitoLogin}
                className="w-full py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                Đăng nhập qua cổng xác thực
              </button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-xs text-slate-400 font-normal">hoặc chọn tài khoản thử nghiệm</span>
              <div className="border-t border-slate-200 w-full"></div>
            </div>

            {/* Tài khoản mẫu */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleQuickLogin(acc)}
                    className="p-3 text-left border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-slate-800 text-xs">{acc.label}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{acc.email}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 truncate">{acc.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Đăng nhập email tùy chỉnh */}
            <div className="pt-3 border-t border-slate-100">
              <form onSubmit={handleCustomLogin} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
                  />
                  <select
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value as any)}
                    className="p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400 font-medium text-slate-700 bg-white"
                  >
                    <option value="Organizer">Giảng viên</option>
                    <option value="Candidate">Thí sinh</option>
                    <option value="Admin">Quản trị viên</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-100 text-slate-700 font-medium rounded-md text-xs hover:bg-slate-200 transition cursor-pointer border border-slate-200"
                >
                  Đăng nhập với email này
                </button>
              </form>
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
            <span
              className={`font-medium px-2 py-0.5 rounded text-[10px] border ${
                isMock
                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {isMock ? 'Dữ liệu thử nghiệm' : 'Đang kết nối'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Hệ thống quản lý kỳ thi và ngân hàng câu hỏi
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <CountryLanguageBar />
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
