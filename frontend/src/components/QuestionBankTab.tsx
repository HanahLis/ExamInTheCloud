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
  SINGLE_CHOICE: 'Một đáp án',
  MULTIPLE_CHOICE: 'Nhiều lựa chọn',
};

interface Props {
  questions: Question[];
  onRefresh: () => void | Promise<void>;
}

export const QuestionBankTab = ({ questions, onRefresh }: Props) => {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);

  const [newBankName, setNewBankName] = useState('');
  const [newBankSubject, setNewBankSubject] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');
  const [creatingBank, setCreatingBank] = useState(false);

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
        setUploadStatus('Đang tải ảnh...');
        imageUrl = await uploadQuestionImage(file);
        setUploadStatus('Tải ảnh thành công');
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

  const filteredQuestions =
    selectedBankFilter === 'ALL'
      ? questions
      : questions.filter((q) => q.bankId === selectedBankFilter);

  return (
    <div className="space-y-4">
      {/* Thanh lọc & Quản lý ngân hàng */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Ngân hàng câu hỏi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý danh sách câu hỏi phân loại theo môn học và mức độ.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateBankModal(true)}
              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition cursor-pointer"
            >
              + Tạo ngân hàng mới
            </button>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Lọc theo ngân hàng:</span>
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="text-xs p-1.5 border border-slate-200 rounded-md bg-white text-slate-700 outline-none"
            >
              <option value="ALL">Tất cả ({questions.length} câu)</option>
              {banks.map((b) => {
                const count = questions.filter((q) => q.bankId === b.id).length;
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} ({count} câu)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            {banks.map((b) => {
              const count = questions.filter((q) => q.bankId === b.id).length;
              const isSelected = selectedBankFilter === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBankFilter(isSelected ? 'ALL' : b.id)}
                  className={`px-2.5 py-1 rounded-md border text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{b.name}</span>
                  <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal tạo ngân hàng mới */}
      {showCreateBankModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-md w-full border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Tạo ngân hàng câu hỏi mới</h4>
              <button
                onClick={() => setShowCreateBankModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBank} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tên ngân hàng *
                </label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="Ví dụ: Đề thi Điện toán đám mây"
                  className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Môn học *
                </label>
                <input
                  type="text"
                  value={newBankSubject}
                  onChange={(e) => setNewBankSubject(e.target.value)}
                  placeholder="Ví dụ: Điện toán đám mây"
                  className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder="Mô tả nội dung ngân hàng câu hỏi..."
                  rows={2}
                  className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBankModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingBank}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 disabled:bg-slate-400 cursor-pointer"
                >
                  {creatingBank ? 'Đang tạo...' : 'Tạo ngân hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Form thêm / sửa câu hỏi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {editingId ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
          </h3>
          {editingId && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
              ID: {editingId}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-md border border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Ngân hàng câu hỏi
              </label>
              <select
                value={bankId}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-700 outline-none"
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Môn học</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ví dụ: Điện toán đám mây"
                className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Chủ đề</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: Serverless"
                className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hình thức</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-700 outline-none"
              >
                <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
                <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều lựa chọn</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nội dung câu hỏi *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-xs"
              rows={3}
              placeholder="Nhập nội dung câu hỏi..."
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Các lựa chọn trả lời và đánh dấu đáp án đúng *
              </label>
              <span className="text-[11px] text-slate-400">
                Chọn nút tròn để chỉ định đáp án đúng
              </span>
            </div>
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 p-1.5 rounded-md border transition ${
                    correctIndex === i ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    className="ml-2 w-3.5 h-3.5 text-emerald-600 cursor-pointer"
                    aria-label={`Đáp án ${LABELS[i]} là đáp án đúng`}
                  />
                  <span
                    className={`w-4 font-semibold text-xs ${
                      correctIndex === i ? 'text-emerald-700' : 'text-slate-600'
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
                    placeholder={`Nội dung lựa chọn ${LABELS[i]}...`}
                    className="flex-1 p-1.5 text-xs border border-slate-200 rounded outline-none focus:border-slate-400 bg-white"
                    required
                  />
                  {correctIndex === i && (
                    <span className="text-[10px] font-medium text-emerald-700 px-2 py-0.5 rounded bg-emerald-100 mr-1">
                      Đáp án đúng
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mức độ
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full p-2 border border-slate-200 rounded-md text-xs bg-white text-slate-700 outline-none"
              >
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HARD">Khó</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Điểm số
              </label>
              <input
                type="number"
                min={0}
                step={0.25}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ảnh minh họa (tùy chọn)
              </label>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
          </div>

          {uploadStatus && (
            <p className="text-xs text-slate-600 font-medium">
              {uploadStatus}
            </p>
          )}

          {existingImage && !file && (
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-md border border-slate-200">
              <img
                src={existingImage}
                alt="Ảnh đính kèm"
                className="h-12 w-12 object-cover rounded border"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-mono text-slate-500 block truncate">
                  {existingImage}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExistingImage('')}
                className="text-xs text-rose-600 hover:underline px-2 py-1 cursor-pointer"
              >
                Gỡ ảnh
              </button>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-900 text-white font-medium rounded-md text-xs hover:bg-slate-800 disabled:bg-slate-400 transition cursor-pointer"
            >
              {loading ? 'Đang lưu...' : editingId ? 'Cập nhật câu hỏi' : 'Lưu câu hỏi'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-slate-200 rounded-md text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Danh sách câu hỏi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Danh sách câu hỏi ({filteredQuestions.length})
            </h3>
            <p className="text-xs text-slate-500">
              {selectedBankFilter === 'ALL'
                ? 'Tất cả câu hỏi hiện có.'
                : `Ngân hàng: ${
                    banks.find((b) => b.id === selectedBankFilter)?.name ?? selectedBankFilter
                  }`}
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Tổng điểm: {filteredQuestions.reduce((sum, q) => sum + (q.score || 0), 0)}
          </span>
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-8 border border-dashed rounded-md border-slate-200">
            <p className="text-xs text-slate-400">
              Chưa có câu hỏi nào.
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filteredQuestions.map((q, index) => {
            const bank = banks.find((b) => b.id === q.bankId);
            return (
              <div key={q.id} className="py-3.5 flex justify-between items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-mono font-medium text-slate-400">
                      #{index + 1}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      ID: {q.id}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {bank?.name || q.bankId}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {q.subject || 'Chung'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                      {TYPE_LABEL[q.type] || q.type}
                    </span>
                  </div>

                  <p className="font-medium text-slate-800 text-sm">{q.content}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    {q.options.map((opt, i) => {
                      const isCorrect = i === q.correctIndex;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded border flex items-center gap-2 ${
                            isCorrect
                              ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900 font-medium'
                              : 'border-slate-100 bg-slate-50/40 text-slate-600'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {LABELS[i]}
                          </span>
                          <span className="flex-1 truncate">{opt}</span>
                          {isCorrect && (
                            <span className="text-[9px] font-semibold text-emerald-700">
                              Đúng
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        q.difficulty === 'HARD'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : q.difficulty === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {q.score} điểm
                    </span>

                    {q.imageUrl && (
                      <div className="flex items-center gap-1 ml-2">
                        <a
                          href={q.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-600 hover:text-slate-900 underline"
                        >
                          Xem ảnh
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs shrink-0">
                  <button
                    onClick={() => startEdit(q)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition cursor-pointer"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
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
