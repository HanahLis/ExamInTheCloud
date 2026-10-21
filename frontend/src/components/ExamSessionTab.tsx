import { useState } from 'react';
import {
  type Question,
  type Candidate,
  type ExamSession,
  type SessionStatus,
  sendSessionReport,
} from '../services/apiService';
import SessionResultsModal from './SessionResultsModal';

export type { ExamSession };

interface Props {
  questions: Question[];
  candidates: Candidate[];
  sessions: ExamSession[];
  loading?: boolean;
  onCreateSession: (s: Omit<ExamSession, 'id' | 'link' | 'createdAt'> & { id?: string }) => Promise<void> | void;
  onUpdateStatus?: (id: string, status: SessionStatus) => Promise<void> | void;
  onUpdateCandidates?: (id: string, candidateEmails: string[]) => Promise<void> | void;
  onOpenExam?: (sessionId: string) => void;
  onRefresh?: () => Promise<void> | void;
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; style: string }> = {
  SCHEDULED: { label: 'Chưa bắt đầu', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  RUNNING: { label: 'Đang diễn ra', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Đã kết thúc', style: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const ExamSessionTab = ({
  questions,
  candidates,
  sessions,
  loading = false,
  onCreateSession,
  onUpdateStatus,
  onUpdateCandidates,
  onOpenExam,
  onRefresh,
}: Props) => {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);

  const [viewingResultsSessionId, setViewingResultsSessionId] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, value: string, checked: boolean) =>
    set(checked ? [...list, value] : list.filter((x) => x !== value));

  const handleCreateSession = async () => {
    if (!name.trim() || !startTime || !endTime) {
      return alert('Vui lòng nhập tên ca thi, thời gian bắt đầu và kết thúc.');
    }
    if (new Date(endTime) <= new Date(startTime)) {
      return alert('Thời gian kết thúc phải sau thời gian bắt đầu.');
    }
    if (selectedQuestions.length === 0) return alert('Vui lòng chọn ít nhất 1 câu hỏi.');
    if (selectedCandidates.length === 0) return alert('Vui lòng chọn ít nhất 1 thí sinh.');

    setSubmitting(true);
    try {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      const initialStatus: SessionStatus =
        now >= start && now <= end ? 'RUNNING' : now < start ? 'SCHEDULED' : 'CLOSED';

      await onCreateSession({
        name: name.trim(),
        startTime,
        endTime,
        status: initialStatus,
        questionIds: selectedQuestions,
        candidateEmails: selectedCandidates,
      });

      setName('');
      setStartTime('');
      setEndTime('');
      setSelectedQuestions([]);
      setSelectedCandidates([]);
    } catch (err: any) {
      alert('Lỗi tạo ca thi: ' + (err?.response?.data?.error || err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (sessionId: string, newStatus: SessionStatus) => {
    if (!onUpdateStatus) return;
    setUpdatingId(sessionId);
    try {
      await onUpdateStatus(sessionId, newStatus);
    } catch (err: any) {
      alert('Lỗi cập nhật trạng thái: ' + (err?.response?.data?.error || err?.message || err));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendReportSNS = async (sessionId: string) => {
    setSendingReportId(sessionId);
    try {
      const res = await sendSessionReport(sessionId);
      alert(res.message || 'Đã gửi báo cáo bảng điểm qua Amazon SNS thành công.');
    } catch (err: any) {
      alert('Lỗi gửi báo cáo SNS: ' + (err?.response?.data?.error || err?.message || err));
    } finally {
      setSendingReportId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Form tạo ca thi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Tạo ca thi mới</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động hóa vòng đời ca thi bằng Step Functions, chọn câu hỏi và gán danh sách thí sinh.
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
            >
              Làm mới
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tên ca thi *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Thi cuối kỳ môn Điện toán đám mây - Ca 1"
            className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Thời gian bắt đầu *</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Thời gian kết thúc *</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md text-xs"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-medium text-slate-700">
              Chọn câu hỏi cho ca thi ({selectedQuestions.length}/{questions.length} đã chọn) *
            </label>
            <button
              type="button"
              className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              onClick={() =>
                setSelectedQuestions(selectedQuestions.length === questions.length ? [] : questions.map((q) => q.id))
              }
            >
              {selectedQuestions.length === questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2.5 space-y-1.5 bg-slate-50">
            {questions.length === 0 && (
              <p className="text-xs text-slate-400 py-3 text-center">Chưa có câu hỏi nào trong ngân hàng.</p>
            )}
            {questions.map((q) => (
              <label
                key={q.id}
                className="flex items-start space-x-2 text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-white rounded transition"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded text-slate-800"
                  checked={selectedQuestions.includes(q.id)}
                  onChange={(e) => toggle(selectedQuestions, setSelectedQuestions, q.id, e.target.checked)}
                />
                <span className="flex-1">
                  <span className="font-medium text-slate-900">[{q.difficulty}]</span> {q.content}{' '}
                  <span className="text-slate-400">({q.score} điểm)</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-medium text-slate-700">
              Danh sách thí sinh tham gia ({selectedCandidates.length}/{candidates.length} đã chọn) *
            </label>
            <button
              type="button"
              className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              onClick={() =>
                setSelectedCandidates(
                  selectedCandidates.length === candidates.length ? [] : candidates.map((c) => c.email)
                )
              }
            >
              {selectedCandidates.length === candidates.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2.5 space-y-1.5 bg-slate-50">
            {candidates.length === 0 && (
              <p className="text-xs text-slate-400 py-3 text-center">Chưa có thí sinh nào trong hệ thống.</p>
            )}
            {candidates.map((c) => (
              <label
                key={c.email}
                className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-white rounded transition"
              >
                <input
                  type="checkbox"
                  className="rounded text-slate-800"
                  checked={selectedCandidates.includes(c.email)}
                  onChange={(e) => toggle(selectedCandidates, setSelectedCandidates, c.email, e.target.checked)}
                />
                <span className="flex-1">
                  <span className="font-medium text-slate-900">{c.name}</span> ({c.studentCode}) —{' '}
                  <span className="font-mono text-slate-500">{c.email}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={handleCreateSession}
            disabled={submitting}
            className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-md text-xs hover:bg-slate-800 disabled:bg-slate-400 transition cursor-pointer"
          >
            {submitting ? 'Đang tạo ca thi...' : 'Tạo ca thi'}
          </button>
        </div>
      </div>

      {/* Danh sách ca thi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Danh sách ca thi ({sessions.length})
          </h3>
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
        </div>

        {sessions.length === 0 && !loading && (
          <p className="text-xs text-slate-400 py-6 text-center">Chưa có ca thi nào được tạo.</p>
        )}

        <div className="space-y-3">
          {sessions.map((s) => {
            const currentStatus = s.status || 'SCHEDULED';
            const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.SCHEDULED;
            const examUrl = `${window.location.origin}/?exam=${s.id}`;

            return (
              <div key={s.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 hover:border-slate-300 transition">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <span className="text-xs font-mono font-medium text-slate-500 mr-2">#{s.id}</span>
                    <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">Vòng đời: Step Functions</span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border ${statusConfig.style}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    {new Date(s.startTime).toLocaleString('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}{' '}
                    -{' '}
                    {new Date(s.endTime).toLocaleString('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span>{s.questionIds?.length || 0} câu hỏi</span>
                  <span>{s.candidateEmails?.length || 0} thí sinh</span>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                    <span>Thí sinh tham gia:</span>
                    <span className="text-[10px] text-slate-400">
                      ({s.candidateEmails?.length || 0} người)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.candidateEmails?.map((email) => {
                      const c = candidates.find((item) => item.email.toLowerCase() === email.toLowerCase());
                      return (
                        <span
                          key={email}
                          className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono"
                        >
                          {c ? c.name : email}
                        </span>
                      );
                    })}

                    {onUpdateCandidates &&
                      candidates
                        .filter((c) => !s.candidateEmails?.some((e) => e.toLowerCase() === c.email.toLowerCase()))
                        .map((c) => (
                          <button
                            key={c.email}
                            type="button"
                            onClick={() => onUpdateCandidates(s.id, [...(s.candidateEmails || []), c.email])}
                            className="inline-flex items-center px-1.5 py-0.5 bg-white border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 rounded text-[11px] transition cursor-pointer"
                            title="Thêm thí sinh vào ca thi"
                          >
                            + {c.name}
                          </button>
                        ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-1">Trạng thái:</span>
                    {currentStatus !== 'RUNNING' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'RUNNING')}
                        disabled={updatingId === s.id}
                        className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition cursor-pointer"
                      >
                        Bắt đầu
                      </button>
                    )}
                    {currentStatus !== 'SCHEDULED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'SCHEDULED')}
                        disabled={updatingId === s.id}
                        className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300 transition cursor-pointer"
                      >
                        Tạm dừng
                      </button>
                    )}
                    {currentStatus !== 'CLOSED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'CLOSED')}
                        disabled={updatingId === s.id}
                        className="px-2 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-700 transition cursor-pointer"
                      >
                        Kết thúc
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingResultsSessionId(s.id)}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 transition cursor-pointer"
                    >
                      Bảng điểm
                    </button>

                    <button
                      onClick={() => handleSendReportSNS(s.id)}
                      disabled={sendingReportId === s.id}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 transition cursor-pointer disabled:text-slate-400"
                      title="Gửi báo cáo bảng điểm qua Amazon SNS Topic"
                    >
                      {sendingReportId === s.id ? 'Đang gửi...' : 'Gửi báo cáo SNS'}
                    </button>
                    
                    {onOpenExam && (
                      <button
                        onClick={() => onOpenExam(s.id)}
                        className="px-2.5 py-1 bg-slate-900 text-white text-xs rounded hover:bg-slate-800 transition cursor-pointer"
                      >
                        Vào thi
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(examUrl);
                        alert(`Đã sao chép liên kết ca thi:\n${examUrl}`);
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50 cursor-pointer"
                    >
                      Sao chép liên kết
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {viewingResultsSessionId && (
        <SessionResultsModal
          isOpen={true}
          onClose={() => setViewingResultsSessionId(null)}
          sessionId={viewingResultsSessionId}
        />
      )}
    </div>
  );
};
