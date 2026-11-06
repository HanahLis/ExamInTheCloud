import { useState, useMemo, useEffect } from 'react';
import {
  type Question,
  type Candidate,
  type ExamSession,
  type SessionStatus,
  type QuestionBank,
  getQuestionBanks,
  resolveSessionStatus,
  sendSessionReport,
} from '../services/apiService';
import SessionResultsModal from './SessionResultsModal';
import { useTranslation } from '../locales/i18nContext';

export type { ExamSession };

interface Props {
  questions: Question[];
  candidates: Candidate[];
  sessions: ExamSession[];
  questionBanks?: QuestionBank[];
  loading?: boolean;
  onCreateSession: (s: Omit<ExamSession, 'id' | 'link' | 'createdAt'> & { id?: string }) => Promise<void> | void;
  onUpdateStatus?: (id: string, status: SessionStatus) => Promise<void> | void;
  onUpdateCandidates?: (id: string, candidateEmails: string[]) => Promise<void> | void;
  onOpenExam?: (sessionId: string) => void;
  onRefresh?: () => Promise<void> | void;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700 border-slate-200',
  RUNNING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_KEYS: Record<SessionStatus, string> = {
  SCHEDULED: 'sess_status_scheduled',
  RUNNING: 'sess_status_running',
  CLOSED: 'sess_status_closed',
};

export const ExamSessionTab = ({
  questions,
  candidates,
  sessions,
  questionBanks = [],
  loading = false,
  onCreateSession,
  onUpdateStatus,
  onUpdateCandidates,
  onOpenExam,
  onRefresh,
}: Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);

  const [viewingResultsSessionId, setViewingResultsSessionId] = useState<string | null>(null);

  // Danh sách ngân hàng đề phục vụ phân nhóm câu hỏi
  const [banks, setBanks] = useState<QuestionBank[]>(questionBanks);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');

  useEffect(() => {
    if (questionBanks && questionBanks.length > 0) {
      setBanks(questionBanks);
    } else {
      getQuestionBanks()
        .then((b) => {
          if (Array.isArray(b)) setBanks(b);
        })
        .catch((e) => console.warn('Lỗi tải ngân hàng câu hỏi:', e));
    }
  }, [questionBanks]);

  // Ánh xạ bankId -> QuestionBank
  const bankNameMap = useMemo(() => {
    const map = new Map<string, QuestionBank>();
    for (const b of banks) {
      if (b.id) map.set(b.id, b);
      if (b.bankId) map.set(b.bankId, b);
    }
    return map;
  }, [banks]);

