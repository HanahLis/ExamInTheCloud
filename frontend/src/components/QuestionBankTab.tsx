import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { uploadQuestionImage } from '../services/s3Service';
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionBanks,
  createQuestionBank,
  deleteQuestionBank,
  getDeletedBankIds,
  parseQuestionsFromDoc,
  extractTextFromDocxFile,
  DEFAULT_QUESTION_BANKS,
  type Question,
  type QuestionType,
  type QuestionBank,
  type ParseDocResponse,
} from '../services/apiService';
import { getCurrentUser } from '../services/auth';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface Props {
  questions: Question[];
  onRefresh: () => void | Promise<void>;
}

export const QuestionBankTab = ({ questions, onRefresh }: Props) => {
  // 1. Định danh Giảng viên hiện tại (Cô lập dữ liệu theo tài khoản)
  const currentUser = getCurrentUser();
  const lecturerEmail = (currentUser.email || 'annv@uet.vnu.edu.vn').toLowerCase().trim();
  const lecturerName =
    currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : 'Giảng viên');

  // 2. Ngân hàng câu hỏi của Giảng viên
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);

  const [newBankName, setNewBankName] = useState('');
  const [newBankSubject, setNewBankSubject] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');
  const [creatingBank, setCreatingBank] = useState(false);

  // 3. Form tạo / sửa câu hỏi (Hỗ trợ Trắc nghiệm A-F & Tự luận Essay)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bankId, setBankId] = useState<string>('bank-se-arch-01');
  const [subject, setSubject] = useState('Kiến trúc hướng dịch vụ');
  const [topic, setTopic] = useState('Kiến trúc hệ thống');
  const [questionType, setQuestionType] = useState<QuestionType>('SINGLE_CHOICE');
  const [content, setContent] = useState('');
  const [essayRubric, setEssayRubric] = useState('');
  // Hình thức trắc nghiệm từ 2 đến 6 lựa chọn (A, B, C, D, E, F)
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [score, setScore] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // 4. Modal nhập đề thi từ tệp Word (.docx)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBankId, setImportBankId] = useState<string>('bank-se-arch-01');
  const [importSubject, setImportSubject] = useState('Kiến trúc hướng dịch vụ');
  const [importTopic, setImportTopic] = useState('Kiến trúc hệ thống');
  const [importInputMode, setImportInputMode] = useState<'FILE' | 'TEXT'>('FILE');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState('');
  const [importAutoSave, setImportAutoSave] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccessMessage, setImportSuccessMessage] = useState('');
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [importApiKey, setImportApiKey] = useState(
    (import.meta as any).env.VITE_GEMINI_API_KEY || ''
  );
  const [importModel, setImportModel] = useState(
    (import.meta as any).env.VITE_GEMINI_MODEL || 'gemini-3.8-flash'
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Tải danh sách ngân hàng câu hỏi
  const loadBanks = async () => {
    try {
      const list = await getQuestionBanks(lecturerEmail);
      const deletedIds = getDeletedBankIds();

      // Lọc các ngân hàng thuộc tài khoản giảng viên hiện tại hoặc ngân hàng dùng chung (chưa bị xóa)
      const myOwned = list.filter((b) => {
        if (deletedIds.has(b.id) || deletedIds.has(b.bankId || '')) return false;
        if (!b.ownerEmail && !b.createdBy) return true;
        return (
          b.ownerEmail?.toLowerCase() === lecturerEmail ||
          b.createdBy?.toLowerCase() === lecturerEmail
        );
      });

      // Kiểm tra ngân hàng mặc định nếu chưa bị xóa
      const availableDefaults = DEFAULT_QUESTION_BANKS.filter(
        (b) => !deletedIds.has(b.id) && !deletedIds.has(b.bankId || '')
      );

      const finalList =
        myOwned.length > 0 ? myOwned : list.length > 0 ? list : availableDefaults;
      setBanks(finalList);

      if (finalList.length > 0) {
        setBankId((prev) => (finalList.some((b) => b.id === prev) ? prev : finalList[0].id));
        setImportBankId((prev) => (finalList.some((b) => b.id === prev) ? prev : finalList[0].id));
      } else {
        setBankId('');
        setImportBankId('');
      }
    } catch (e) {
      console.error('Lỗi tải ngân hàng câu hỏi:', e);
      const deletedIds = getDeletedBankIds();
      const availableDefaults = DEFAULT_QUESTION_BANKS.filter(
        (b) => !deletedIds.has(b.id) && !deletedIds.has(b.bankId || '')
      );
      setBanks(availableDefaults);
      if (availableDefaults.length > 0) {
        setBankId(availableDefaults[0].id);
        setImportBankId(availableDefaults[0].id);
      } else {
        setBankId('');
        setImportBankId('');
      }
    }
  };

  useEffect(() => {
    loadBanks();
  }, [lecturerEmail]);

  // Ngân hàng câu hỏi của riêng giảng viên này (đảm bảo loại bỏ ngân hàng đã xóa)
  const lecturerBanks = useMemo(() => {
    const deletedIds = getDeletedBankIds();
    return banks.filter((b) => {
      if (deletedIds.has(b.id) || deletedIds.has(b.bankId || '')) return false;
      if (!b.ownerEmail && !b.createdBy) return true;
      return (
        b.ownerEmail?.toLowerCase() === lecturerEmail ||
        b.createdBy?.toLowerCase() === lecturerEmail
      );
    });
  }, [banks, lecturerEmail]);

  // Lọc câu hỏi thuộc phạm vi ngân hàng của giảng viên hiện tại
  const lecturerBankIds = useMemo(
    () => new Set(lecturerBanks.map((b) => b.id)),
    [lecturerBanks]
  );

  const lecturerQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.bankId && lecturerBankIds.has(q.bankId)) return true;
      if (q.ownerEmail && q.ownerEmail.toLowerCase() === lecturerEmail) return true;
      if (q.createdBy && q.createdBy.toLowerCase() === lecturerEmail) return true;
      return false;
    });
  }, [questions, lecturerBankIds, lecturerEmail]);

  // Lọc theo ngân hàng được chọn
  const filteredQuestions = useMemo(() => {
    if (selectedBankFilter === 'ALL') return lecturerQuestions;
    return lecturerQuestions.filter((q) => q.bankId === selectedBankFilter);
  }, [lecturerQuestions, selectedBankFilter]);

  const handleBankChange = (newBankId: string) => {
    setBankId(newBankId);
    const found = lecturerBanks.find((b) => b.id === newBankId);
    if (found && found.subject) {
      setSubject(found.subject);
    }
  };

  // Tạo ngân hàng câu hỏi mới
  const handleCreateBank = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return alert('Vui lòng nhập tên ngân hàng câu hỏi.');
    setCreatingBank(true);
    try {
      const created = await createQuestionBank({
        name: newBankName.trim(),
        subject: newBankSubject.trim() || 'Chung',
        description: newBankDesc.trim(),
        ownerEmail: lecturerEmail,
        createdBy: lecturerEmail,
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

  // Tùy chỉnh các phương án trả lời (Từ 2 đến 6 lựa chọn A - F)
  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (options.length <= 2) {
      return alert('Mỗi câu hỏi phải có tối thiểu 2 phương án trả lời.');
    }
    setOptions((prev) => prev.filter((_, i) => i !== indexToRemove));
    if (correctIndex === indexToRemove) {
      setCorrectIndex(0);
    } else if (correctIndex > indexToRemove) {
      setCorrectIndex((prev) => prev - 1);
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === index ? val : opt)));
  };

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setQuestionType('SINGLE_CHOICE');
    setContent('');
    setEssayRubric('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setScore(1);
    setFile(null);
    setExistingImage('');
    setUploadStatus('');
    if (fileInput.current) fileInput.current.value = '';
  };

  // Nạp câu hỏi vào form để chỉnh sửa
  const startEdit = (q: Question) => {
    const isEssay = q.type === 'ESSAY';
    setEditingId(q.id);
    setBankId(q.bankId || (lecturerBanks[0]?.id ?? 'bank-se-arch-01'));
    setQuestionType(isEssay ? 'ESSAY' : 'SINGLE_CHOICE');
    setContent(q.content);
    setEssayRubric(isEssay ? (q.correctAnswer || '') : '');
    setSubject(q.subject || 'Kiến trúc hướng dịch vụ');
    setTopic(q.topic || 'Kiến trúc hệ thống');

    if (!isEssay) {
      // Nạp danh sách phương án trắc nghiệm (đảm bảo ít nhất 2 và tối đa 6)
      const currentOptions =
        Array.isArray(q.options) && q.options.length >= 2 ? [...q.options] : ['', ''];
      setOptions(currentOptions.slice(0, 6));
      setCorrectIndex(
        q.correctIndex !== undefined && q.correctIndex < currentOptions.length ? q.correctIndex : 0
      );
    }

    setScore(q.score ?? 1);
    setFile(null);
    setExistingImage(q.imageUrl ?? '');
    setUploadStatus('');
    if (fileInput.current) fileInput.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lưu câu hỏi mới hoặc cập nhật câu hỏi (Trắc nghiệm hoặc Tự luận)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      return alert('Vui lòng nhập nội dung câu hỏi.');
    }

    if (questionType !== 'ESSAY') {
      if (options.length < 2) {
        return alert('Câu hỏi trắc nghiệm phải có ít nhất 2 phương án trả lời.');
      }
      if (options.some((o) => !o.trim())) {
        return alert('Vui lòng nhập đầy đủ nội dung cho tất cả các phương án trả lời.');
      }
    }

    setLoading(true);
    try {
      let imageUrl = existingImage;
      if (file) {
        setUploadStatus('Đang tải ảnh lên lưu trữ...');
        imageUrl = await uploadQuestionImage(file);
        setUploadStatus('Tải ảnh thành công');
      }

      let payload: any;
      if (questionType === 'ESSAY') {
        payload = {
          bankId,
          content: content.trim(),
          type: 'ESSAY' as QuestionType,
          options: [],
          correctIndex: -1,
          correctAnswer: essayRubric.trim(),
          score: Math.max(0.25, Number(score) || 1),
          subject: subject.trim(),
          topic: topic.trim(),
          difficulty: 'MEDIUM' as const,
          imageUrl,
          ownerEmail: lecturerEmail,
          createdBy: lecturerEmail,
        };
      } else {
        const correctAnswer = options[correctIndex]?.trim() || options[0]?.trim() || '';
        payload = {
          bankId,
          content: content.trim(),
          type: 'SINGLE_CHOICE' as QuestionType,
          options: options.map((o) => o.trim()),
          correctIndex,
          correctAnswer,
          score: Math.max(0.25, Number(score) || 1),
          subject: subject.trim(),
          topic: topic.trim(),
          difficulty: 'MEDIUM' as const,
          imageUrl,
          ownerEmail: lecturerEmail,
          createdBy: lecturerEmail,
        };
      }

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

  // Xóa câu hỏi
  const handleDelete = async (q: Question) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa câu hỏi "${q.content.substring(0, 50)}..."?`)) return;
    try {
      await deleteQuestion(q.id);
      if (editingId === q.id) resetForm();
      await onRefresh();
    } catch (err) {
      alert('Lỗi xóa câu hỏi: ' + err);
    }
  };

  // Xóa vĩnh viễn ngân hàng câu hỏi trên AWS DynamoDB (CloudExam_QuestionBanks_dev & CloudExam_Questions_dev)
  const handleDeleteBank = async (bank: QuestionBank) => {
    const bankQs = lecturerQuestions.filter((q) => q.bankId === bank.id);
    const confirmMsg = `Bạn có chắc chắn muốn xóa vĩnh viễn ngân hàng "${bank.name}" và toàn bộ ${bankQs.length} câu hỏi thuộc ngân hàng này trên hệ thống lưu trữ AWS?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingBankId(bank.id);

    // Cập nhật ngay tức thì giao diện để người dùng thấy ngân hàng biến mất 0ms
    setBanks((prev) => prev.filter((b) => b.id !== bank.id && b.bankId !== bank.id));
    if (selectedBankFilter === bank.id) {
      setSelectedBankFilter('ALL');
    }
    if (bankId === bank.id) {
      const remaining = lecturerBanks.filter((b) => b.id !== bank.id);
      if (remaining.length > 0) {
        setBankId(remaining[0].id);
        if (remaining[0].subject) setSubject(remaining[0].subject);
      } else {
        setBankId('');
      }
    }

    try {
      await deleteQuestionBank(bank.id);
      await loadBanks();
      await onRefresh();
    } catch (err: any) {
      console.warn('Lỗi đồng bộ xóa ngân hàng câu hỏi:', err);
      await loadBanks();
    } finally {
      setDeletingBankId(null);
    }
  };

  // Xử lý mở modal nhập đề thi từ Word
  const handleOpenImportModal = () => {
    const target =
      selectedBankFilter !== 'ALL'
        ? selectedBankFilter
        : lecturerBanks[0]?.id || 'bank-se-arch-01';
    setImportBankId(target);
    const found = lecturerBanks.find((b) => b.id === target);
    if (found?.subject) setImportSubject(found.subject);
    setImportError('');
    setImportSuccessMessage('');
    setExtractedQuestions([]);
    setShowImportModal(true);
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportText('');
    setImportError('');
    setImportSuccessMessage('');
    setExtractedQuestions([]);
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  };

  // Thực hiện trích xuất câu hỏi từ file Word / văn bản
  const handleStartImport = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setImportError('');
    setImportSuccessMessage('');
    setExtractedQuestions([]);

    if (importInputMode === 'FILE' && !importFile) {
      setImportError('Vui lòng chọn tệp Word (.docx) hoặc (.txt) từ máy tính.');
      return;
    }
    if (importInputMode === 'TEXT' && !importText.trim()) {
      setImportError('Vui lòng dán nội dung văn bản đề thi để trích xuất.');
      return;
    }

    setImportLoading(true);
    try {
      let fileBase64: string | undefined = undefined;
      let docText: string | undefined = undefined;

      if (importInputMode === 'FILE' && importFile) {
        try {
          docText = await extractTextFromDocxFile(importFile);
        } catch (docxErr) {
          console.warn('Lỗi đọc nội dung docx client-side:', docxErr);
        }

        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(importFile);
        });
      } else if (importInputMode === 'TEXT') {
        docText = importText.trim();
      }

      const res: ParseDocResponse = await parseQuestionsFromDoc({
        bankId: importBankId || bankId || 'bank-se-arch-01',
        subject: importSubject.trim() || subject || 'Kiến trúc hướng dịch vụ',
        topic: importTopic.trim() || topic || 'Kiến trúc hệ thống',
        fileBase64,
        docText,
        text: docText,
        autoSave: importAutoSave,
        model: importModel.trim() || undefined,
        apiKey: importApiKey.trim() || undefined,
      });

      setImportSuccessMessage(
        res.message || `Đã trích xuất thành công ${res.count} câu hỏi vào ngân hàng.`
      );
      setExtractedQuestions(res.questions || []);

      if (importAutoSave) {
        await onRefresh();
      }
    } catch (err: any) {
      console.error('Lỗi trích xuất đề thi:', err);
      setImportError(
        err.response?.data?.error || err.message || 'Lỗi xử lý tệp đề thi. Vui lòng thử lại.'
      );
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Thanh tiêu đề & Quản lý ngân hàng câu hỏi của Giảng viên */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Ngân hàng câu hỏi của tôi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tài khoản giảng viên:{' '}
              <span className="font-medium text-slate-700">{lecturerName}</span> (
              {lecturerEmail})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenImportModal}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              <span>Soạn câu hỏi bằng Gemini AI / Nhập Word</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateBankModal(true)}
              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition cursor-pointer"
            >
              + Tạo ngân hàng mới
            </button>
          </div>
        </div>

        {/* Bộ lọc ngân hàng */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Lọc theo ngân hàng:</span>
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="text-xs p-1.5 border border-slate-200 rounded-md bg-white text-slate-700 outline-none"
            >
              <option value="ALL">Tất cả ({lecturerQuestions.length} câu)</option>
              {lecturerBanks.map((b) => {
                const count = lecturerQuestions.filter((q) => q.bankId === b.id).length;
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} ({count} câu)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 text-xs items-center">
            {lecturerBanks.length === 0 && (
              <span className="text-xs text-slate-400 italic">
                Chưa có ngân hàng nào. Bấm "+ Tạo ngân hàng mới" để thêm.
              </span>
            )}
            {lecturerBanks.map((b) => {
              const count = lecturerQuestions.filter((q) => q.bankId === b.id).length;
              const isSelected = selectedBankFilter === b.id;
              const isDeleting = deletingBankId === b.id;
              return (
                <div
                  key={b.id}
                  className={`inline-flex items-center rounded-md border transition overflow-hidden shadow-2xs ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBankFilter(isSelected ? 'ALL' : b.id)}
                    className="px-2.5 py-1 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="font-medium">{b.name}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
                        isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                  <button
                    type="button"
                    title={`Xóa vĩnh viễn ngân hàng "${b.name}" trên AWS DynamoDB`}
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBank(b);
                    }}
                    className={`px-2 py-1 text-[11px] font-bold border-l transition cursor-pointer disabled:opacity-50 ${
                      isSelected
                        ? 'border-slate-800 text-slate-300 hover:text-rose-300 hover:bg-rose-950/40'
                        : 'border-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    {isDeleting ? '...' : '✕'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal tạo ngân hàng câu hỏi mới */}
      {showCreateBankModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-md w-full border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-slate-800">
                Tạo ngân hàng câu hỏi mới
              </h4>
              <button
                type="button"
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
                  placeholder="Ví dụ: Đề thi Kiến trúc hướng dịch vụ"
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
                  placeholder="Ví dụ: Kiến trúc hướng dịch vụ"
                  className="w-full p-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mô tả (tùy chọn)
                </label>
                <textarea
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder="Mô tả tóm tắt nội dung ngân hàng câu hỏi..."
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

      {/* Modal Nhập câu hỏi từ tệp Word (.docx) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden my-8">
            {/* Header Modal */}
            <div className="bg-slate-900 p-4 text-white flex justify-between items-start">
              <div>
                <h4 className="text-sm font-semibold">Nhập câu hỏi từ tệp Word (.docx)</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Hỗ trợ tự động bóc tách trọn vẹn cả đề thi Tiếng Việt và Tiếng Anh (Question 1, Q1, Answer, Ans, Key) kèm đáp án.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseImportModal}
                className="text-slate-400 hover:text-white text-base p-1 rounded transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngân hàng câu hỏi đích *
                  </label>
                  <select
                    value={importBankId}
                    onChange={(e) => {
                      setImportBankId(e.target.value);
                      const f = lecturerBanks.find((b) => b.id === e.target.value);
                      if (f?.subject) setImportSubject(f.subject);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 outline-none"
                  >
                    {lecturerBanks.length === 0 ? (
                      <option value="">Chưa có ngân hàng câu hỏi</option>
                    ) : (
                      lecturerBanks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Môn học
                  </label>
                  <input
                    type="text"
                    value={importSubject}
                    onChange={(e) => setImportSubject(e.target.value)}
                    placeholder="Ví dụ: Kiến trúc hướng dịch vụ"
                    className="w-full p-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chủ đề
                  </label>
                  <input
                    type="text"
                    value={importTopic}
                    onChange={(e) => setImportTopic(e.target.value)}
                    placeholder="Ví dụ: Kiến trúc hệ thống"
                    className="w-full p-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Cấu hình Google Gemini AI */}
              <div className="bg-indigo-50/70 p-3.5 rounded-lg border border-indigo-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span className="text-xs font-semibold text-indigo-900">
                      Cấu hình Google Gemini AI Studio
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-600 font-mono">
                    {importApiKey.trim() ? '✓ Đã cấu hình Key' : 'Mặc định: .env'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Mô hình AI (Model)
                    </label>
                    <input
                      type="text"
                      value={importModel}
                      onChange={(e) => setImportModel(e.target.value)}
                      placeholder="gemini-3.8-flash hoặc gemini-3.1-flash-lite"
                      className="w-full p-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Google Gemini API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={importApiKey}
                        onChange={(e) => setImportApiKey(e.target.value)}
                        placeholder="Dán AIzaSy... (hoặc để trống nếu đã có trong .env)"
                        className="w-full p-2 pr-12 border border-slate-300 rounded-md text-xs bg-white text-slate-800 outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-800 px-1 py-0.5 rounded cursor-pointer"
                      >
                        {showApiKey ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <span className="font-semibold text-slate-700">Lưu ý:</span> Bạn có thể cấu hình cố định trong tệp <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-700">frontend/.env</code> với <code className="text-indigo-600 font-mono">VITE_GEMINI_API_KEY</code> và <code className="text-indigo-600 font-mono">VITE_GEMINI_MODEL=gemini-3.8-flash</code> để không cần nhập lại mỗi lần.
                </p>
              </div>

              {/* Chế độ nhập */}
              <div>
                <div className="flex border-b border-slate-200 mb-3">
                  <button
                    type="button"
                    onClick={() => setImportInputMode('FILE')}
                    className={`pb-2 px-3 text-xs font-medium border-b-2 transition cursor-pointer ${
                      importInputMode === 'FILE'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Tải tệp Word (.docx) / Văn bản (.txt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportInputMode('TEXT')}
                    className={`pb-2 px-3 text-xs font-medium border-b-2 transition cursor-pointer ${
                      importInputMode === 'TEXT'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Dán đề thi / Soạn câu hỏi bằng AI Prompt
                  </button>
                </div>

                {importInputMode === 'FILE' ? (
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50 hover:bg-slate-50 transition">
                    <input
                      ref={docFileInputRef}
                      type="file"
                      accept=".docx,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setImportFile(f);
                        if (f && !importTopic) {
                          setImportTopic(f.name.replace(/\.[^/.]+$/, ''));
                        }
                      }}
                      className="hidden"
                      id="doc-file-upload-input"
                    />
                    <label
                      htmlFor="doc-file-upload-input"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                    >
                      <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <span className="text-xs font-semibold text-slate-700">
                        {importFile ? importFile.name : 'Bấm vào đây để chọn tệp .docx hoặc .txt'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {importFile
                          ? `${(importFile.size / 1024).toFixed(1)} KB`
                          : 'Hỗ trợ tệp Microsoft Word (.docx) và văn bản thuần (.txt)'}
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-medium">Gợi ý câu lệnh mẫu:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setImportText(
                            'Tạo 5 câu hỏi trắc nghiệm chuyên sâu về điện toán đám mây AWS (bao gồm EC2, S3, Lambda, DynamoDB, VPC). Mỗi câu có 4 phương án A, B, C, D và chỉ rõ đáp án đúng.'
                          )
                        }
                        className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100 transition cursor-pointer font-medium"
                      >
                        5 câu về AWS Cloud
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setImportText(
                            'Soạn 5 câu hỏi trắc nghiệm về kiến trúc Microservices và RESTful API. Mỗi câu có 4 lựa chọn A, B, C, D kèm đáp án chính xác.'
                          )
                        }
                        className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded hover:bg-slate-200 transition cursor-pointer font-medium"
                      >
                        5 câu về Microservices
                      </button>
                    </div>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Dán nội dung đề thi có sẵn (Câu 1: ... A. ... B. ...) HOẶC nhập prompt yêu cầu Gemini soạn câu hỏi mới (Ví dụ: 'Tạo 5 câu hỏi trắc nghiệm về bảo mật điện toán đám mây và IAM, mỗi câu 4 phương án A-D và ghi rõ đáp án đúng')..."
                      rows={6}
                      className="w-full p-2.5 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400 font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-auto-save"
                  checked={importAutoSave}
                  onChange={(e) => setImportAutoSave(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                />
                <label
                  htmlFor="chk-auto-save"
                  className="text-xs text-slate-700 cursor-pointer"
                >
                  Tự động lưu toàn bộ câu hỏi trích xuất vào ngân hàng câu hỏi
                </label>
              </div>

              {importError && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {importError}
                </div>
              )}

              {importSuccessMessage && (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                  {importSuccessMessage}
                </div>
              )}

              {/* Xem trước câu hỏi đã trích xuất */}
              {extractedQuestions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">
                      Danh sách câu hỏi trích xuất ({extractedQuestions.length} câu):
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      Đã đồng bộ vào ngân hàng
                    </span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {extractedQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1.5"
                      >
                        <div className="flex items-start gap-1.5">
                          <span className="font-bold text-indigo-700">Câu {idx + 1}:</span>
                          <span className="font-medium text-slate-800 flex-1">
                            {q.content}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-4">
                          {q.options?.map((opt, oIdx) => {
                            const isCorrect = oIdx === q.correctIndex;
                            return (
                              <div
                                key={oIdx}
                                className={`p-1.5 rounded border text-[11px] flex items-center gap-1.5 ${
                                  isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {OPTION_LABELS[oIdx]}
                                </span>
                                <span className="flex-1 truncate">{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseImportModal}
                  className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  {extractedQuestions.length > 0 ? 'Đóng cửa sổ' : 'Hủy bỏ'}
                </button>
                <button
                  type="button"
                  disabled={importLoading}
                  onClick={handleStartImport}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {importLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang trích xuất...</span>
                    </>
                  ) : (
                    <span>
                      {extractedQuestions.length > 0
                        ? 'Trích xuất thêm tệp khác'
                        : 'Trích xuất câu hỏi'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Form Thêm / Chỉnh sửa câu hỏi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {editingId ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hàng 1: Tên ngân hàng, Môn học, Chủ đề */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-md border border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ngân hàng câu hỏi *
              </label>
              <select
                value={bankId}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded text-xs bg-white text-slate-800 outline-none focus:border-slate-400"
                required
              >
                {lecturerBanks.length === 0 ? (
                  <option value="">Chưa có ngân hàng câu hỏi</option>
                ) : (
                  lecturerBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Môn học *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ví dụ: Kiến trúc hướng dịch vụ"
                className="w-full p-2 border border-slate-200 rounded text-xs bg-white text-slate-800 outline-none focus:border-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Chủ đề *
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: Kiến trúc hệ thống"
                className="w-full p-2 border border-slate-200 rounded text-xs bg-white text-slate-800 outline-none focus:border-slate-400"
                required
              />
            </div>
          </div>

          {/* Hàng 2: Nội dung câu hỏi */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nội dung câu hỏi *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-xs leading-relaxed"
              rows={3}
              placeholder="Nhập nội dung câu hỏi..."
              required
            />
          </div>

          {/* Lựa chọn loại câu hỏi: Trắc nghiệm (A-F) hoặc Tự luận */}
          <div className="flex items-center gap-3 pb-1">
            <span className="text-xs font-semibold text-slate-700">Loại câu hỏi:</span>
            <div className="inline-flex rounded-md p-0.5 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setQuestionType('SINGLE_CHOICE')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition ${
                  questionType !== 'ESSAY'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Trắc nghiệm (A-F)
              </button>
              <button
                type="button"
                onClick={() => setQuestionType('ESSAY')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition ${
                  questionType === 'ESSAY'
                    ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                Tự luận (Essay)
              </button>
            </div>
          </div>

          {/* Nếu là Tự luận: hiển thị Barem / Gợi ý đáp án. Nếu là Trắc nghiệm: hiển thị các lựa chọn A-F */}
          {questionType === 'ESSAY' ? (
            <div className="space-y-1.5 p-3 rounded-md border border-indigo-200 bg-indigo-50/40">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-indigo-900">
                  Gợi ý đáp án / Barem chấm điểm (Rubric)
                </label>
                <span className="text-[11px] text-indigo-600 font-medium">
                  Thí sinh sẽ nhập câu trả lời trực tiếp trong phòng thi
                </span>
              </div>
              <textarea
                value={essayRubric}
                onChange={(e) => setEssayRubric(e.target.value)}
                className="w-full p-2.5 border border-indigo-200 rounded-md outline-none focus:border-indigo-400 text-xs leading-relaxed bg-white text-slate-800"
                rows={4}
                placeholder="Nhập barem chấm điểm, các ý chính cần có hoặc câu trả lời mẫu cho giảng viên đối chiếu..."
              />
            </div>
          ) : (
            /* Hàng 3: Hình thức trắc nghiệm từ 2 đến 6 lựa chọn (A, B, C, D, E, F) */
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Các lựa chọn trả lời và đánh dấu đáp án đúng *
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Hỗ trợ từ 2 đến 6 phương án (A, B, C, D, E, F). Chọn nút tròn để đánh dấu đáp
                    án đúng.
                  </p>
                </div>

                {options.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    + Thêm lựa chọn ({OPTION_LABELS[options.length]})
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {options.map((opt, i) => {
                  const isSelected = correctIndex === i;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded-md border transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/60'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="correct-choice-radio"
                        checked={isSelected}
                        onChange={() => setCorrectIndex(i)}
                        className="ml-1 w-4 h-4 text-emerald-600 cursor-pointer accent-emerald-600"
                        title="Chọn làm đáp án đúng"
                      />
                      <span
                        className={`w-4 font-bold text-xs ${
                          isSelected ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {OPTION_LABELS[i]}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(i, e.target.value)}
                        placeholder={`Nội dung lựa chọn ${OPTION_LABELS[i]}...`}
                        className="flex-1 p-1.5 text-xs border border-slate-200 rounded outline-none focus:border-slate-400 bg-white"
                        required
                      />
                      {isSelected && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded shrink-0">
                          ✓ Đáp án đúng
                        </span>
                      )}
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          className="text-xs text-slate-400 hover:text-rose-600 px-1.5 py-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa lựa chọn này"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hàng 4: Điểm số & Ảnh minh họa (Không có mức độ) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Điểm số *
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
                Ảnh minh họa (nếu có)
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
            <p className="text-xs text-slate-600 font-medium">{uploadStatus}</p>
          )}

          {existingImage && !file && (
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-md border border-slate-200">
              <img
                src={existingImage}
                alt="Ảnh minh họa"
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

      {/* 3. Danh sách câu hỏi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Danh sách câu hỏi ({filteredQuestions.length})
            </h3>
            <p className="text-xs text-slate-500">
              {selectedBankFilter === 'ALL'
                ? 'Tất cả câu hỏi trong ngân hàng của bạn.'
                : `Ngân hàng: ${
                    lecturerBanks.find((b) => b.id === selectedBankFilter)?.name ??
                    selectedBankFilter
                  }`}
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600">
            Tổng điểm:{' '}
            {filteredQuestions.reduce((sum, q) => sum + (Number(q.score) || 0), 0)} điểm
          </span>
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-8 border border-dashed rounded-md border-slate-200">
            <p className="text-xs text-slate-400">Chưa có câu hỏi nào trong ngân hàng này.</p>
          </div>
        )}

        {/* Danh sách hiển thị: chỉ câu hỏi, các câu trả lời (đáp án in xanh) và điểm ở cuối */}
        <div className="divide-y divide-slate-100">
          {filteredQuestions.map((q, index) => {
            return (
              <div key={q.id} className="py-4 space-y-3">
                {/* 1. Câu hỏi & Nhãn phân loại */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 text-sm mr-2">
                      Câu {index + 1}:
                    </span>
                    <span className="text-slate-800 text-sm font-medium leading-relaxed">
                      {q.content}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      q.type === 'ESSAY'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {q.type === 'ESSAY' ? 'Tự luận' : 'Trắc nghiệm'}
                  </span>
                </div>

                {/* Ảnh minh họa nếu có */}
                {q.imageUrl && (
                  <div className="pt-1">
                    <img
                      src={q.imageUrl}
                      alt="Ảnh minh họa"
                      className="max-h-48 rounded border border-slate-200 object-contain bg-slate-50"
                    />
                  </div>
                )}

                {/* 2. Nội dung trả lời (Tự luận hoặc Trắc nghiệm A-F) */}
                {q.type === 'ESSAY' ? (
                  <div className="p-3 rounded-md border border-slate-200 bg-slate-50/70 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[11px]">
                      <span>Câu hỏi tự luận</span>
                      {q.correctAnswer && <span className="text-slate-400">• Barem / Gợi ý đáp án:</span>}
                    </div>
                    {q.correctAnswer ? (
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pl-1 border-l-2 border-indigo-400">
                        {q.correctAnswer}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">Chưa có barem gợi ý đáp án.</p>
                    )}
                  </div>
                ) : (
                  /* Các câu trả lời (đáp án đúng in màu xanh) */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, i) => {
                      const isCorrect = i === q.correctIndex;
                      return (
                        <div
                          key={i}
                          className={`p-2.5 rounded-md border text-xs flex items-start gap-2.5 transition ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold shadow-xs'
                              : 'border-slate-200 bg-slate-50/50 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {OPTION_LABELS[i] || String.fromCharCode(65 + i)}
                          </span>
                          <span
                            className={`flex-1 leading-relaxed ${
                              isCorrect ? 'text-emerald-950 font-semibold' : 'text-slate-700'
                            }`}
                          >
                            {opt}
                          </span>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                              ✓ Đáp án đúng
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Cuối cùng là điểm và các nút thao tác */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(q)}
                      className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition cursor-pointer font-medium"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q)}
                      className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer font-medium"
                    >
                      Xóa
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                      {q.score} điểm
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
