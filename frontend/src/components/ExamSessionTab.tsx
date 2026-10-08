import { useState } from 'react';
import type { Question } from '../services/apiService';
import type { Candidate } from './CandidatesTab';

export interface ExamSession {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  questionIds: string[];
  candidateEmails: string[];
  link: string;
}

interface Props {
  questions: Question[];
  candidates: Candidate[];
  sessions: ExamSession[];
  onCreateSession: (s: ExamSession) => void;
}

const getStatus = (s: ExamSession) => {
  const now = Date.now();
  if (now < new Date(s.startTime).getTime()) return { label: 'SCHEDULED', style: 'bg-amber-100 text-amber-800' };
  if (now < new Date(s.endTime).getTime()) return { label: 'RUNNING', style: 'bg-green-100 text-green-800' };
  return { label: 'CLOSED', style: 'bg-slate-200 text-slate-700' };
};

export const ExamSessionTab = ({ questions, candidates, sessions, onCreateSession }: Props) => {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string, checked: boolean) =>
    set(checked ? [...list, value] : list.filter((x) => x !== value));

  const handleCreateSession = () => {
    if (!name.trim() || !startTime || !endTime) {
      return alert('Vui lòng nhập tên ca thi, thời gian bắt đầu và kết thúc.');
    }
    if (new Date(endTime) <= new Date(startTime)) {
      return alert('Thời gian kết thúc phải sau thời gian bắt đầu.');
    }
    if (selectedQuestions.length === 0) return alert('Vui lòng chọn ít nhất 1 câu hỏi.');
    if (selectedCandidates.length === 0) return alert('Vui lòng chọn ít nhất 1 thí sinh.');

    // Mock: sau này ID và link do backend trả về
    const id = 'session-' + Math.random().toString(36).substring(2, 9);
    onCreateSession({
      id,
      name: name.trim(),
      startTime,
      endTime,
      questionIds: selectedQuestions,
      candidateEmails: selectedCandidates,
      link: `${window.location.origin}/exam/${id}`,
    });

    setName('');
    setStartTime('');
    setEndTime('');
    setSelectedQuestions([]);
    setSelectedCandidates([]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <h3 className="text-lg font-bold text-slate-800">Tạo ca thi và sinh link</h3>

        <div>
          <label className="block text-sm font-semibold mb-1">Tên ca thi</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Giữa kỳ Cloud Computing - Ca 1"
            className="w-full p-2.5 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Thời gian bắt đầu</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2.5 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Thời gian kết thúc</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2.5 border rounded-lg"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold">Chọn câu hỏi ({selectedQuestions.length} đã chọn)</label>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() =>
                setSelectedQuestions(selectedQuestions.length === questions.length ? [] : questions.map((q) => q.id))
              }
            >
              Chọn tất cả / Bỏ chọn
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
            {questions.length === 0 && <p className="text-sm text-slate-400">Chưa có câu hỏi (thêm ở tab 1)</p>}
            {questions.map((q) => (
              <label key={q.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedQuestions.includes(q.id)}
                  onChange={(e) => toggle(selectedQuestions, setSelectedQuestions, q.id, e.target.checked)}
                />
                <span>{q.content}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold">Chọn thí sinh ({selectedCandidates.length} đã chọn)</label>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() =>
                setSelectedCandidates(
                  selectedCandidates.length === candidates.length ? [] : candidates.map((c) => c.email)
                )
              }
            >
              Chọn tất cả / Bỏ chọn
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
            {candidates.length === 0 && <p className="text-sm text-slate-400">Chưa có thí sinh (thêm ở tab 2)</p>}
            {candidates.map((c) => (
              <label key={c.email} className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCandidates.includes(c.email)}
                  onChange={(e) => toggle(selectedCandidates, setSelectedCandidates, c.email, e.target.checked)}
                />
                <span>
                  {c.name} ({c.email})
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreateSession}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition"
        >
          Tạo ca thi và sinh Exam Link
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Các ca thi đã tạo ({sessions.length})</h3>
        {sessions.length === 0 && <p className="text-sm text-slate-400">Chưa có ca thi nào.</p>}
        <div className="space-y-4">
          {sessions.map((s) => {
            const status = getStatus(s);
            return (
              <div key={s.id} className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-indigo-900">{s.name}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${status.style}`}>{status.label}</span>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  {new Date(s.startTime).toLocaleString('vi-VN')} đến {new Date(s.endTime).toLocaleString('vi-VN')}
                  {' | '}
                  {s.questionIds.length} câu hỏi, {s.candidateEmails.length} thí sinh
                </p>
                <div className="flex items-center justify-between bg-white p-2.5 rounded border">
                  <span className="text-sm font-mono text-slate-700 truncate">{s.link}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(s.link);
                      alert('Đã copy link!');
                    }}
                    className="ml-3 px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700"
                  >
                    Copy link
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
