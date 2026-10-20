import { useState, useEffect } from 'react';
import { fetchSessionResults, type CandidateSessionResult } from '../services/apiService';

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

  useEffect(() => {
    if (!isOpen || !sessionId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              📊 Bảng Điểm Ca Thi {sessionName && <span className="text-base font-medium text-slate-600">- {sessionName}</span>}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Mã ca thi: #{sessionId}
              </span>
              {!loading && (
                <span className="text-xs text-slate-500">
                  Tổng số bài nộp: <strong>{results.length}</strong>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Nội dung bảng điểm */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500">Đang tải bảng điểm từ DynamoDB...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
              <p className="font-semibold">⚠️ {error}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600 font-bold">
                <tr>
                  <th className="p-3 border-b">Mã SV</th>
                  <th className="p-3 border-b">Họ Tên</th>
                  <th className="p-3 border-b">Email</th>
                  <th className="p-3 border-b text-center">Điểm Số</th>
                  <th className="p-3 border-b text-center">Đúng/Tổng</th>
                  <th className="p-3 border-b text-right">Thời gian nộp bài</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      Chưa có thí sinh nào nộp bài trong ca thi này.
                    </td>
                  </tr>
                ) : (
                  results.map((res, i) => (
                    <tr key={res.id || i} className="hover:bg-slate-50 border-b last:border-0 transition">
                      <td className="p-3 font-mono text-xs font-semibold text-blue-700">{res.studentCode || 'N/A'}</td>
                      <td className="p-3 font-semibold text-slate-900">{res.name}</td>
                      <td className="p-3 text-xs text-slate-500 font-mono">{res.email || res.candidateEmail}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${
                            res.score >= (res.maxScore / 2)
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-red-100 text-red-700 border border-red-300'
                          }`}
                        >
                          {res.score} / {res.maxScore}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs font-semibold text-slate-600">
                        {res.correctCount} / {res.totalQuestions}
                      </td>
                      <td className="p-3 text-right text-xs text-slate-500 font-mono">
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <span className="text-xs text-slate-500">
            * Dữ liệu được đồng bộ trực tiếp từ DynamoDB qua Lambda API
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || results.length === 0}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition shadow cursor-pointer flex items-center gap-1.5"
            >
              <span>📥</span>
              <span>Tải bảng điểm (CSV)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}