  // Gom nhóm câu hỏi theo từng ngân hàng đề
  const groupedQuestions = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const q of questions) {
      const bId = q.bankId || 'unassigned';
      if (!map.has(bId)) {
        map.set(bId, []);
      }
      map.get(bId)!.push(q);
    }

    const groups: {
      bankId: string;
      bankName: string;
      subject?: string;
      questions: Question[];
    }[] = [];

    const processedBankIds = new Set<string>();
    for (const b of banks) {
      const bQuestions = map.get(b.id) || (b.bankId ? map.get(b.bankId) : []) || [];
      if (bQuestions.length > 0) {
        groups.push({
          bankId: b.id,
          bankName: b.name,
          subject: b.subject,
          questions: bQuestions,
        });
        processedBankIds.add(b.id);
        if (b.bankId) processedBankIds.add(b.bankId);
      }
    }

    // Các câu hỏi còn lại chưa thuộc ngân hàng trong danh sách
    for (const [bId, qList] of map.entries()) {
      if (!processedBankIds.has(bId) && qList.length > 0) {
        const bankInfo = bankNameMap.get(bId);
        groups.push({
          bankId: bId,
          bankName:
            bankInfo?.name ||
            (bId === 'unassigned' ? 'Câu hỏi chung (Chưa phân ngân hàng)' : `Ngân hàng đề: ${bId}`),
          subject: bankInfo?.subject,
          questions: qList,
        });
      }
    }

    return groups;
  }, [questions, banks, bankNameMap]);

  const displayGroups = useMemo(() => {
    if (selectedBankFilter === 'ALL') return groupedQuestions;
    return groupedQuestions.filter((g) => g.bankId === selectedBankFilter);
  }, [groupedQuestions, selectedBankFilter]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string, checked: boolean) =>
    set(checked ? [...list, value] : list.filter((x) => x !== value));

  const handleCreateSession = async () => {
    if (!name.trim() || !startTime || !endTime) {
      return alert(t('alert_fill_session_fields'));
    }
    if (new Date(endTime) <= new Date(startTime)) {
      return alert(t('alert_end_after_start'));
    }
    if (selectedQuestions.length === 0) return alert(t('alert_select_at_least_one_question'));
    if (selectedCandidates.length === 0) return alert(t('alert_select_at_least_one_candidate'));

    setSubmitting(true);
    try {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      const initialStatus: SessionStatus =
        now >= start && now <= end ? 'RUNNING' : now < start ? 'SCHEDULED' : 'CLOSED';

      await onCreateSession({
        name: name.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
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
      alert(`${t('alert_create_session_error')} ${err?.response?.data?.error || err?.message || err}`);
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
      alert(`${t('alert_update_status_error')} ${err?.response?.data?.error || err?.message || err}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendReportSNS = async (sessionId: string) => {
    setSendingReportId(sessionId);
    try {
      await sendSessionReport(sessionId);
      alert(t('alert_send_sns_success'));
    } catch (err: any) {
      alert(`${t('alert_send_sns_error')} ${err?.response?.data?.error || err?.message || err}`);
    } finally {
      setSendingReportId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Form tạo ca thi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-800">{t('sess_create_new')}</h3>
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
            >
              {t('refresh')}
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('sess_name_label')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sess_placeholder_name')}
            className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('sess_start_time_label')}</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('sess_end_time_label')}</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md text-xs"
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <span>{t('sess_select_questions')}</span>
              <span className="text-slate-500 font-normal">
                ({selectedQuestions.length}/{questions.length} {t('sess_questions_unit')} đã chọn) *
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {groupedQuestions.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">Lọc theo ngân hàng:</span>
                  <select
                    value={selectedBankFilter}
                    onChange={(e) => setSelectedBankFilter(e.target.value)}
                    className="text-xs py-1 px-2 border border-slate-200 rounded-md bg-white text-slate-700 outline-none focus:border-slate-400"
                  >
                    <option value="ALL">Tất cả ngân hàng ({questions.length} câu)</option>
                    {groupedQuestions.map((g) => (
                      <option key={g.bankId} value={g.bankId}>
                        {g.bankName} ({g.questions.length} câu)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer underline ml-1"
                onClick={() =>
                  setSelectedQuestions(selectedQuestions.length === questions.length ? [] : questions.map((q) => q.id))
                }
              >
                {selectedQuestions.length === questions.length ? t('sess_deselect_all') : t('sess_select_all')}
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg p-2.5 space-y-3 bg-slate-50/80">
            {questions.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">{t('sess_no_questions')}</p>
            )}

            {displayGroups.map((g) => {
              const gSelectedCount = g.questions.filter((q) => selectedQuestions.includes(q.id)).length;
              const isAllInGroupSelected = gSelectedCount === g.questions.length && g.questions.length > 0;

              return (
                <div
                  key={g.bankId}
                  className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-2xs"
                >
                  {/* Tiêu đề phân nhóm ngân hàng đề */}
                  <div className="bg-slate-100/90 px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs">📁</span>
                      <span className="font-semibold text-xs text-slate-800 truncate">{g.bankName}</span>
                      {g.subject && (
                        <span className="text-[11px] text-slate-500 hidden sm:inline truncate">
                          • Môn: {g.subject}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded">
                        {gSelectedCount}/{g.questions.length} câu
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const gIds = g.questions.map((q) => q.id);
                        if (isAllInGroupSelected) {
                          setSelectedQuestions((prev) => prev.filter((id) => !gIds.includes(id)));
                        } else {
                          setSelectedQuestions((prev) => Array.from(new Set([...prev, ...gIds])));
                        }
                      }}
                      className="text-[11px] font-medium text-slate-700 hover:text-slate-900 cursor-pointer bg-white px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 transition"
                    >
                      {isAllInGroupSelected ? 'Bỏ chọn ngân hàng này' : 'Chọn cả ngân hàng'}
                    </button>
                  </div>

                  {/* Danh sách câu hỏi trong ngân hàng hiển thị theo thứ tự 1, 2, 3 */}
                  <div className="divide-y divide-slate-100">
                    {g.questions.map((q, idx) => (
                      <label
                        key={q.id}
                        className="flex items-start space-x-2 text-xs text-slate-700 cursor-pointer p-2 hover:bg-slate-50/80 transition"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded text-slate-800 cursor-pointer"
                          checked={selectedQuestions.includes(q.id)}
                          onChange={(e) => toggle(selectedQuestions, setSelectedQuestions, q.id, e.target.checked)}
                        />
                        <span className="flex-1 min-w-0 leading-relaxed">
                          <span className="font-semibold text-slate-900 mr-1.5 shrink-0">
                            Câu {idx + 1}:
                          </span>
                          <span className="text-slate-800">{q.content}</span>
                          <span className="text-slate-400 text-[11px] ml-1.5 whitespace-nowrap">
                            ({q.score} {t('exam_points_unit')})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-medium text-slate-700">
              {t('sess_select_candidates')} ({selectedCandidates.length}/{candidates.length}) *
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
              {selectedCandidates.length === candidates.length ? t('sess_deselect_all') : t('sess_select_all')}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2.5 space-y-1.5 bg-slate-50">
            {candidates.length === 0 && (
              <p className="text-xs text-slate-400 py-3 text-center">{t('sess_no_candidates')}</p>
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
            {submitting ? t('sess_submitting') : t('sess_create_btn')}
          </button>
        </div>
      </div>

      {/* Danh sách ca thi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {t('sess_list_title')} ({sessions.length})
          </h3>
          {loading && <span className="text-xs text-slate-400">{t('loading')}</span>}
        </div>

        {sessions.length === 0 && !loading && (
          <p className="text-xs text-slate-400 py-6 text-center">{t('sess_empty_list')}</p>
        )}

        <div className="space-y-3">
          {sessions.map((s) => {
            const currentStatus = resolveSessionStatus(s.status, s.startTime, s.endTime);
            const statusStyle = STATUS_STYLES[currentStatus] || STATUS_STYLES.SCHEDULED;
            const statusLabelKey = STATUS_KEYS[currentStatus] || 'sess_status_scheduled';
            const examUrl = `${window.location.origin}/?exam=${s.id}`;

            return (
              <div key={s.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 hover:border-slate-300 transition">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <span className="text-xs font-mono font-medium text-slate-500 mr-2">#{s.id}</span>
                    <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">{t('sess_lifecycle')}</span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border ${statusStyle}`}
                    >
                      {t(statusLabelKey)}
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
                  <span>{s.questionIds?.length || 0} {t('sess_questions_unit')}</span>
                  <span>{s.candidateEmails?.length || 0} {t('sess_candidates_unit')}</span>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                    <span>{t('sess_candidates_joined')}</span>
                    <span className="text-[10px] text-slate-400">
                      ({s.candidateEmails?.length || 0} {t('sess_candidates_unit')})
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
                    <span className="text-xs text-slate-500 mr-1">{t('sess_status_label')}</span>
                    {currentStatus !== 'RUNNING' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'RUNNING')}
                        disabled={updatingId === s.id}
                        className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition cursor-pointer"
                      >
                        {t('sess_start_btn')}
                      </button>
                    )}
                    {currentStatus !== 'SCHEDULED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'SCHEDULED')}
                        disabled={updatingId === s.id}
                        className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300 transition cursor-pointer"
                      >
                        {t('sess_pause_btn')}
                      </button>
                    )}
                    {currentStatus !== 'CLOSED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'CLOSED')}
                        disabled={updatingId === s.id}
                        className="px-2 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-700 transition cursor-pointer"
                      >
                        {t('sess_end_btn')}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingResultsSessionId(s.id)}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 transition cursor-pointer"
                    >
                      {t('view_results')}
                    </button>

                    <button
                      onClick={() => handleSendReportSNS(s.id)}
                      disabled={sendingReportId === s.id}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 transition cursor-pointer disabled:text-slate-400"
                      title={t('sess_send_sns') || "Gửi báo cáo bảng điểm qua email"}
                    >
                      {sendingReportId === s.id ? t('sess_sending_sns') : t('sess_send_sns')}
                    </button>
                    
                    {onOpenExam && (
                      <button
                        onClick={() => onOpenExam(s.id)}
                        className="px-2.5 py-1 bg-slate-900 text-white text-xs rounded hover:bg-slate-800 transition cursor-pointer"
                      >
                        {t('enter_exam')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(examUrl);
                        alert(`${t('sess_copied_link')}\n${examUrl}`);
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50 cursor-pointer"
                    >
                      {t('sess_copy_link')}
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
