import { useState, useEffect } from 'react';
import { fetchSessionResults, sendSessionReport, type CandidateSessionResult } from '../services/apiService';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export default function SessionResultsModal({ isOpen, onClose, sessionId }: ResultModalProps) {
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
        setError(err?.response?.data?.error || err?.message || 'Không thể tải bảng điểm.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, sessionId]);

  const handleExportCSV = () => {
    if (results.length === 0) return;
    const headers = ['Mã SV', 'Họ Tên', 'Email', 'Điểm Số', 'Điểm Tối Đa', 'Số Câu Đúng', 'Tổng Số Câu', 'Thời Gian Nộp', 'Trạng Thái'];
    const rows = results.map((r) => [
      `"${r.studentCode || ''}"`,
      `"${r.name || ''}"`,
      `"${r.email || r.candidateEmail || ''}"`,
      r.score,
      r.maxScore,
      r.correctCount,
      r.totalQuestions,
      `"${r.submittedAt ? new Date(r.submittedAt).toLocaleString('vi-VN') : ''}"`,
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
      const res = await sendSessionReport(sessionId);
      setReportFeedback(res.message || 'Đã gửi email báo cáo tổng hợp ca thi qua Amazon SNS thành công!');
      setTimeout(() => setReportFeedback(null), 6000);
    } catch (err: any) {
      console.error('Lỗi gửi báo cáo qua SNS:', err);
      alert(err?.response?.data?.error || err?.message || 'Lỗi gửi email báo cáo qua SNS.');
    } finally {
      setSendingReport(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-lg w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Bảng điểm ca thi {sessionName && <span className="font-normal text-slate-600">- {sessionName}</span>}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono text-slate-500">
                Mã ca thi: #{sessionId}
              </span>
              {!loading && (
                <span className="text-xs text-slate-500">
                  • Tổng số bài thi: {results.length}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 text-sm cursor-pointer"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Thông báo gửi SNS thành công */}
        {reportFeedback && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              ✅ {reportFeedback}
            </span>
            <button
              onClick={() => setReportFeedback(null)}
              className="text-emerald-600 hover:text-emerald-800 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Nội dung bảng điểm */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2">
              <p className="text-xs text-slate-500">Đang tải bảng điểm...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-rose-600 bg-rose-50 rounded border border-rose-200 text-xs">
              <p>{error}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse border border-slate-200 rounded text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="p-2.5 border-b border-slate-200">Mã SV</th>
                  <th className="p-2.5 border-b border-slate-200">Họ tên</th>
                  <th className="p-2.5 border-b border-slate-200">Email</th>
                  <th className="p-2.5 border-b border-slate-200 text-center">Điểm</th>
                  <th className="p-2.5 border-b border-slate-200 text-center">Số câu đúng</th>
                  <th className="p-2.5 border-b border-slate-200 text-right">Thời gian nộp</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-100">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                      Chưa có thí sinh nào nộp bài trong ca thi này.
                    </td>
                  </tr>
                ) : (
                  results.map((res, i) => (
                    <tr key={res.id || i} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-mono text-slate-600">{res.studentCode || '—'}</td>
                      <td className="p-2.5 font-medium text-slate-900">{res.name}</td>
                      <td className="p-2.5 text-slate-500 font-mono">{res.email || res.candidateEmail}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium inline-block ${
                            res.score >= (res.maxScore / 2)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {res.score} / {res.maxScore}
                        </span>
                      </td>
                      <td className="p-2.5 text-center text-slate-600">
                        {res.correctCount} / {res.totalQuestions}
                      </td>
                      <td className="p-2.5 text-right text-slate-500 font-mono">
                        {res.submittedAt ? new Date(res.submittedAt).toLocaleString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <button
              onClick={handleSendSNSReport}
              disabled={loading || sendingReport || results.length === 0}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Gửi email bảng điểm chi tiết tới Giảng viên qua Amazon SNS"
            >
              {sendingReport ? '⏳ Đang gửi qua SNS...' : '📧 Gửi báo cáo Email (Amazon SNS)'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs rounded hover:bg-slate-50 cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || results.length === 0}
              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Xuất file CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
