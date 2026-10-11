import { useEffect, useRef, useState, type FormEvent } from 'react';
import { uploadQuestionImage } from '../services/s3Service';
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionBanks,
  createQuestionBank,
  type Question,
  type Difficulty,
  type QuestionType,
  type QuestionBank,
} from '../services/apiService';

const LABELS = ['A', 'B', 'C', 'D'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Trắc nghiệm 1 đáp án',
  MULTIPLE_CHOICE: 'Trắc nghiệm nhiều lựa chọn',
};

interface Props {
  questions: Question[];
  onRefresh: () => void | Promise<void>;
}

export const QuestionBankTab = ({ questions, onRefresh }: Props) => {
  // Question banks state
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);

  // New bank form
  const [newBankName, setNewBankName] = useState('');
  const [newBankSubject, setNewBankSubject] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');
  const [creatingBank, setCreatingBank] = useState(false);

  // Question form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bankId, setBankId] = useState<string>('bank-cloud-01');
  const [content, setContent] = useState('');
  const [type, setType] = useState<QuestionType>('SINGLE_CHOICE');
  const [subject, setSubject] = useState('Điện toán đám mây');
  const [topic, setTopic] = useState('AWS Serverless');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [score, setScore] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Tải danh sách ngân hàng câu hỏi
  const loadBanks = async () => {
    try {
      const list = await getQuestionBanks();
      setBanks(list);
      if (list.length > 0 && !bankId) {
        setBankId(list[0].id);
      }
    } catch (e) {
      console.error('Lỗi tải ngân hàng câu hỏi:', e);
    }
  };

  useEffect(() => {
    loadBanks();
  }, []);

  // Đổi ngân hàng trong form -> tự cập nhật gợi ý môn học
  const handleBankChange = (newBankId: string) => {
    setBankId(newBankId);
    const found = banks.find((b) => b.id === newBankId);
    if (found && found.subject) {
      setSubject(found.subject);
    }
  };

  const handleCreateBank = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return alert('Vui lòng nhập tên ngân hàng câu hỏi.');
    setCreatingBank(true);
    try {
      const created = await createQuestionBank({
        name: newBankName.trim(),
        subject: newBankSubject.trim() || 'Chung',
        description: newBankDesc.trim(),
      });
      await loadBanks();
      setBankId(created.id);
      setSubject(created.subject || 'Chung');
      setNewBankName('');
      setNewBankSubject('');
      setNewBankDesc('');
      setShowCreateBankModal(false);
      alert(`Đã tạo thành công ngân hàng câu hỏi: "${created.name}"`);
    } catch (err) {
      alert('Lỗi tạo ngân hàng câu hỏi: ' + err);
    } finally {
      setCreatingBank(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setContent('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setScore(1);
    setDifficulty('EASY');
    setType('SINGLE_CHOICE');
    setFile(null);
    setExistingImage('');
    setUploadStatus('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setBankId(q.bankId || (banks[0]?.id ?? 'bank-cloud-01'));
    setContent(q.content);
    setType(q.type || 'SINGLE_CHOICE');
    setSubject(q.subject || 'Điện toán đám mây');
    setTopic(q.topic || 'AWS Core Services');
    setOptions([0, 1, 2, 3].map((i) => q.options[i] ?? ''));
    setCorrectIndex(q.correctIndex ?? 0);
    setScore(q.score ?? 1);
    setDifficulty(q.difficulty ?? 'EASY');
    setFile(null);
    setExistingImage(q.imageUrl ?? '');
    setUploadStatus('');
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
      if (file) {
        setUploadStatus('Đang xin Presigned URL & upload S3...');
        imageUrl = await uploadQuestionImage(file);
        setUploadStatus('Upload S3 thành công!');
      }

      const correctAnswer = options[correctIndex]?.trim() || '';

      const payload = {
        bankId,
        content: content.trim(),
        type,
        options: options.map((o) => o.trim()),
        correctIndex,
        correctAnswer,
        score,
        subject: subject.trim(),
        topic: topic.trim(),
        difficulty,
        imageUrl,
      };

      if (editingId) {
        await updateQuestion(editingId, payload);
      } else {
        await createQuestion(payload);
      }

      resetForm();
      await onRefresh();
    } catch (err) {
      alert('Lỗi lưu câu hỏi: ' + err);
    } finally {
      setLoading(false);
      setUploadStatus('');
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

  // Filter questions theo ngân hàng đã chọn
  const filteredQuestions =
    selectedBankFilter === 'ALL'
      ? questions
      : questions.filter((q) => q.bankId === selectedBankFilter);

  return (
    <div className="space-y-6">
      {/* 1. THANH QUẢN LÝ NGÂN HÀNG CÂU HỎI (PHASE 1 SPEC) */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                📁 Quản lý Ngân hàng Câu hỏi
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Giai đoạn 1
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo và phân loại câu hỏi theo từng ngân hàng, môn học, chủ đề & độ khó.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateBankModal(true)}
              className="px-3.5 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
            >
              <span>➕</span>
              <span>Tạo ngân hàng mới</span>
            </button>
          </div>
        </div>

        {/* Danh sách ngân hàng & Bộ lọc */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Lọc theo ngân hàng:</span>
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="text-xs p-2 border rounded-lg bg-slate-50 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Tất cả ngân hàng ({questions.length} câu)</option>
              {banks.map((b) => {
                const count = questions.filter((q) => q.bankId === b.id).length;
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} ({count} câu) - Môn: {b.subject}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {banks.map((b) => {
              const count = questions.filter((q) => q.bankId === b.id).length;
              const isSelected = selectedBankFilter === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBankFilter(isSelected ? 'ALL' : b.id)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>📚 {b.name}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL TẠO NGÂN HÀNG CÂU HỎI MỚI */}
      {showCreateBankModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-base font-bold text-slate-800">➕ Tạo Ngân hàng câu hỏi mới</h4>
              <button
                onClick={() => setShowCreateBankModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBank} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên ngân hàng câu hỏi *
                </label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="Ví dụ: Ngân hàng Kiến trúc AWS & Serverless"
                  className="w-full p-2.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Môn học *
                </label>
                <input
                  type="text"
                  value={newBankSubject}
                  onChange={(e) => setNewBankSubject(e.target.value)}
                  placeholder="Ví dụ: Điện toán đám mây"
                  className="w-full p-2.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu ngân hàng câu hỏi..."
                  rows={2}
                  className="w-full p-2.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBankModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingBank}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer"
                >
                  {creatingBank ? 'Đang tạo...' : 'Xác nhận tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. FORM THÊM / SỬA CÂU HỎI VỚI ĐẦY ĐỦ METADATA THEO SPEC */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-800">
            {editingId ? '✏️ Chỉnh sửa câu hỏi' : '➕ Thêm câu hỏi mới vào ngân hàng'}
          </h3>
          {editingId && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
              ID: {editingId}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hàng chọn ngân hàng, môn học, chủ đề, loại câu hỏi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngân hàng câu hỏi (bankId)
              </label>
              <select
                value={bankId}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full p-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học (subject)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ví dụ: Điện toán đám mây"
                className="w-full p-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chủ đề (topic)</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: AWS Lambda / DynamoDB"
                className="w-full p-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loại câu hỏi (type)</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="w-full p-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
                <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều lựa chọn</option>
              </select>
            </div>
          </div>

          {/* Nội dung câu hỏi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nội dung câu hỏi (content) *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
              rows={3}
              placeholder="Nhập nội dung câu hỏi..."
              required
            />
          </div>

          {/* 4 phương án trả lời */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Các phương án trả lời (options) & Đánh dấu đáp án đúng (correctAnswer) *
              </label>
              <span className="text-[11px] text-slate-500">
                Click vào nút tròn để chọn đáp án đúng
              </span>
            </div>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-1.5 rounded-lg border transition ${
                    correctIndex === i ? 'border-green-400 bg-green-50/40' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    className="ml-2 w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer"
                    aria-label={`Đáp án ${LABELS[i]} là đáp án đúng`}
                  />
                  <span
                    className={`w-5 font-bold text-xs ${
                      correctIndex === i ? 'text-green-700' : 'text-slate-600'
                    }`}
                  >
                    {LABELS[i]}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                    }
                    placeholder={`Nội dung đáp án ${LABELS[i]}...`}
                    className="flex-1 p-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    required
                  />
                  {correctIndex === i && (
                    <span className="text-[11px] font-bold text-green-600 px-2 py-0.5 rounded bg-green-100 mr-1">
                      ĐÁP ÁN ĐÚNG
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Độ khó, Điểm số, Upload ảnh qua S3 Presigned URL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mức độ (difficulty)
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full p-2.5 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="EASY">Dễ (EASY)</option>
                <option value="MEDIUM">Trung bình (MEDIUM)</option>
                <option value="HARD">Khó (HARD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Điểm câu hỏi (score)
              </label>
              <input
                type="number"
                min={0}
                step={0.25}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full p-2.5 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Ảnh đính kèm (imageUrl)
                </label>
                <span className="text-[10px] text-blue-600 font-mono">S3 Presigned URL</span>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          {/* Upload Status / Image preview */}
          {uploadStatus && (
            <p className="text-xs text-blue-600 font-medium italic animate-pulse">
              ⏳ {uploadStatus}
            </p>
          )}

          {existingImage && !file && (
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
              <img
                src={existingImage}
                alt="Ảnh hiện tại"
                className="h-16 w-16 object-cover rounded border"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-mono text-slate-600 block truncate">
                  {existingImage}
                </span>
                <span className="text-[10px] text-green-600 font-medium">
                  ✓ Đã lưu trên Amazon S3
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExistingImage('')}
                className="text-xs text-red-600 hover:underline px-2 py-1 font-semibold"
              >
                Bỏ ảnh
              </button>
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 disabled:bg-gray-400 transition shadow-sm"
            >
              {loading ? 'Đang xử lý...' : editingId ? 'Lưu thay đổi câu hỏi' : 'Lưu câu hỏi mới'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 border rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Hủy sửa
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 3. DANH SÁCH CÂU HỎI TRONG NGÂN HÀNG (FULL SCHEMA DISPLAY) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Danh sách câu hỏi ({filteredQuestions.length})
            </h3>
            <p className="text-xs text-slate-500">
              {selectedBankFilter === 'ALL'
                ? 'Đang hiển thị toàn bộ câu hỏi trong tất cả ngân hàng.'
                : `Đang lọc theo ngân hàng: ${
                    banks.find((b) => b.id === selectedBankFilter)?.name ?? selectedBankFilter
                  }`}
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Tổng điểm: {filteredQuestions.reduce((sum, q) => sum + (q.score || 0), 0)} pts
          </span>
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-xl border-slate-200">
            <p className="text-sm text-slate-400">
              Chưa có câu hỏi nào trong ngân hàng này.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Thêm câu hỏi đầu tiên bằng form ở phía trên.
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filteredQuestions.map((q, index) => {
            const bank = banks.find((b) => b.id === q.bankId);
            return (
              <div key={q.id} className="py-4 flex justify-between items-start gap-4 hover:bg-slate-50/50 p-2 rounded-lg transition">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">
                      #{index + 1}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      ID: {q.id}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      📁 {bank?.name || q.bankId || 'Ngân hàng chung'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                      📖 {q.subject || 'Chung'} • {q.topic || 'Chủ đề chung'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      {TYPE_LABEL[q.type] || q.type}
                    </span>
                  </div>

                  <p className="font-semibold text-slate-800 text-sm">{q.content}</p>

                  {/* Danh sách 4 options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt, i) => {
                      const isCorrect = i === q.correctIndex;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border flex items-center gap-2 ${
                            isCorrect
                              ? 'border-green-300 bg-green-50 text-green-800 font-bold'
                              : 'border-slate-100 bg-white text-slate-600'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCorrect ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {LABELS[i]}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && (
                            <span className="text-[10px] uppercase font-bold text-green-700">
                              ✓ Đúng
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Metadata tags */}
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        q.difficulty === 'HARD'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : q.difficulty === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                      {q.score} điểm
                    </span>

                    {q.imageUrl && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <img
                          src={q.imageUrl}
                          alt="Đính kèm"
                          className="h-6 w-6 object-cover rounded border"
                        />
                        <a
                          href={q.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          Xem ảnh S3
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="flex flex-col gap-1.5 text-xs">
                  <button
                    onClick={() => startEdit(q)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded transition"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
