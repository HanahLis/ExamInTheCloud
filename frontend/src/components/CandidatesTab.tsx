import { useRef, useState, useMemo, type FormEvent } from 'react';
import { uploadFaceImage } from '../services/s3Service';
import type { Candidate } from '../services/apiService';
import { useTranslation } from '../locales/i18nContext';

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
  const { t } = useTranslation();
  const [studentCode, setStudentCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [className, setClassName] = useState('');
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleImageChange = (file: File | null) => {
    setFaceImage(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setFacePreview(url);
    } else {
      setFacePreview(null);
    }
  };

  const handleAddCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!faceImage) return alert(t('alert_select_face_image'));
    if (candidates.some((c) => c.email.toLowerCase() === email.trim().toLowerCase())) {
      return alert(t('alert_email_exists'));
    }
    if (
      studentCode.trim() &&
      candidates.some(
        (c) => (c.studentCode || '').trim().toLowerCase() === studentCode.trim().toLowerCase()
      )
    ) {
      return alert(t('alert_student_code_exists') || `Mã sinh viên '${studentCode.trim()}' đã tồn tại.`);
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
      setFacePreview(null);
      if (fileInput.current) fileInput.current.value = '';
      setShowAddForm(false);
    } catch (err: any) {
      alert(`${t('alert_add_candidate_error')} ${err?.response?.data?.error || err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (cEmail: string, cName: string) => {
    if (!confirm(`${t('confirm_delete_candidate')} (${cName})`)) return;
    setDeletingEmail(cEmail);
    try {
      await onRemoveCandidate(cEmail);
    } catch (err: any) {
      alert(`${t('alert_delete_candidate_error')} ${err?.response?.data?.error || err?.message || err}`);
    } finally {
      setDeletingEmail(null);
    }
  };

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase().trim();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.studentCode || '').toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.className || '').toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Action Bar & Summary */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {t('cand_title')} ({candidates.length})
            </h3>
            <p className="text-xs text-slate-500">
              {t('cand_desc')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-200/60 transition cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{t('refresh')}</span>
            </button>
          )}

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs shadow-indigo-200 transition cursor-pointer flex items-center gap-1.5 active:scale-[0.99]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={showAddForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
            <span>{showAddForm ? t('cand_close_form') : t('cand_add_btn')}</span>
          </button>
        </div>
      </div>

      {/* Form thêm thí sinh mới (Pastel Soft Panel) */}
      {showAddForm && (
        <div className="bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-sky-50/30 p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">{t('cand_add_title')}</h4>
              <p className="text-xs text-slate-500">{t('cand_add_desc')}</p>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleAddCandidate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('cand_table_code')} *</label>
              <input
                type="text"
                placeholder={t('cand_eg_code')}
                value={studentCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setStudentCode(val);
                  if (!email || email.endsWith('@vnu.edu.vn')) {
                    setEmail(val.trim() ? `${val.trim().toLowerCase()}@vnu.edu.vn` : '');
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-xs transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('cand_table_name')} *</label>
              <input
                type="text"
                placeholder={t('cand_eg_name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-xs transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('cand_table_email')} *</label>
              <input
                type="email"
                placeholder={t('cand_eg_email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-xs transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('cand_table_unit')}</label>
              <input
                type="text"
                placeholder={t('cand_eg_unit')}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-xs transition"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('cand_table_avatar')} {t('cand_avatar_hint')} *
              </label>
              <div className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-2xl">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold hover:file:bg-indigo-100 cursor-pointer"
                  required
                />
                {facePreview && (
                  <div className="flex items-center gap-2 shrink-0">
                    <img
                      src={facePreview}
                      alt="Preview"
                      className="w-10 h-10 rounded-full object-cover border-2 border-indigo-200 shadow-xs"
                    />
                    <span className="text-[11px] text-emerald-600 font-semibold">{t('cand_image_uploaded')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition cursor-pointer"
              >
                {t('cand_cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>{t('cand_saving')}</span>
                  </span>
                ) : (
                  t('cand_save_btn')
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách Thí sinh (Pastel Card & Search) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Thanh tìm kiếm */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('cand_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>

          <span className="text-xs text-slate-400 font-medium">
            {t('cand_display_count')} {filteredCandidates.length}/{candidates.length} {t('cand_candidates_label')}
          </span>
        </div>

        {loading && (
          <div className="py-8 text-center text-xs text-slate-400">
            <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mr-2 align-middle"></span>
            {t('cand_loading')}
          </div>
        )}

        {filteredCandidates.length === 0 && !loading && (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-600">{t('cand_not_found')}</p>
            <p className="text-[11px] text-slate-400">{t('cand_not_found_hint')}</p>
          </div>
        )}

        {/* Danh sách Card Thí sinh Pastel */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCandidates.map((c) => (
            <div
              key={c.email}
              className="p-3.5 rounded-2xl border border-slate-200/70 bg-white hover:border-indigo-200 hover:shadow-sm transition-all duration-200 flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={c.faceImageUrl}
                    alt={c.name}
                    className="h-11 w-11 rounded-2xl object-cover border border-slate-200/80 bg-slate-100 shadow-2xs group-hover:scale-105 transition"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      const fileBase = c.studentCode === 'GV001' ? 'annv' : c.studentCode;
                      const fallbackUrl = `/sample_faces/${fileBase}.jpg`;
                      if (!img.src.includes(fallbackUrl)) {
                        img.src = fallbackUrl;
                      } else {
                        img.src =
                          'https://ui-avatars.com/api/?name=' +
                          encodeURIComponent(c.name) +
                          '&background=e0e7ff&color=4338ca&rounded=true';
                      }
                    }}
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-white"></span>
                </div>

                <div className="min-w-0">
                  <h5 className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-600 transition">
                    {c.name}
                  </h5>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {c.studentCode || 'N/A'}
                    </span>
                    {c.className && (
                      <span className="text-[10px] text-slate-500 truncate">
                        • {c.className}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                    {c.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={c.faceImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-xl bg-slate-100/70 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition cursor-pointer"
                  title={t('cand_view_photo')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </a>

                <button
                  onClick={() => handleRemove(c.email, c.name)}
                  disabled={deletingEmail === c.email}
                  className="w-8 h-8 rounded-xl bg-slate-100/70 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer disabled:opacity-30"
                  title={t('cand_delete_title')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
