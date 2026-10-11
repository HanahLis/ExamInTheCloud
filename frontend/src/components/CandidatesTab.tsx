import { useRef, useState, type FormEvent } from 'react';
import { uploadFaceImage } from '../services/s3Service';

import type { Candidate } from '../services/apiService';

export type { Candidate };

interface Props {
  candidates: Candidate[];
  loading?: boolean;
  onAddCandidate: (c: Candidate) => Promise<void> | void;
  onRemoveCandidate: (email: string) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
}

export const CandidatesTab = ({
  candidates,
  loading = false,
  onAddCandidate,
  onRemoveCandidate,
  onRefresh,
}: Props) => {
  const [studentCode, setStudentCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [className, setClassName] = useState('');
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleAddCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!faceImage) return alert('Vui lòng chọn ảnh khuôn mặt mẫu của thí sinh!');
    if (candidates.some((c) => c.email.toLowerCase() === email.trim().toLowerCase())) {
      return alert('Email này đã tồn tại trong danh sách thí sinh.');
    }

    setSubmitting(true);
    try {
      // 1. Upload ảnh khuôn mặt lên S3 (prefix faces/)
      const faceImageUrl = await uploadFaceImage(faceImage);

      // 2. Lưu thông tin thí sinh vào DynamoDB qua API Gateway
      await onAddCandidate({
        studentCode: studentCode.trim(),
        name: name.trim(),
        email: email.trim(),
        className: className.trim(),
        faceImageUrl,
      });

      setStudentCode('');
      setName('');
      setEmail('');
      setClassName('');
      setFaceImage(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err: any) {
      alert('Lỗi khi thêm thí sinh: ' + (err?.response?.data?.error || err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (cEmail: string, cName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa thí sinh "${cName}" (${cEmail}) khỏi hệ thống?`)) return;
    setDeletingEmail(cEmail);
    try {
      await onRemoveCandidate(cEmail);
    } catch (err: any) {
      alert('Lỗi xóa thí sinh: ' + (err?.response?.data?.error || err?.message || err));
    } finally {
      setDeletingEmail(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form thêm thí sinh */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Thêm thí sinh & Ảnh khuôn mặt mẫu (Amazon Rekognition)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Ảnh tải lên sẽ được lưu vào S3 Bucket (`faces/`) và dùng để đối chiếu khi thí sinh điểm danh vào ca thi.
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              🔄 Tải lại dữ liệu
            </button>
          )}
        </div>

        <form onSubmit={handleAddCandidate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mã sinh viên *</label>
            <input
              type="text"
              placeholder="VD: B21DCCN001"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên *</label>
            <input
              type="text"
              placeholder="VD: Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email đăng nhập Cognito *</label>
            <input
              type="email"
              placeholder="VD: sinhvien@example.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Lớp / Khoa / Đơn vị</label>
            <input
              type="text"
              placeholder="VD: D21CQCN01-B"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ảnh chân dung mẫu (Chính diện, rõ mặt để Rekognition so khớp) *
            </label>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={(e) => setFaceImage(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="md:col-span-2 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition shadow-sm"
          >
            {submitting ? 'Đang lưu vào DynamoDB & tải ảnh S3...' : '+ Thêm thí sinh vào hệ thống'}
          </button>
        </form>
      </div>

      {/* Danh sách thí sinh */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            Danh sách thí sinh ({candidates.length})
          </h3>
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
        </div>

        {candidates.length === 0 && !loading && (
          <p className="text-sm text-slate-400 py-4 text-center">
            Chưa có thí sinh nào trong cơ sở dữ liệu DynamoDB. Hãy thêm thí sinh đầu tiên ở trên.
          </p>
        )}

        <div className="divide-y divide-slate-100">
          {candidates.map((c) => (
            <div key={c.email} className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={c.faceImageUrl}
                  alt={`Ảnh khuôn mặt ${c.name}`}
                  className="h-12 w-12 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                  onError={(e) => {
                    // Fallback avatar nếu URL ảnh chưa tải được
                    (e.target as HTMLImageElement).src =
                      'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name) + '&background=0D8ABC&color=fff';
                  }}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    <span className="font-mono font-medium text-slate-700">{c.studentCode}</span>
                    {' • '}
                    <span>{c.email}</span>
                    {c.className && ` • ${c.className}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={c.faceImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Xem ảnh gốc
                </a>
                <button
                  onClick={() => handleRemove(c.email, c.name)}
                  disabled={deletingEmail === c.email}
                  className="text-xs text-red-600 hover:underline disabled:text-gray-400"
                >
                  {deletingEmail === c.email ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
