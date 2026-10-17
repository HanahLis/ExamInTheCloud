import { useState } from 'react';
import type { Question, Candidate, ExamSession, SessionStatus } from '../services/apiService';
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
  SCHEDULED: { label: 'ĐÃ LÊN LỊCH', style: 'bg-amber-100 text-amber-800 border-amber-300' },
  RUNNING: { label: 'ĐANG DIỄN RA', style: 'bg-green-100 text-green-800 border-green-300' },
  CLOSED: { label: 'ĐÃ KẾT THÚC', style: 'bg-slate-200 text-slate-700 border-slate-300' },
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
  
  // State điều khiển Modal xem điểm
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
      alert('Đã tạo ca thi thành công trên AWS DynamoDB!');
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
      alert('Lỗi cập nhật trạng thái ca thi: ' + (err?.response?.data?.error || err?.message || err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Tạo ca thi trực tuyến & Sinh Link làm bài</h3>
            <p className="text-xs text-slate-500 mt-1">
              Ca thi được lưu vào DynamoDB (`CloudExam_Sessions_dev`). Rekognition sẽ kiểm tra trạng thái RUNNING khi thí sinh vào thi.
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
            >
              🔄 Làm mới
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tên ca thi *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Thi Cuối Kỳ Điện Toán Đám Mây - Ca 1"
            className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Thời gian bắt đầu *</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Thời gian kết thúc *</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-700">
              Chọn câu hỏi cho ca thi ({selectedQuestions.length}/{questions.length} đã chọn) *
            </label>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
              onClick={() =>
                setSelectedQuestions(selectedQuestions.length === questions.length ? [] : questions.map((q) => q.id))
              }
            >
              {selectedQuestions.length === questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto border rounded-lg p-3 space-y-2 bg-slate-50">
            {questions.length === 0 && (
              <p className="text-xs text-slate-400 py-2 text-center">Chưa có câu hỏi nào (Thêm ở Tab 1)</p>
            )}
            {questions.map((q) => (
              <label
                key={q.id}
                className="flex items-start space-x-2.5 text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-white rounded transition"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  checked={selectedQuestions.includes(q.id)}
                  onChange={(e) => toggle(selectedQuestions, setSelectedQuestions, q.id, e.target.checked)}
                />
                <span className="flex-1">
                  <span className="font-semibold text-blue-700">[{q.difficulty}]</span> {q.content}{' '}
                  <span className="text-slate-400">({q.score} điểm)</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-700">
              Gán danh sách thí sinh dự thi ({selectedCandidates.length}/{candidates.length} đã chọn) *
            </label>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
              onClick={() =>
                setSelectedCandidates(
                  selectedCandidates.length === candidates.length ? [] : candidates.map((c) => c.email)
                )
              }
            >
              {selectedCandidates.length === candidates.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto border rounded-lg p-3 space-y-2 bg-slate-50">
            {candidates.length === 0 && (
              <p className="text-xs text-slate-400 py-2 text-center">Chưa có thí sinh nào (Thêm ở Tab 2)</p>
            )}
            {candidates.map((c) => (
              <label
                key={c.email}
                className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-white rounded transition"
              >
                <input
                  type="checkbox"
                  className="rounded text-blue-600 focus:ring-blue-500"
                  checked={selectedCandidates.includes(c.email)}
                  onChange={(e) => toggle(selectedCandidates, setSelectedCandidates, c.email, e.target.checked)}
                />
                <span className="flex-1">
                  <span className="font-semibold text-slate-900">{c.name}</span> ({c.studentCode}) —{' '}
                  <span className="font-mono text-slate-500">{c.email}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreateSession}
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition shadow cursor-pointer"
        >
          {submitting ? 'Đang tạo ca thi trên DynamoDB...' : '🚀 Tạo ca thi và Lưu vào AWS DynamoDB'}
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            Danh sách ca thi trong hệ thống ({sessions.length})
          </h3>
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
        </div>

        {sessions.length === 0 && !loading && (
          <p className="text-sm text-slate-400 py-4 text-center">Chưa có ca thi nào được tạo.</p>
        )}

        <div className="space-y-4">
          {sessions.map((s) => {
            const currentStatus = s.status || 'SCHEDULED';
            const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.SCHEDULED;
            const examUrl = `${window.location.origin}/?exam=${s.id}`;

            return (
              <div key={s.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 hover:border-blue-300 transition">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 mr-2">#{s.id}</span>
                    <span className="font-bold text-slate-800 text-base">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusConfig.style}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    ⏰{' '}
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
                  <span>📝 {s.questionIds?.length || 0} câu hỏi</span>
                  <span>👥 {s.candidateEmails?.length || 0} thí sinh</span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-slate-600 font-semibold">
                    <span>Thí sinh được phân công vào ca thi này:</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({s.candidateEmails?.length || 0} người)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.candidateEmails?.map((email) => {
                      const c = candidates.find((item) => item.email.toLowerCase() === email.toLowerCase());
                      return (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[11px] font-mono"
                        >
                          <span>{c ? c.name : email}</span>
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
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 rounded text-[11px] font-medium transition shadow-2xs cursor-pointer"
                            title="Bấm để thêm thí sinh này vào ca thi"
                          >
                            <span>+ Thêm {c.name}</span>
                          </button>
                        ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Đổi trạng thái:</span>
                    {currentStatus !== 'RUNNING' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'RUNNING')}
                        disabled={updatingId === s.id}
                        className="px-2.5 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition cursor-pointer"
                      >
                        ▶ Bật ca thi (RUNNING)
                      </button>
                    )}
                    {currentStatus !== 'SCHEDULED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'SCHEDULED')}
                        disabled={updatingId === s.id}
                        className="px-2.5 py-1 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700 transition cursor-pointer"
                      >
                        ⏸ Chờ bắt đầu (SCHEDULED)
                      </button>
                    )}
                    {currentStatus !== 'CLOSED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'CLOSED')}
                        disabled={updatingId === s.id}
                        className="px-2.5 py-1 bg-slate-600 text-white text-xs font-semibold rounded hover:bg-slate-700 transition cursor-pointer"
                      >
                        ⏹ Kết thúc (CLOSED)
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingResultsSessionId(s.id)}
                      className="px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded hover:bg-purple-700 transition shadow-sm cursor-pointer"
                    >
                      📊 Xem Bảng Điểm
                    </button>
                    
                    {onOpenExam && (
                      <button
                        onClick={() => onOpenExam(s.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition shadow-sm cursor-pointer"
                      >
                        🔗 Vào thi (Test Rekognition)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(examUrl);
                        alert(`Đã sao chép link ca thi:\n${examUrl}`);
                      }}
                      className="px-3 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-100 cursor-pointer"
                    >
                      📋 Copy Link
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Tích hợp Modal */}
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