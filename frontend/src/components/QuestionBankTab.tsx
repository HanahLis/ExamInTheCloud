import { useRef, useState, type FormEvent } from 'react';
import { uploadQuestionImage } from '../services/s3Service';
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  type Question,
  type Difficulty,
} from '../services/apiService';

const LABELS = ['A', 'B', 'C', 'D'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

interface Props {
  questions: Question[];
  onRefresh: () => void | Promise<void>;
}

export const QuestionBankTab = ({ questions, onRefresh }: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [score, setScore] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setEditingId(null);
    setContent('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setScore(1);
    setDifficulty('EASY');
    setFile(null);
    setExistingImage('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setContent(q.content);
    setOptions([0, 1, 2, 3].map((i) => q.options[i] ?? ''));
    setCorrectIndex(q.correctIndex);
    setScore(q.score);
    setDifficulty(q.difficulty);
    setFile(null);
    setExistingImage(q.imageUrl ?? '');
    if (fileInput.current) fileInput.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (options.some((o) => !o.trim())) {
      return alert('Vui lòng nhập đủ 4 đáp án A, B, C, D.');
    }
    setLoading(true);
    try {
      let imageUrl = existingImage;
      if (file) imageUrl = await uploadQuestionImage(file);

      const payload = {
        content: content.trim(),
        options: options.map((o) => o.trim()),
        correctIndex,
        score,
        difficulty,
        imageUrl,
      };

      if (editingId) await updateQuestion(editingId, payload);
      else await createQuestion(payload);

      resetForm();
      await onRefresh();
    } catch (err) {
      alert('Lỗi lưu câu hỏi: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (q: Question) => {
    if (!confirm(`Xóa câu hỏi "${q.content}"?`)) return;
    try {
      await deleteQuestion(q.id);
      if (editingId === q.id) resetForm();
      await onRefresh();
    } catch (err) {
      alert('Lỗi xóa câu hỏi: ' + err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form thêm / sửa */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">
          {editingId ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới vào ngân hàng'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nội dung câu hỏi</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
              placeholder="Nhập nội dung câu hỏi..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Các đáp án (chọn nút tròn để đánh dấu đáp án đúng)
            </label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    aria-label={`Đáp án ${LABELS[i]} là đáp án đúng`}
                  />
                  <span className="w-5 font-semibold text-slate-600">{LABELS[i]}</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                    }
                    placeholder={`Nội dung đáp án ${LABELS[i]}`}
                    className="flex-1 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Độ khó</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HARD">Khó</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Điểm</label>
              <input
                type="number"
                min={0}
                step={0.25}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Ảnh đính kèm (S3)</label>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          {existingImage && !file && (
            <div className="flex items-center gap-3">
              <img src={existingImage} alt="Ảnh hiện tại" className="h-16 rounded border" />
              <button
                type="button"
                onClick={() => setExistingImage('')}
                className="text-sm text-red-600 hover:underline"
              >
                Bỏ ảnh
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Lưu câu hỏi'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 border rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Hủy sửa
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Danh sách */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">
          Danh sách câu hỏi hiện có ({questions.length})
        </h3>
        {questions.length === 0 && (
          <p className="text-sm text-slate-400">Chưa có câu hỏi nào. Thêm câu hỏi đầu tiên ở form phía trên.</p>
        )}
        <div className="divide-y divide-slate-100">
          {questions.map((q) => (
            <div key={q.id} className="py-4 flex justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{q.content}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options.map((opt, i) => (
                    <li
                      key={i}
                      className={i === q.correctIndex ? 'text-green-700 font-semibold' : 'text-slate-600'}
                    >
                      {LABELS[i]}. {opt}
                      {i === q.correctIndex && ' (đúng)'}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                    {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                    {q.score} điểm
                  </span>
                  {q.imageUrl && (
                    <a href={q.imageUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      Xem ảnh
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <button onClick={() => startEdit(q)} className="text-blue-600 hover:underline">
                  Sửa
                </button>
                <button onClick={() => handleDelete(q)} className="text-red-600 hover:underline">
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
