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

type Tab = 'questions' | 'candidates' | 'session' | 'exam_test';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'questions', label: '1. Ngân hàng câu hỏi', icon: '📚' },
  { id: 'candidates', label: '2. Thí sinh & ảnh mẫu', icon: '👤' },
  { id: 'session', label: '3. Tạo ca thi & sinh link', icon: '📅' },
  { id: 'exam_test', label: '4. Phòng thi (Rekognition & Nộp bài)', icon: '🛡️' },
];

const PRESET_ACCOUNTS = [
  {
    role: 'Organizer',
    label: 'Giảng viên / Người tổ chức',
    email: 'organizer@cloudexam.vn',
    groups: ['Organizer'],
    desc: 'Quản lý câu hỏi, thí sinh, tạo ca thi và kích hoạt trạng thái phòng thi',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    role: 'Candidate',
    label: 'Thí sinh 1 (Phạm Tuấn Phong)',
    email: 'phongpt@example.edu.vn',
    studentCode: 'B21DCCN001',
    groups: ['Candidate'],
    desc: 'Vào cổng thí sinh, xác thực khuôn mặt webcam và làm bài thi ca EX20261015001',
    badge: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    role: 'Candidate',
    label: 'Thí sinh 2 (Trần Đức Mạnh)',
    email: 'manhtd@example.edu.vn',
    studentCode: 'B21DCCN002',
    groups: ['Candidate'],
    desc: 'Thí sinh điểm danh với ảnh chân dung mẫu đã lưu',
    badge: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    role: 'Candidate',
    label: 'Thí sinh 3 (Nguyễn Thị Thu Hà)',
    email: 'hantt@example.edu.vn',
    studentCode: 'B21DCCN004',
    groups: ['Candidate'],
    desc: 'Thí sinh lớp D21CQCN01-B',
    badge: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    role: 'Admin',
    label: 'Quản trị viên hệ thống (Admin)',
    email: 'admin@cloudexam.vn',
    groups: ['Admin', 'Organizer'],
    desc: 'Toàn quyền cấu hình User Pool, API Gateway, IAM Roles và DynamoDB',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(false);

  // ID ca thi đang mở (nếu đang ở trong phòng thi)
  const [activeExamSessionId, setActiveExamSessionId] = useState<string | null>(null);

  // Custom login input form
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [customRole, setCustomRole] = useState<'Organizer' | 'Candidate' | 'Admin'>('Organizer');

  const loggedIn = isLoggedIn();
  const isMock = isMockSession();

  // 1. Tải toàn bộ dữ liệu từ AWS API Gateway / LocalStorage
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

  // 2. Kiểm tra URL param `?exam=ID` để mở thẳng phòng thi
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

  // Cognito Redirect Callback (/callback)
  if (window.location.pathname === '/callback') return <Callback />;

  // =========================================================================
  // MÀN HÌNH ĐĂNG NHẬP (AWS COGNITO AUTHENTICATION PORTAL)
  // =========================================================================
  if (!loggedIn) {
    const handleQuickLogin = (acc: typeof PRESET_ACCOUNTS[0]) => {
      loginWithMockAccount(acc.email, acc.groups, acc.studentCode || '');
      window.location.reload();
    };

    const handleCustomLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (!customEmail.trim()) return alert('Vui lòng nhập Email!');
      loginWithMockAccount(customEmail.trim(), [customRole]);
      window.location.reload();
    };

    return (
      <div className="min-h-screen bg-slate-100 py-10 px-4 flex flex-col justify-center items-center">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden">
          {/* Header phong cách AWS Cognito */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-xl mb-3 text-2xl">
              ☁️
            </div>
            <h1 className="text-2xl font-black tracking-tight">Amazon Cognito Authentication</h1>
            <p className="text-xs text-slate-300 mt-1 font-mono">
              User Pool: <span className="text-indigo-300">cloudexam-user-pool-dev</span> | OAuth 2.0 PKCE Flow
            </p>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {/* LỰA CHỌN 1: ĐĂNG NHẬP BẰNG TÀI KHOẢN AWS COGNITO THẬT */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200 text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                  Trải nghiệm từ đầu trên Cloud (Tài khoản AWS Thật)
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Đăng nhập hoặc đăng ký tài khoản qua Amazon Cognito Hosted UI để bắt đầu với Database DynamoDB & S3 sạch sẽ trên AWS.
              </p>
              <button
                onClick={redirectToCognitoLogin}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-lg text-xs hover:from-indigo-700 hover:to-blue-700 transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🌐</span>
                <span>Đăng nhập với AWS Cognito Hosted UI (Cloud Live)</span>
              </button>
            </div>

            {/* LỰA CHỌN 2: CHỌN TÀI KHOẢN THỬ NGHIỆM CÓ SẴN DATABASE */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  🎯 Hoặc chọn tài khoản thử nghiệm (Có sẵn Database):
                </h2>
                <span className="text-[11px] text-indigo-600 font-semibold">1-Click Đăng nhập</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleQuickLogin(acc)}
                    className="p-3.5 text-left border rounded-xl hover:border-indigo-500 hover:bg-indigo-50/50 transition group flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-800 text-xs group-hover:text-indigo-600">
                          {acc.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acc.badge}`}>
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{acc.email}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {acc.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Hoặc tự nhập tài khoản tùy chỉnh */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-700 mb-3">
                ✍️ Hoặc nhập tài khoản tùy ý của bạn:
              </h3>
              <form onSubmit={handleCustomLogin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="email"
                  placeholder="Email đăng nhập"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="p-2.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="p-2.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value as any)}
                  className="p-2.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="Organizer">👨‍🏫 Giảng viên (Organizer)</option>
                  <option value="Candidate">🎓 Thí sinh (Candidate)</option>
                  <option value="Admin">🛡️ Quản trị viên (Admin)</option>
                </select>
                <button
                  type="submit"
                  className="sm:col-span-3 py-2.5 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-black transition shadow cursor-pointer"
                >
                  Đăng nhập với tài khoản này
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

  // Xử lý Thêm / Xóa Thí sinh
  const handleAddCandidate = async (candidate: Candidate) => {
    const saved = await createCandidate(candidate);
    setCandidates((prev) => [...prev.filter((c) => c.email !== saved.email), saved]);
  };

  const handleRemoveCandidate = async (email: string) => {
    await deleteCandidate(email);
    setCandidates((prev) => prev.filter((c) => c.email !== email));
  };

  // Xử lý Tạo ca thi
  const handleCreateSession = async (
    sessionData: Omit<ExamSession, 'id' | 'link' | 'createdAt'> & { id?: string }
  ) => {
    const created = await createSession(sessionData);
    setSessions((prev) => [created, ...prev]);
  };

  // Xử lý Cập nhật trạng thái ca thi (SCHEDULED / RUNNING / CLOSED)
  const handleUpdateSessionStatus = async (sessionId: string, newStatus: SessionStatus) => {
    await updateSessionStatus(sessionId, newStatus);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: newStatus } : s))
    );
  };

  // Xử lý Thêm / Gán thí sinh vào ca thi
  const handleUpdateSessionCandidates = async (sessionId: string, candidateEmails: string[]) => {
    await updateSessionCandidates(sessionId, candidateEmails);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, candidateEmails } : s))
    );
  };

  // =========================================================================
  // GIAO DIỆN PHÒNG THI (EXAM ROOM)
  // =========================================================================
  if (activeExamSessionId) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
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

  // =========================================================================
  // GIAO DIỆN DÀNH CHO THÍ SINH (CANDIDATE PORTAL)
  // =========================================================================
  if (isCandidateOnly) {
    const mySessions = sessions.filter(
      (s) =>
        !s.candidateEmails ||
        s.candidateEmails.length === 0 ||
        s.candidateEmails.some((e) => e.toLowerCase() === user.email.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-slate-50 text-slate-700">
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm">
              🎓
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">Cổng Thí Sinh - CloudExam</h1>
              <p className="text-xs text-slate-500">
                Thí sinh: <span className="font-semibold text-slate-700">{user.email}</span>
                {user.studentCode && ` (MSSV: ${user.studentCode})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => {
                logout();
                window.location.reload();
              }}
              className="text-indigo-600 hover:underline font-semibold"
            >
              Đổi tài khoản
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-100 transition"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto p-6 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-800">Các ca thi được chỉ định cho bạn</h2>
                <p className="text-xs text-slate-500">
                  Bạn cần vượt qua bước xác thực khuôn mặt sinh trắc học trước khi làm bài.
                </p>
              </div>
              <button
                onClick={refreshAll}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                🔄 Làm mới
              </button>
            </div>

            {mySessions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                Hiện tại bạn chưa được gán vào ca thi nào. Hãy liên hệ Giảng viên để thêm email ({user.email}) vào ca thi.
              </p>
            ) : (
              <div className="space-y-3">
                {mySessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 border rounded-xl flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-indigo-600">#{s.id}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            s.status === 'RUNNING'
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        ⏰ {new Date(s.startTime).toLocaleString('vi-VN')} -{' '}
                        {new Date(s.endTime).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveExamSessionId(s.id)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
                    >
                      🚀 Vào phòng thi & Điểm danh
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

  // =========================================================================
  // GIAO DIỆN DÀNH CHO GIẢNG VIÊN & QUẢN TRỊ VIÊN (ORGANIZER / ADMIN PORTAL)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <header className="bg-white border-b px-6 py-3.5 flex flex-wrap justify-between items-center shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm">
            CE
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              CloudExam Organizer Portal
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Hạ tầng:</span>
              <span
                className={`font-semibold px-2 py-0.2 rounded-full text-[10px] border ${
                  isMock
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}
              >
                {isMock
                  ? 'Tài khoản thử nghiệm (Có sẵn Database mẫu)'
                  : 'Tài khoản AWS Thật (Cloud Live DynamoDB & S3)'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="font-semibold text-slate-800 block">{user.email}</span>
            <span className="text-[10px] text-slate-500 font-mono">
              Quyền: <strong className="text-indigo-600">{user.groups.join(', ') || 'Organizer'}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.reload();
            }}
            className="text-xs text-indigo-600 hover:underline font-semibold"
          >
            Đổi vai trò
          </button>
          <button
            onClick={logout}
            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-100 transition"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b overflow-x-auto pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 px-4 font-semibold text-xs border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
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

        {/* Tab 2: Thí sinh & ảnh mẫu (DynamoDB & S3) */}
        {activeTab === 'candidates' && (
          <CandidatesTab
            candidates={candidates}
            loading={loading}
            onAddCandidate={handleAddCandidate}
            onRemoveCandidate={handleRemoveCandidate}
            onRefresh={refreshAll}
          />
        )}

        {/* Tab 3: Tạo ca thi & sinh link (DynamoDB & Status Switch) */}
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

        {/* Tab 4: Thử nghiệm phòng thi Thí sinh (Test Rekognition & Submit) */}
        {activeTab === 'exam_test' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                🛡️ Thử nghiệm Phòng thi (Amazon Rekognition & Nộp bài thi)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Chọn một ca thi đang có để trải nghiệm trọn vẹn quy trình của Thí sinh: Bật Webcam điểm danh qua Rekognition và làm bài nộp lên AWS Lambda.
              </p>
            </div>

            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Chưa có ca thi nào. Hãy tạo ca thi ở Tab 3 trước.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 border rounded-xl bg-slate-50 space-y-3 hover:border-indigo-300 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-indigo-600 block">#{s.id}</span>
                        <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          s.status === 'RUNNING'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
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
                      className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition shadow-sm"
                    >
                      🚀 Vào phòng thi này để Test
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
