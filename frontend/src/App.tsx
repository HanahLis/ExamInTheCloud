import { useCallback, useEffect, useState } from 'react';
import { redirectToCognitoLogin, logout, isLoggedIn, getCurrentUser } from './services/auth';
import { getQuestions, type Question } from './services/apiService';
import { Callback } from './components/Callback';
import { QuestionBankTab } from './components/QuestionBankTab';
import { CandidatesTab, type Candidate } from './components/CandidatesTab';
import { ExamSessionTab, type ExamSession } from './components/ExamSessionTab';

type Tab = 'questions' | 'candidates' | 'session';

const TABS: { id: Tab; label: string }[] = [
  { id: 'questions', label: '1. Ngân hàng câu hỏi' },
  { id: 'candidates', label: '2. Thí sinh & ảnh mẫu' },
  { id: 'session', label: '3. Tạo ca thi & sinh link' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const loggedIn = isLoggedIn();

  const refreshQuestions = useCallback(async () => {
    try {
      setQuestions(await getQuestions());
    } catch (e) {
      console.error('Lỗi lấy danh sách câu hỏi', e);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) refreshQuestions();
  }, [loggedIn, refreshQuestions]);

  // Cognito redirect về /callback
  if (window.location.pathname === '/callback') return <Callback />;

  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-800">CloudExam Organizer</h1>
          <p className="text-sm text-slate-600">Đăng nhập để quản lý ngân hàng câu hỏi và tạo ca thi</p>
          <button
            onClick={redirectToCognitoLogin}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
          >
            Đăng nhập bằng AWS Cognito
          </button>
        </div>
      </div>
    );
  }

  const user = getCurrentUser();
  const canManage = user.groups.some((g) => ['Admin', 'Organizer'].includes(g));

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-800">Tài khoản chưa có quyền truy cập</h1>
          <p className="text-sm text-slate-600">
            {user.email || 'Tài khoản này'} chưa thuộc group Organizer hoặc Admin trong Cognito. Hãy nhờ quản trị viên
            thêm bạn vào group rồi đăng nhập lại.
          </p>
          <button onClick={logout} className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">CloudExam - Organizer Portal</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            {user.email}
            {user.groups.length > 0 && ` (${user.groups.join(', ')})`}
          </span>
          <button onClick={logout} className="font-semibold text-red-600 hover:underline">
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex space-x-2 border-b">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 px-4 font-semibold text-sm border-b-2 transition ${
                activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'questions' && <QuestionBankTab questions={questions} onRefresh={refreshQuestions} />}
        {activeTab === 'candidates' && (
          <CandidatesTab
            candidates={candidates}
            onAddCandidate={(c) => setCandidates((prev) => [...prev, c])}
            onRemoveCandidate={(email) => setCandidates((prev) => prev.filter((c) => c.email !== email))}
          />
        )}
        {activeTab === 'session' && (
          <ExamSessionTab
            questions={questions}
            candidates={candidates}
            sessions={sessions}
            onCreateSession={(s) => setSessions((prev) => [s, ...prev])}
          />
        )}
      </main>
    </div>
  );
}
