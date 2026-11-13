import { useState, useEffect, useMemo } from 'react';
import { fetchSessionResults, sendSessionReport, type CandidateSessionResult } from '../services/apiService';
import { useTranslation } from '../locales/i18nContext';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export default function SessionResultsModal({ isOpen, onClose, sessionId }: ResultModalProps) {
  const { t, lang } = useTranslation();
  const dateLocale = lang === 'en' ? 'en-US' : lang === 'de' ? 'de-DE' : lang === 'la' ? 'lo-LA' : 'vi-VN';
  const [results, setResults] = useState<CandidateSessionResult[]>([]);
  const [sessionName, setSessionName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);
    setReportFeedback(null);

    fetchSessionResults(sessionId)
      .then((data) => {
        if (!isMounted) return;
        setResults(data.results || []);
        if (data.sessionName) setSessionName(data.sessionName);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Lỗi tải bảng điểm ca thi:', err);
        setError(err?.response?.data?.error || err?.message || t('error_load_scores'));
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, sessionId, t]);

  // Thống kê nhanh (quy đổi về thang điểm 10)
  const stats = useMemo(() => {
    if (results.length === 0) return { avg: 0, passRate: 0, highest: 0 };
    const totalScore = results.reduce((acc, r) => acc + (r.score || 0), 0);
    const totalMax = results.reduce((acc, r) => acc + (r.maxScore || 1), 0);
    const avg = Number(((totalScore / totalMax) * 10).toFixed(1));
    const passCount = results.filter((r) => r.score >= (r.maxScore / 2)).length;
    const passRate = Math.round((passCount / results.length) * 100);
    const highest = Number(
      Math.max(...results.map((r) => ((r.score || 0) / (r.maxScore || 1)) * 10)).toFixed(1)
    );
    return { avg, passRate, highest };
  }, [results]);

  const handleExportCSV = () => {
    if (results.length === 0) return;
    const headers = [
      t('csv_header_student_id'),
      t('csv_header_full_name'),
      t('csv_header_email'),
      t('csv_header_score'),
      t('csv_header_max_score'),
      t('csv_header_correct_count'),
      t('csv_header_total_questions'),
      t('csv_header_submitted_at'),
      t('csv_header_status'),
    ];
    const rows = results.map((r) => [
      `"${r.studentCode || ''}"`,
      `"${r.name || ''}"`,
      `"${r.email || r.candidateEmail || ''}"`,
      r.score,
      r.maxScore,
      r.correctCount,
      r.totalQuestions,
      `"${r.submittedAt ? new Date(r.submittedAt).toLocaleString(dateLocale) : ''}"`,
      `"${r.status || 'COMPLETED'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_Diem_CaThi_${sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendSNSReport = async () => {
    if (!sessionId || sendingReport) return;
    try {
      setSendingReport(true);
      setReportFeedback(null);
      await sendSessionReport(sessionId);
      setReportFeedback(t('report_sent_success'));
      setTimeout(() => setReportFeedback(null), 6000);
    } catch (err: any) {
      console.error('Lỗi gửi email báo cáo:', err);
      alert(err?.response?.data?.error || err?.message || t('alert_send_report_error'));
    } finally {
      setSendingReport(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                {t('res_modal_title')}{' '}
                {sessionName && (
                  <span className="font-medium text-slate-500">· {sessionName}</span>
                )}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  #{sessionId}
                </span>
                {!loading && (
                  <span className="text-xs text-slate-500">
                    · {results.length} {t('results_completed_badge')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            title={t('close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Thông báo gửi SNS thành công */}
        {reportFeedback && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {reportFeedback}
            </span>
            <button
              onClick={() => setReportFeedback(null)}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Thống kê nhanh */}
        {!loading && !error && results.length > 0 && (
          <div className="grid grid-cols-3 gap-3 p-5 pb-0">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block">{t('results_kpi_avg')}</span>
              <p className="text-xl font-semibold text-indigo-600 mt-1">{stats.avg} <span className="text-xs font-normal text-slate-400">/ 10</span></p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block">{t('results_kpi_pass')}</span>
              <p className="text-xl font-semibold text-slate-900 mt-1">{stats.passRate}%</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block">{t('results_kpi_highest')}</span>
              <p className="text-xl font-semibold text-slate-900 mt-1">{stats.highest} <span className="text-xs font-normal text-slate-400">/ 10</span></p>
            </div>
          </div>
        )}

        {/* Nội dung bảng điểm */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2">
              <span className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></span>
              <p className="text-xs text-slate-500 font-medium">{t('loading')}</p>
            </div>
          ) : error ? (
            <div className="p-5 text-center text-rose-700 bg-rose-50 rounded-2xl border border-rose-200 text-xs font-medium">
              <p>{error}</p>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="p-3 font-semibold">{t('cand_table_code')}</th>
                    <th className="p-3 font-semibold">{t('cand_table_name')}</th>
                    <th className="p-3 font-semibold">{t('cand_table_email')}</th>
                    <th className="p-3 font-semibold text-center">{t('res_score')}</th>
                    <th className="p-3 font-semibold text-center">{t('res_correct_count')}</th>
                    <th className="p-3 font-semibold text-right">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 divide-y divide-slate-100">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        {t('res_empty')}
                      </td>
                    </tr>
                  ) : (
                    results.map((res, i) => (
                      <tr key={res.id || i} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-semibold text-indigo-700">{res.studentCode || '—'}</td>
                        <td className="p-3 font-bold text-slate-900">{res.name}</td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">{res.email || res.candidateEmail}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-block border ${
                              res.score >= (res.maxScore / 2)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {res.score} / {res.maxScore}
                          </span>
                        </td>
                        <td className="p-3 text-center text-slate-600 font-medium">
                          {res.correctCount} / {res.totalQuestions}
                        </td>
                        <td className="p-3 text-right text-slate-500 font-mono text-[11px]">
                          {res.submittedAt ? new Date(res.submittedAt).toLocaleTimeString(dateLocale) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-wrap justify-between items-center gap-3">
          <div>
            <button
              onClick={handleSendSNSReport}
              disabled={loading || sendingReport || results.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
              title={t('sess_send_sns')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{sendingReport ? t('loading') : t('sess_send_sns')}</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              {t('close')}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || results.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{t('download_csv')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
