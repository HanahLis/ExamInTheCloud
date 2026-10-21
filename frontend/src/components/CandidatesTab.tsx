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
    if (!faceImage) return alert('Vui lòng chọn ảnh chân dung của thí sinh.');
    if (candidates.some((c) => c.email.toLowerCase() === email.trim().toLowerCase())) {
      return alert('Email này đã tồn tại trong danh sách thí sinh.');
    }

    setSubmitting(true);
    try {
      const faceImageUrl = await uploadFaceImage(faceImage);

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
    if (!confirm(`Bạn có chắc muốn xóa thí sinh "${cName}" khỏi danh sách?`)) return;
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
    <div className="space-y-4">
      {/* Form thêm thí sinh */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Thêm thí sinh
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ảnh chân dung được dùng để đối chiếu khi thí sinh điểm danh vào phòng thi.
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

        <form onSubmit={handleAddCandidate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mã sinh viên *</label>
            <input
              type="text"
              placeholder="Ví dụ: B21DCCN001"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Họ và tên *</label>
            <input
              type="text"
              placeholder="Ví dụ: Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email đăng nhập *</label>
            <input
              type="email"
              placeholder="Ví dụ: sinhvien@example.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lớp / Đơn vị</label>
            <input
              type="text"
              placeholder="Ví dụ: D21CQCN01-B"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-xs"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Ảnh chân dung mẫu (ảnh thẻ rõ mặt) *
            </label>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={(e) => setFaceImage(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              required
            />
          </div>

          <div className="md:col-span-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white font-medium rounded-md text-xs hover:bg-slate-800 disabled:bg-slate-400 transition cursor-pointer"
            >
              {submitting ? 'Đang lưu...' : 'Thêm thí sinh'}
            </button>
          </div>
        </form>
      </div>

      {/* Danh sách thí sinh */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Danh sách thí sinh ({candidates.length})
          </h3>
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
        </div>

        {candidates.length === 0 && !loading && (
          <p className="text-xs text-slate-400 py-6 text-center">
            Chưa có thí sinh nào trong danh sách.
          </p>
        )}

        <div className="divide-y divide-slate-100">
          {candidates.map((c) => (
            <div key={c.email} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={c.faceImageUrl}
                  alt={c.name}
                  className="h-10 w-10 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name) + '&background=e2e8f0&color=334155';
                  }}
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-xs truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    <span className="font-mono text-slate-600">{c.studentCode}</span>
                    {' • '}
                    <span>{c.email}</span>
                    {c.className && ` • ${c.className}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 text-xs">
                <a
                  href={c.faceImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 hover:text-slate-900 underline"
                >
                  Xem ảnh
                </a>
                <button
                  onClick={() => handleRemove(c.email, c.name)}
                  disabled={deletingEmail === c.email}
                  className="text-rose-600 hover:text-rose-800 cursor-pointer disabled:text-slate-300"
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
