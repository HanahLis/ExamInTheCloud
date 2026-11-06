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
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
  RUNNING: 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse',
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
  const [showCreateForm, setShowCreateForm] = useState(false);
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
            (bId === 'unassigned' ? `${t('sess_general_questions')} (${t('sess_no_bank')})` : `${t('sess_bank_label')}: ${bId}`),
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
      setShowCreateForm(false);
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
    <div className="space-y-5">
      {/* Top Bar Quản lý Ca thi */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {t('sess_list_title')} ({sessions.length})
            </h3>
            <p className="text-xs text-slate-500">
              Lập lịch, cấu hình đề thi, phân quyền danh sách thí sinh và giám sát thời gian thực
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-200/60 transition cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{t('refresh')}</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs shadow-indigo-200 transition cursor-pointer flex items-center gap-1.5 active:scale-[0.99]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={showCreateForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
            <span>{showCreateForm ? 'Đóng biểu mẫu' : t('sess_create_new')}</span>
          </button>
        </div>
      </div>

      {/* Form tạo ca thi mới (Pastel Soft Panel) */}
      {showCreateForm && (
        <div className="bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-sky-50/30 p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Tạo Ca Thi Mới</h4>
              <p className="text-xs text-slate-500">Cấu hình tên ca thi, thời gian mở - đóng và chọn câu hỏi từ ngân hàng</p>
            </div>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('sess_name_label')} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('sess_placeholder_name')}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('sess_start_time_label')} *</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('sess_end_time_label')} *</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* Chọn câu hỏi theo ngân hàng */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>{t('sess_select_questions')}</span>
                  <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {selectedQuestions.length}/{questions.length} {t('sess_questions_unit')} đã chọn
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {groupedQuestions.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-medium">Lọc:</span>
                      <select
                        value={selectedBankFilter}
                        onChange={(e) => setSelectedBankFilter(e.target.value)}
                        className="text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none focus:border-indigo-400"
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
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline ml-1"
                    onClick={() =>
                      setSelectedQuestions(selectedQuestions.length === questions.length ? [] : questions.map((q) => q.id))
                    }
                  >
                    {selectedQuestions.length === questions.length ? t('sess_deselect_all') : t('sess_select_all')}
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto border border-slate-200/80 rounded-2xl p-3 space-y-3 bg-white/70">
                {questions.length === 0 && (
                  <p className="text-xs text-slate-400 py-6 text-center">{t('sess_no_questions')}</p>
                )}

                {displayGroups.map((g) => {
                  const gSelectedCount = g.questions.filter((q) => selectedQuestions.includes(q.id)).length;
                  const isAllInGroupSelected = gSelectedCount === g.questions.length && g.questions.length > 0;

                  return (
                    <div
                      key={g.bankId}
                      className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs"
                    >
                      <div className="bg-slate-50/90 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span className="font-bold text-xs text-slate-800 truncate">{g.bankName}</span>
                          {g.subject && (
                            <span className="text-[11px] text-slate-500 hidden sm:inline truncate">
                              • Môn: {g.subject}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
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
                          className="text-[11px] font-semibold text-slate-700 hover:text-indigo-600 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                        >
                          {isAllInGroupSelected ? 'Bỏ chọn ngân hàng này' : 'Chọn cả ngân hàng'}
                        </button>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {g.questions.map((q, idx) => (
                          <label
                            key={q.id}
                            className="flex items-start space-x-2 text-xs text-slate-700 cursor-pointer p-2.5 hover:bg-indigo-50/30 transition"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded text-indigo-600 cursor-pointer"
                              checked={selectedQuestions.includes(q.id)}
                              onChange={(e) => toggle(selectedQuestions, setSelectedQuestions, q.id, e.target.checked)}
                            />
                            <span className="flex-1 min-w-0 leading-relaxed">
                              <span className="font-bold text-slate-900 mr-1.5 shrink-0">
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

            {/* Chọn thí sinh */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>{t('sess_select_candidates')}</span>
                  <span className="text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                    {selectedCandidates.length}/{candidates.length} thí sinh
                  </span>
                </label>
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                  onClick={() =>
                    setSelectedCandidates(
                      selectedCandidates.length === candidates.length ? [] : candidates.map((c) => c.email)
                    )
                  }
                >
                  {selectedCandidates.length === candidates.length ? t('sess_deselect_all') : t('sess_select_all')}
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto border border-slate-200/80 rounded-2xl p-2.5 space-y-1.5 bg-white/70">
                {candidates.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">{t('sess_no_candidates')}</p>
                )}
                {candidates.map((c) => (
                  <label
                    key={c.email}
                    className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer p-2 hover:bg-sky-50/50 rounded-xl transition"
                  >
                    <input
                      type="checkbox"
                      className="rounded text-sky-600 cursor-pointer"
                      checked={selectedCandidates.includes(c.email)}
                      onChange={(e) => toggle(selectedCandidates, setSelectedCandidates, c.email, e.target.checked)}
                    />
                    <span className="flex-1">
                      <span className="font-semibold text-slate-900">{c.name}</span>{' '}
                      <span className="font-mono text-indigo-700">({c.studentCode})</span> —{' '}
                      <span className="font-mono text-slate-500">{c.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCreateSession}
                disabled={submitting}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl text-xs shadow-xs shadow-indigo-200 transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? t('sess_submitting') : t('sess_create_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danh sách Ca thi (Pastel Cards) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        {loading && (
          <div className="py-8 text-center text-xs text-slate-400">
            <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mr-2 align-middle"></span>
            Đang tải danh sách ca thi...
          </div>
        )}

        {sessions.length === 0 && !loading && (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-600">{t('sess_empty_list')}</p>
            <p className="text-[11px] text-slate-400">Nhấn "Tạo ca thi mới" ở trên để khởi tạo phòng thi đầu tiên.</p>
          </div>
        )}

        <div className="space-y-4">
          {sessions.map((s) => {
            const currentStatus = resolveSessionStatus(s.status, s.startTime, s.endTime);
            const statusStyle = STATUS_STYLES[currentStatus] || STATUS_STYLES.SCHEDULED;
            const statusLabelKey = STATUS_KEYS[currentStatus] || 'sess_status_scheduled';
            const examUrl = `${window.location.origin}/?exam=${s.id}`;

            return (
              <div
                key={s.id}
                className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-3.5 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                      #{s.id}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">Trạng thái:</span>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusStyle}`}>
                      {t(statusLabelKey)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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
                  </div>

                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>{s.questionIds?.length || 0} {t('sess_questions_unit')}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{s.candidateEmails?.length || 0} {t('sess_candidates_unit')}</span>
                  </div>
                </div>

                {/* Danh sách Thí sinh tham gia */}
                <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/60 space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-slate-600 font-semibold">
                    <span>{t('sess_candidates_joined')}</span>
                    <span className="text-[10px] text-slate-400">
                      ({s.candidateEmails?.length || 0} {t('sess_candidates_unit')})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.candidateEmails?.map((email) => {
                      const c = candidates.find((item) => item.email.toLowerCase() === email.toLowerCase());
                      return (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-slate-700 rounded-lg text-[11px] border border-slate-200/80 shadow-2xs font-medium"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
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
                            className="inline-flex items-center px-2 py-0.5 bg-white border border-dashed border-slate-300 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-lg text-[11px] font-medium transition cursor-pointer"
                            title="Thêm thí sinh vào ca thi"
                          >
                            + {c.name}
                          </button>
                        ))}
                  </div>
                </div>

                {/* Các thao tác & Nút chuyển trạng thái */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  {/* Quản lý trạng thái */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-1 font-medium">{t('sess_status_label')}:</span>
                    {currentStatus !== 'RUNNING' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'RUNNING')}
                        disabled={updatingId === s.id}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        {t('sess_start_btn')}
                      </button>
                    )}
                    {currentStatus !== 'SCHEDULED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'SCHEDULED')}
                        disabled={updatingId === s.id}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        {t('sess_pause_btn')}
                      </button>
                    )}
                    {currentStatus !== 'CLOSED' && (
                      <button
                        onClick={() => handleStatusChange(s.id, 'CLOSED')}
                        disabled={updatingId === s.id}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        {t('sess_end_btn')}
                      </button>
                    )}
                  </div>

                  {/* Nút tác vụ */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingResultsSessionId(s.id)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>{t('view_results')}</span>
                    </button>

                    <button
                      onClick={() => handleSendReportSNS(s.id)}
                      disabled={sendingReportId === s.id}
                      className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      title={t('sess_send_sns') || "Gửi báo cáo bảng điểm qua email"}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{sendingReportId === s.id ? t('sess_sending_sns') : t('sess_send_sns')}</span>
                    </button>

                    {onOpenExam && (
                      <button
                        onClick={() => onOpenExam(s.id)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs shadow-emerald-200 flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span>{t('enter_exam')}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(examUrl);
                        alert(`${t('sess_copied_link')}\n${examUrl}`);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium rounded-xl transition cursor-pointer flex items-center gap-1"
                      title="Sao chép liên kết phòng thi"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>{t('sess_copy_link')}</span>
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
