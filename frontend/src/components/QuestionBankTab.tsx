import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from '../locales/i18nContext';
import { uploadQuestionImage } from '../services/s3Service';
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionBanks,
  createQuestionBank,
  deleteQuestionBank,
  parseQuestionsFromDoc,
  extractTextFromDocxFile,
  testGeminiApiKey,
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
  const { t, lang } = useTranslation();
  const currentUser = getCurrentUser();
  const lecturerEmail = (currentUser.email || '').toLowerCase().trim();
  const lecturerName =
    currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : t('qb_lecturer_label'));

  // Ngân hàng câu hỏi của Giảng viên
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);

  const [newBankName, setNewBankName] = useState('');
  const [newBankSubject, setNewBankSubject] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');
  const [creatingBank, setCreatingBank] = useState(false);

  // Form tạo / sửa câu hỏi
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bankId, setBankId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('SINGLE_CHOICE');
  const [content, setContent] = useState('');
  const [essayRubric, setEssayRubric] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [score, setScore] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Modal nhập đề thi từ tệp Word (.docx) & AI
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBankId, setImportBankId] = useState<string>('');
  const [importSubject, setImportSubject] = useState('');
  const [importTopic, setImportTopic] = useState('');
  const [importInputMode, setImportInputMode] = useState<'FILE' | 'TEXT'>('TEXT');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState(
    t('qb_ai_default_prompt', { count: 20 }) ||
    'Tạo 20 câu hỏi trắc nghiệm chuyên sâu về điện toán đám mây AWS (bao gồm EC2, S3, Lambda, DynamoDB, VPC). Mỗi câu có 4 phương án A, B, C, D và chỉ rõ đáp án đúng.'
  );
  const [importCount, setImportCount] = useState<number>(20);
  const [importAutoSave, setImportAutoSave] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccessMessage, setImportSuccessMessage] = useState('');
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [importApiKey, setImportApiKey] = useState<string>(() => {
    return (
      (typeof window !== 'undefined' ? localStorage.getItem('cloudexam_gemini_key') : '') ||
      (import.meta as any).env.VITE_GEMINI_API_KEY ||
      ''
    );
  });
  const [importModel, setImportModel] = useState<string>(() => {
    return (
      (typeof window !== 'undefined' ? localStorage.getItem('cloudexam_gemini_model') : '') ||
      (import.meta as any).env.VITE_GEMINI_MODEL ||
      'gemini-3.6-flash'
    );
  });

  const handleApiKeyChange = (val: string) => {
    setImportApiKey(val);
    setGeminiKeyTestResult(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cloudexam_gemini_key', val.trim());
    }
  };

  const handleModelChange = (val: string) => {
    setImportModel(val);
    setGeminiKeyTestResult(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cloudexam_gemini_model', val.trim());
    }
  };

  // Kiểm tra API Key Gemini
  const [testingGeminiKey, setTestingGeminiKey] = useState(false);
  const [geminiKeyTestResult, setGeminiKeyTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestGeminiKey = async () => {
    if (!importApiKey.trim()) {
      setGeminiKeyTestResult({ ok: false, message: 'key_empty' });
      return;
    }
    setTestingGeminiKey(true);
    setGeminiKeyTestResult(null);
    try {
      const res = await testGeminiApiKey(importApiKey, importModel);
      setGeminiKeyTestResult({ ok: res.ok, message: res.ok ? `ok:${res.modelUsed}` : res.message });
    } catch (err: any) {
      setGeminiKeyTestResult({ ok: false, message: 'key_network_error' });
    } finally {
      setTestingGeminiKey(false);
    }
  };
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const loadBanks = async () => {
    try {
      const list = await getQuestionBanks(lecturerEmail);
      setBanks(list);

      if (list.length > 0) {
        setBankId((prev) => (list.some((b) => b.id === prev) ? prev : list[0].id));
        setImportBankId((prev) => (list.some((b) => b.id === prev) ? prev : list[0].id));
      } else {
        setBankId('');
        setImportBankId('');
      }
    } catch (e) {
      console.error('Lỗi tải ngân hàng câu hỏi:', e);
      setBanks([]);
      setBankId('');
      setImportBankId('');
    }
  };

  useEffect(() => {
    loadBanks();
  }, [lecturerEmail]);

  const lecturerBanks = useMemo(() => {
    return banks.filter((b) => {
      if (!b.ownerEmail && !b.createdBy) return true;
      return (
        b.ownerEmail?.toLowerCase() === lecturerEmail ||
        b.createdBy?.toLowerCase() === lecturerEmail
      );
    });
  }, [banks, lecturerEmail]);

  const lecturerBankIds = useMemo(
    () => new Set(lecturerBanks.map((b) => b.id)),
    [lecturerBanks]
  );

  const lecturerQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.bankId && lecturerBankIds.has(q.bankId)) return true;
      if (!q.ownerEmail && !q.createdBy) return true;
      if (q.ownerEmail && q.ownerEmail.toLowerCase() === lecturerEmail) return true;
      if (q.createdBy && q.createdBy.toLowerCase() === lecturerEmail) return true;
      return false;
    });
  }, [questions, lecturerBankIds, lecturerEmail]);

  const filteredQuestions = useMemo(() => {
    if (selectedBankFilter === 'ALL') return lecturerQuestions;
    return lecturerQuestions.filter((q) => q.bankId === selectedBankFilter);
  }, [lecturerQuestions, selectedBankFilter]);

  const getBankSubject = (subj?: string) => subj || t('qb_general_subject');

  const handleBankChange = (newBankId: string) => {
    setBankId(newBankId);
    const found = lecturerBanks.find((b) => b.id === newBankId);
    if (found?.subject) {
      setSubject(found.subject);
    } else {
      setSubject('');
    }
  };

  useEffect(() => {
    if (bankId && !editingId) {
      const found = lecturerBanks.find((b) => b.id === bankId);
      if (found?.subject) {
        setSubject(found.subject);
      }
    }
  }, [bankId, lecturerBanks, editingId]);

  const handleCreateBank = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return alert(t('alert_enter_bank_name'));
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
      setNewBankName('');
      setNewBankSubject('');
      setNewBankDesc('');
      setShowCreateBankModal(false);
    } catch (err) {
      alert(`${t('alert_create_bank_error')} ${err}`);
    } finally {
      setCreatingBank(false);
    }
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (options.length <= 2) {
      return alert(t('alert_min_two_options'));
    }
    setOptions((prev) => prev.filter((_, i) => i !== indexToRemove));
    if (correctIndex === indexToRemove) {
      setCorrectIndex(0);
    } else if (correctIndex > indexToRemove) {
      setCorrectIndex((prev) => prev - 1);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestionType('SINGLE_CHOICE');
    setContent('');
    setEssayRubric('');
    const curBank = lecturerBanks.find((b) => b.id === bankId);
    setSubject(curBank?.subject || '');
    setTopic('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setScore(1);
    setFile(null);
    setExistingImage('');
    setUploadStatus('');
    if (fileInput.current) fileInput.current.value = '';
    setShowQuestionForm(false);
  };

  const startEdit = (q: Question) => {
    const isEssay = q.type === 'ESSAY';
    setEditingId(q.id);
    const targetBankId = q.bankId || bankId || lecturerBanks[0]?.id || '';
    setBankId(targetBankId);
    setQuestionType(isEssay ? 'ESSAY' : 'SINGLE_CHOICE');
    setContent(q.content);
    setEssayRubric(isEssay ? (q.correctAnswer || '') : '');
    const foundBank = lecturerBanks.find((b) => b.id === targetBankId);
    setSubject(q.subject || foundBank?.subject || '');
    setTopic(q.topic || '');

    if (!isEssay) {
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
    setShowQuestionForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      return alert(t('alert_enter_question_content'));
    }

    if (questionType !== 'ESSAY') {
      if (options.length < 2) {
        return alert(t('alert_choice_min_options'));
      }
      if (options.some((o) => !o.trim())) {
        return alert(t('alert_fill_all_options'));
      }
    }

    setLoading(true);
    try {
      let imageUrl = existingImage;
      if (file) {
        setUploadStatus(t('qb_uploading_image'));
        imageUrl = await uploadQuestionImage(file);
        setUploadStatus(t('qb_upload_success'));
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
      alert(`${t('alert_save_question_error')} ${err}`);
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  const handleDelete = async (q: Question) => {
    if (!confirm(t('confirm_delete_question'))) return;
    try {
      await deleteQuestion(q.id);
      if (editingId === q.id) resetForm();
      await onRefresh();
    } catch (err) {
      alert(`${t('alert_delete_question_error')} ${err}`);
    }
  };

  const handleDeleteBank = async (bank: QuestionBank) => {
    const bankQs = lecturerQuestions.filter((q) => q.bankId === bank.id);
    const confirmMsg = `${t('confirm_delete_bank_full')} (${bank.name} - ${bankQs.length} ${t('sess_questions_unit')})`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingBankId(bank.id);
    setBanks((prev) => prev.filter((b) => b.id !== bank.id && b.bankId !== bank.id));
    if (selectedBankFilter === bank.id) {
      setSelectedBankFilter('ALL');
    }
    if (bankId === bank.id) {
      const remaining = lecturerBanks.filter((b) => b.id !== bank.id);
      if (remaining.length > 0) {
        setBankId(remaining[0].id);
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

  // Cập nhật câu prompt gợi ý mỗi khi đổi ngôn ngữ hệ thống
  useEffect(() => {
    setImportText(t('qb_ai_default_prompt', { count: importCount }));
  }, [lang]);

  const handleOpenImportModal = () => {
    const target =
      selectedBankFilter !== 'ALL'
        ? selectedBankFilter
        : bankId || lecturerBanks[0]?.id || '';
    setImportBankId(target);
    const found = lecturerBanks.find((b) => b.id === target);

    const defaultSubjectByLang: Record<string, string> = {
      de: 'Cloud Computing & Systemarchitektur',
      en: 'Cloud Computing & System Architecture',
      la: 'ຄລາວຄອມພິວຕິ້ງ ແລະ ສະຖາປັດຕະຍະກຳລະບົບ',
      vi: 'Điện toán đám mây & Kiến trúc hệ thống',
    };
    const defaultTopicByLang: Record<string, string> = {
      de: 'AWS-Systemarchitektur',
      en: 'AWS System Architecture',
      la: 'ສະຖາປັດຕະຍະກຳ AWS',
      vi: 'Kiến trúc hệ thống AWS',
    };

    setImportSubject(found?.subject || defaultSubjectByLang[lang] || defaultSubjectByLang.vi);
    setImportTopic(defaultTopicByLang[lang] || defaultTopicByLang.vi);
    setImportText(t('qb_ai_default_prompt', { count: importCount }));
    setImportError('');
    setImportSuccessMessage('');
    setExtractedQuestions([]);
    setShowImportModal(true);
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportError('');
    setImportSuccessMessage('');
    setExtractedQuestions([]);
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  };

  const handleStartImport = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setImportError('');
    setImportSuccessMessage('');
    setExtractedQuestions([]);

    if (importInputMode === 'FILE' && !importFile) {
      setImportError(t('qb_err_select_file'));
      return;
    }
    if (importInputMode === 'TEXT' && !importText.trim()) {
      setImportError(t('qb_err_enter_prompt'));
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
        bankId: importBankId || bankId || '',
        subject: importSubject.trim() || subject || (lang === 'de' ? 'Cloud Computing' : 'Điện toán đám mây'),
        topic: importTopic.trim() || topic || (lang === 'de' ? 'AWS-Systemarchitektur' : 'Kiến trúc đám mây'),
        fileBase64,
        docText,
        text: docText,
        autoSave: importAutoSave,
        model: importModel.trim() || undefined,
        apiKey: importApiKey.trim() || undefined,
        lang,
      });

      setImportSuccessMessage(
        res.message || t('qb_extract_success_msg', { count: res.count })
      );
      setExtractedQuestions(res.questions || []);

      if (importAutoSave) {
        await onRefresh();
      }
    } catch (err: any) {
      console.error('Lỗi trích xuất đề thi:', err);
      setImportError(
        err.response?.data?.error || err.message || t('qb_extract_error_msg')
      );
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar & Quick Stats */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              {t('qb_my_banks')} · {lecturerBanks.length}
            </h3>
            <p className="text-xs text-slate-500">
              {t('qb_total_label')} <span className="font-medium text-slate-700">{lecturerQuestions.length} {t('sess_questions_unit')}</span> · {t('qb_lecturer_label')}: <span className="font-medium text-slate-700">{lecturerName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenImportModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{t('qb_ai_generate_btn')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuestionForm(!showQuestionForm)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/80 transition cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>{showQuestionForm ? t('qb_cancel_edit') : t('qb_create_question')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateBankModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span>+ {t('qb_create_bank')}</span>
          </button>
        </div>
      </div>

      {/* 2. Bento Grid: Phân nhóm Ngân hàng đề thi (Trái) & Danh sách Câu hỏi (Phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Cột trái (4 cols): Danh sách ngân hàng câu hỏi */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('qb_filter_bank')}
            </span>
            <span className="text-[11px] text-slate-400">
              {lecturerBanks.length} {t('qb_categories_unit')}
            </span>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedBankFilter('ALL')}
              className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedBankFilter === 'ALL'
                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-2xs font-bold ring-1 ring-indigo-200'
                  : 'bg-slate-50/50 border-slate-200/70 text-slate-700 hover:bg-slate-100/70'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <span className="text-xs">{t('qb_all_banks')}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-semibold">
                {lecturerQuestions.length} {t('sess_questions_unit')}
              </span>
            </button>

            {lecturerBanks.map((b) => {
              const count = lecturerQuestions.filter((q) => q.bankId === b.id).length;
              const isSelected = selectedBankFilter === b.id;
              const isDeleting = deletingBankId === b.id;

              return (
                <div
                  key={b.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between group ${isSelected
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-2xs font-bold ring-1 ring-indigo-200'
                      : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBankFilter(b.id)}
                    className="flex-1 text-left min-w-0 pr-2 cursor-pointer"
                  >
                    <p className="text-xs font-semibold truncate text-slate-900">{b.name}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {getBankSubject(b.subject)} · {count} {t('sess_questions_unit')}
                    </p>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      {count}
                    </span>
                    <button
                      type="button"
                      title={t('qb_delete_bank_title')}
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBank(b);
                      }}
                      className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                    >
                      {isDeleting ? (
                        '...'
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cột phải (8 cols): Biểu mẫu thêm câu hỏi & Danh sách câu hỏi */}
        <div className="lg:col-span-8 space-y-5">
          {/* Form thêm / chỉnh sửa câu hỏi */}
          {showQuestionForm && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
                  {editingId ? t('qb_edit_question_title') : t('qb_create_question')}
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_target_bank')}</label>
                    <select
                      value={bankId}
                      onChange={(e) => handleBankChange(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 outline-none"
                      required
                    >
                      {lecturerBanks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_subject_label')}</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={t('qb_subject_placeholder')}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_topic')} *</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={t('qb_topic_placeholder')}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_question_content')} *</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-xs leading-relaxed"
                    rows={3}
                    placeholder={t('qb_content_placeholder')}
                    required
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-700">{t('qb_question_type_label')}</span>
                  <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setQuestionType('SINGLE_CHOICE')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${questionType !== 'ESSAY'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {t('qb_mode_choice')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionType('ESSAY')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${questionType === 'ESSAY'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {t('qb_mode_essay')}
                    </button>
                  </div>
                </div>

                {questionType === 'ESSAY' ? (
                  <div className="space-y-1.5 p-4 rounded-2xl border border-indigo-200 bg-white">
                    <label className="block text-xs font-bold text-indigo-900">{t('qb_essay_rubric_label')}</label>
                    <textarea
                      value={essayRubric}
                      onChange={(e) => setEssayRubric(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 text-xs leading-relaxed"
                      rows={3}
                      placeholder={t('qb_rubric_placeholder')}
                    />
                  </div>
                ) : (
                  <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-700">{t('qb_options_and_correct')}</span>
                      {options.length < 6 && (
                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="text-xs text-indigo-600 font-semibold cursor-pointer hover:underline"
                        >
                          + {t('qb_add_option_btn')} ({OPTION_LABELS[options.length]})
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {options.map((opt, i) => {
                        const isSelected = correctIndex === i;
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition ${isSelected
                                ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                                : 'bg-slate-50/50 border-slate-200'
                              }`}
                          >
                            <input
                              type="radio"
                              name="form-correct-choice"
                              checked={isSelected}
                              onChange={() => setCorrectIndex(i)}
                              className="text-emerald-600 cursor-pointer ml-1"
                            />
                            <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {OPTION_LABELS[i]}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const val = e.target.value;
                                setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
                              }}
                              placeholder={`${OPTION_LABELS[i]}...`}
                              className="flex-1 bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                            />
                            {options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(i)}
                                className="text-slate-400 hover:text-rose-600 px-1.5 cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_score_label')}</label>
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={score}
                      onChange={(e) => setScore(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_image_label')}</label>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {uploadStatus && (
                      <p className="text-[11px] text-indigo-600 font-medium mt-1">{uploadStatus}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
                  >
                    {t('qb_cancel_edit')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? t('qb_saving') : editingId ? t('qb_update_btn') : t('qb_save_btn')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Danh sách câu hỏi */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap justify-between items-center pb-2 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  {t('qb_question_list_title')} · {filteredQuestions.length}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedBankFilter === 'ALL'
                    ? t('qb_all_questions_desc')
                    : `${t('qb_bank_label')}: ${lecturerBanks.find((b) => b.id === selectedBankFilter)?.name || selectedBankFilter}`}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                {t('qb_total_score')} {filteredQuestions.reduce((sum, q) => sum + (Number(q.score) || 0), 0)} {t('qb_points_suffix')}
              </span>
            </div>

            {filteredQuestions.length === 0 && (
              <div className="text-center py-12 border border-dashed rounded-xl border-slate-200 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-700">{t('qb_empty')}</p>
                <p className="text-[11px] text-slate-400">{t('qb_empty_hint')}</p>
              </div>
            )}

            <div className="space-y-4">
              {filteredQuestions.map((q, index) => {
                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="font-medium text-slate-600 text-xs mr-2 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {t('exam_question_num')} {index + 1}
                        </span>
                        <span className="text-slate-900 text-xs font-medium leading-relaxed">
                          {q.content}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-medium px-2.5 py-0.5 rounded-md border ${q.type === 'ESSAY'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                      >
                        {q.type === 'ESSAY' ? t('qb_type_essay_badge') : t('qb_type_choice_badge')}
                      </span>
                    </div>

                    {q.imageUrl && (
                      <div className="pt-1">
                        <img
                          src={q.imageUrl}
                          alt="Question Image"
                          className="max-h-48 rounded-xl border border-slate-200 object-contain bg-slate-50 shadow-2xs"
                        />
                      </div>
                    )}

                    {q.type === 'ESSAY' ? (
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
                          <span>{t('qb_essay_rubric_label')}</span>
                        </div>
                        {q.correctAnswer ? (
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-slate-300">
                            {q.correctAnswer}
                          </p>
                        ) : (
                          <p className="text-slate-400 italic">{t('qb_no_rubric')}</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {q.options.map((opt, i) => {
                          const isCorrect = i === q.correctIndex;
                          return (
                            <div
                              key={i}
                              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition ${isCorrect
                                  ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                  }`}
                              >
                                {OPTION_LABELS[i] || String.fromCharCode(65 + i)}
                              </span>
                              <span className={`flex-1 leading-relaxed ${isCorrect ? 'text-emerald-950 font-medium' : 'text-slate-700'}`}>
                                {opt}
                              </span>
                              {isCorrect && (
                                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md shrink-0">
                                  {t('qb_correct_answer_badge')}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(q)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer font-semibold text-xs"
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(q)}
                          className="px-3 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition cursor-pointer font-semibold text-xs"
                        >
                          {t('delete')}
                        </button>
                      </div>

                      <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px]">
                        {q.score} {t('qb_points_suffix')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tạo Ngân Hàng Mới */}
      {showCreateBankModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
                {t('qb_create_bank_modal_title')}
              </h4>
              <button
                type="button"
                onClick={() => setShowCreateBankModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateBank} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('qb_bank_name_label')} *
                </label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder={t('qb_bank_name_label')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('qb_subject_label')} *
                </label>
                <input
                  type="text"
                  value={newBankSubject}
                  onChange={(e) => setNewBankSubject(e.target.value)}
                  placeholder={t('qb_subject_label')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('qb_desc_label')}
                </label>
                <textarea
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder={t('qb_desc_label')}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBankModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 cursor-pointer font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingBank}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {creatingBank ? t('qb_creating_bank') : t('qb_create_bank_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nhập Đề Thi / Soạn Bằng AI */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
              <div>
                <h4 className="text-base font-semibold text-slate-900 tracking-tight">{t('qb_import_modal_title')}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('qb_import_modal_desc')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseImportModal}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Chọn ngân hàng mục tiêu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_target_bank')}</label>
                  <select
                    value={importBankId}
                    onChange={(e) => {
                      setImportBankId(e.target.value);
                      const f = lecturerBanks.find((b) => b.id === e.target.value);
                      if (f?.subject) setImportSubject(f.subject);
                    }}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none"
                  >
                    {lecturerBanks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_subject')}</label>
                  <input
                    type="text"
                    value={importSubject}
                    onChange={(e) => setImportSubject(e.target.value)}
                    placeholder={t('qb_subject_placeholder')}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qb_topic')}</label>
                  <input
                    type="text"
                    value={importTopic}
                    onChange={(e) => setImportTopic(e.target.value)}
                    placeholder={t('qb_topic_placeholder')}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Chế độ nhập: File Word vs Prompt */}
              <div className="space-y-3">
                <div className="flex border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setImportInputMode('TEXT')}
                    className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
                      importInputMode === 'TEXT'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('qb_ai_prompt_mode')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportInputMode('FILE')}
                    className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
                      importInputMode === 'FILE'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('qb_upload_file_mode')}
                  </button>
                </div>

                {importInputMode === 'TEXT' ? (
                  <div className="space-y-3">
                    {/* Chọn số lượng câu hỏi */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                      <span className="text-xs font-semibold text-slate-700">{t('qb_ai_num_questions_label')}:</span>
                      <div className="flex items-center gap-1.5">
                        {[5, 10, 15, 20, 25].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => {
                              setImportCount(cnt);
                              setImportText(
                                t('qb_ai_default_prompt', { count: cnt }) ||
                                `Tạo ${cnt} câu hỏi trắc nghiệm chuyên sâu về điện toán đám mây AWS (bao gồm EC2, S3, Lambda, DynamoDB, VPC). Mỗi câu có 4 phương án A, B, C, D và chỉ rõ đáp án đúng.`
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              importCount === cnt
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {cnt} {t('sess_questions_unit')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder={t('qb_import_prompt_placeholder')}
                      rows={5}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-sans leading-relaxed"
                    />
                  </div>
                ) : (
                  <div className="p-6 border border-dashed border-slate-300 rounded-xl text-center bg-slate-50 hover:bg-slate-100/70 transition">
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
                    <label htmlFor="doc-file-upload-input" className="cursor-pointer space-y-2 block">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        {importFile ? importFile.name : t('qb_ai_select_file')}
                      </p>
                      <p className="text-[11px] text-slate-400">{t('qb_ai_file_hint')}</p>
                    </label>
                  </div>
                )}
              </div>

              {/* Cấu hình kết nối Google Gemini AI */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{t('qb_gemini_config')}</span>
                  </span>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium border ${
                    importApiKey
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {geminiKeyTestResult?.ok ? t('qb_gemini_connected') : t('qb_gemini_not_configured')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-8">
                    <input
                      type="password"
                      value={importApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder={t('qb_gemini_api_key_placeholder')}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none focus:border-indigo-400 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <select
                      value={importModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none"
                    >
                      <option value="gemini-3.8-flash">gemini-3.8-flash · {t('qb_model_gemini_38')}</option>
                      <option value="gemini-3.7-flash">gemini-3.7-flash · {t('qb_model_gemini_37')}</option>
                      <option value="gemini-3.6-flash">gemini-3.6-flash · {t('qb_model_gemini_36')}</option>
                      <option value="gemini-3.5-flash">gemini-3.5-flash · {t('qb_model_gemini_35')}</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash · {t('qb_model_default')}</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash · {t('qb_model_standard')}</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash · {t('qb_model_preview')}</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro · {t('qb_model_pro')}</option>
                      <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite · {t('qb_model_lite')}</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestGeminiKey}
                    disabled={testingGeminiKey}
                    className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {testingGeminiKey ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        {t('qb_gemini_testing')}
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {t('qb_gemini_test_btn')}
                      </>
                    )}
                  </button>

                  {geminiKeyTestResult && (
                    <span
                      className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                        geminiKeyTestResult.ok ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {geminiKeyTestResult.ok
                        ? t('qb_gemini_test_ok', { model: geminiKeyTestResult.message.split(':')[1] || importModel })
                        : t(`qb_gemini_${geminiKeyTestResult.message}`)}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500">
                  {importApiKey ? t('qb_gemini_active_hint') : t('qb_gemini_fallback_hint')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-auto-save"
                  checked={importAutoSave}
                  onChange={(e) => setImportAutoSave(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="chk-auto-save" className="text-xs text-slate-700 cursor-pointer font-medium">
                  {t('qb_auto_save_check')}
                </label>
              </div>

              {importError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {importError}
                </div>
              )}

              {importSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {extractedQuestions.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-900 block">
                    {t('qb_ai_extracted_list')} · {extractedQuestions.length} {t('sess_questions_unit')}
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {extractedQuestions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                        <p className="font-semibold text-slate-900">
                          {t('qb_question_item_label')} {idx + 1}: {q.content}
                        </p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          {t('qb_correct_answer')}: {q.correctAnswer || (q.options && q.options[q.correctIndex || 0])}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseImportModal}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
              >
                {extractedQuestions.length > 0 ? t('complete') : t('cancel')}
              </button>
              <button
                type="button"
                disabled={importLoading}
                onClick={handleStartImport}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {importLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>{t('qb_extracting_btn')}</span>
                  </>
                ) : (
                  <span>{t('qb_extract_btn')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
