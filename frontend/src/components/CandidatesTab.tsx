import { useRef, useState, type FormEvent } from 'react';
import { uploadFaceImage } from '../services/s3Service';

export interface Candidate {
  studentCode: string;
  name: string;
  email: string;
  className: string;
  faceImageUrl: string;
}

interface Props {
  candidates: Candidate[];
  onAddCandidate: (c: Candidate) => void;
  onRemoveCandidate: (email: string) => void;
}

export const CandidatesTab = ({ candidates, onAddCandidate, onRemoveCandidate }: Props) => {
  const [studentCode, setStudentCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [className, setClassName] = useState('');
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleAddCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!faceImage) return alert('Vui lòng chọn ảnh khuôn mặt mẫu của thí sinh!');
    if (candidates.some((c) => c.email === email.trim())) {
      return alert('Email này đã có trong danh sách thí sinh.');
    }

    setLoading(true);
    try {
      // Upload ảnh khuôn mặt lên S3 (thư mục faces/)
      const faceImageUrl = await uploadFaceImage(faceImage);
      onAddCandidate({
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
    } catch (err) {
      alert('Lỗi upload ảnh khuôn mặt: ' + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">
          Thêm thí sinh và ảnh khuôn mặt mẫu (cho Rekognition)
        </h3>
        <form onSubmit={handleAddCandidate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Mã sinh viên"
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
            className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <input
            type="text"
            placeholder="Họ và tên"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <input
            type="text"
            placeholder="Lớp / đơn vị"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={(e) => setFaceImage(e.target.files?.[0] || null)}
            className="md:col-span-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
          >
            {loading ? 'Đang tải ảnh khuôn mặt lên...' : 'Thêm thí sinh'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Danh sách thí sinh ({candidates.length})</h3>
        {candidates.length === 0 && (
          <p className="text-sm text-slate-400">Chưa có thí sinh. Thêm thí sinh đầu tiên ở form phía trên.</p>
        )}
        <div className="divide-y divide-slate-100">
          {candidates.map((c) => (
            <div key={c.email} className="py-3 flex items-center gap-4">
              <img
                src={c.faceImageUrl}
                alt={`Ảnh khuôn mặt ${c.name}`}
                className="h-14 w-14 rounded-full object-cover border bg-slate-100"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-800">{c.name}</p>
                <p className="text-sm text-slate-500">
                  {c.studentCode} | {c.email}
                  {c.className && ` | ${c.className}`}
                </p>
              </div>
              <button onClick={() => onRemoveCandidate(c.email)} className="text-sm text-red-600 hover:underline">
                Xóa
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
