import { useState, useEffect } from 'react';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export default function SessionResultsModal({ isOpen, onClose, sessionId }: ResultModalProps) {
  // MOCK DATA: Đang chờ backend viết xong API, tạm thời dùng mock data
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    
    // Giả lập thời gian gọi API
    setTimeout(() => {
      setResults([
        { studentCode: 'B21DCCN001', name: 'Phạm Tuấn Phong', score: 80, maxScore: 100, submittedAt: new Date().toISOString() },
        { studentCode: 'B21DCCN002', name: 'Trần Đức Mạnh', score: 95, maxScore: 100, submittedAt: new Date(Date.now() - 300000).toISOString() },
      ]);
      setLoading(false);
    }, 1000);
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              📊 Bảng Điểm Ca Thi
            </h2>
            <p className="text-xs font-mono text-blue-600 mt-1">Mã ca thi: #{sessionId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition cursor-pointer">
            ✕
          </button>
        </div>
        
        {/* Nội dung bảng điểm */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500">Đang tải bảng điểm từ DynamoDB...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="p-3 border-b">Mã SV</th>
                  <th className="p-3 border-b">Họ Tên</th>
                  <th className="p-3 border-b">Điểm Số</th>
                  <th className="p-3 border-b text-right">Thời gian nộp bài</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 italic">Chưa có thí sinh nào nộp bài.</td>
                  </tr>
                ) : (
                  results.map((res, i) => (
                    <tr key={i} className="hover:bg-slate-50 border-b last:border-0 transition">
                      <td className="p-3 font-mono text-xs">{res.studentCode}</td>
                      <td className="p-3 font-semibold">{res.name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${res.score >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {res.score} / {res.maxScore}
                        </span>
                      </td>
                      <td className="p-3 text-right text-xs text-slate-500">
                        {new Date(res.submittedAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 cursor-pointer">
            Đóng
          </button>
          <button disabled={loading || results.length === 0} className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:bg-slate-300 transition shadow cursor-pointer">
            📥 Tải bảng điểm (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}