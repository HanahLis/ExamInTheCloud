import { useEffect, useRef, useState } from 'react';
import {
  getSession,
  getExamPaper,
  getCandidates,
  verifyFace,
  saveExamProgress,
  submitExam,
  updateSessionCandidates,
  requestFacePresignedUrl,
  requestPresignedUploadUrl,
  uploadBinaryToS3,
  resolveSessionStatus,
  DEFAULT_CANDIDATES,
  type ExamSession,
  type Question,
  type Candidate,
  type FaceVerifyResponse,
  type ExamSubmitResult,
} from '../services/apiService';
import { useTranslation } from '../locales/i18nContext';
import { TurnstileCaptcha } from './TurnstileCaptcha';
import { LiveLeaderboard } from './LiveLeaderboard';

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
const TURNSTILE_DEV_TOKEN = '1x0000000000000000000000000000000AA';

interface Props {
  sessionId: string;
  currentUserEmail?: string;
  isOrganizer?: boolean;
  onExit: () => void;
}

type ExamStep = 'FACE_VERIFY' | 'IN_EXAM' | 'COMPLETED';

export const ExamRoom = ({ sessionId, currentUserEmail = '', isOrganizer = false, onExit }: Props) => {
  const { t, lang } = useTranslation();
  const dateLocale = lang === 'en' ? 'en-US' : lang === 'de' ? 'de-DE' : lang === 'la' ? 'lo-LA' : 'vi-VN';
  const [session, setSession] = useState<ExamSession | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [step, setStep] = useState<ExamStep>('FACE_VERIFY');
  const [candidateEmail, setCandidateEmail] = useState(currentUserEmail);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<FaceVerifyResponse | null>(null);

  // Tiến trình làm bài và lưu ngầm lên Cloud (Local-First & Throttled Sync)
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const dirtyCountRef = useRef<number>(0);
  const lastSyncAnswersRef = useRef<Record<string, number | string>>({});

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<ExamSubmitResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(45 * 60);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  // Tải đề thi an toàn và nạp lại bài nháp
  useEffect(() => {
    let isMounted = true;
    const loadSessionData = async () => {
      setLoadingSession(true);
      setErrorMsg(null);
      try {
        const [s, paperData, allCandidates] = await Promise.all([
          getSession(sessionId),
          getExamPaper(sessionId).catch(() => null),
          getCandidates(),
        ]);
        if (!isMounted) return;
        setSession(s);
        setCandidates(allCandidates);

        if (currentUserEmail && !isOrganizer) {
          setCandidateEmail(currentUserEmail);
        } else if (s.candidateEmails && s.candidateEmails.length > 0) {
          if (!candidateEmail || !s.candidateEmails.some((e) => e.toLowerCase() === candidateEmail.toLowerCase())) {
            setCandidateEmail(s.candidateEmails[0]);
          }
        } else if (allCandidates.length > 0 && !candidateEmail) {
          setCandidateEmail(allCandidates[0].email);
        }

        if (paperData && paperData.questions && paperData.questions.length > 0) {
          setSessionQuestions(paperData.questions);
          const localDraftKey = `cloudexam_draft_${sessionId}_${candidateEmail}`;
          let restoredAnswers = paperData.draftAnswers || {};
          let draftSource = 'Cloud';

          try {
            const localSaved = localStorage.getItem(localDraftKey);
            if (localSaved) {
              const parsedLocal = JSON.parse(localSaved);
              if (parsedLocal.answers && Object.keys(parsedLocal.answers).length >= Object.keys(restoredAnswers).length) {
                restoredAnswers = parsedLocal.answers;
                draftSource = t('exam_draft_device');
              }
            }
          } catch (e) {
            console.warn('Lỗi đọc local draft:', e);
          }

          if (Object.keys(restoredAnswers).length > 0) {
            setAnswers(restoredAnswers);
            answersRef.current = restoredAnswers;
            lastSyncAnswersRef.current = { ...restoredAnswers };
            setLastSavedTime(`${t('exam_draft_loaded')} ${draftSource}`);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to load exam session');
      } finally {
        if (isMounted) setLoadingSession(false);
      }
    };
    loadSessionData();
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [sessionId]);

  // Đồng hồ đếm ngược thời gian làm bài
  useEffect(() => {
    if (step !== 'IN_EXAM') return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Bộ đệm đồng bộ định kỳ 60 giây
  useEffect(() => {
    if (step !== 'IN_EXAM') return;
    const syncInterval = setInterval(() => {
      if (dirtyCountRef.current > 0) {
        syncDraftToCloud();
      }
    }, 60000);
    return () => clearInterval(syncInterval);
  }, [step, sessionId, candidateEmail]);

  const syncDraftToCloud = async (currentAnswers = answersRef.current) => {
    if (isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      await saveExamProgress(sessionId, currentAnswers, candidateEmail);
      dirtyCountRef.current = 0;
      lastSyncAnswersRef.current = { ...currentAnswers };
      const now = new Date();
      setLastSavedTime(
        `${t('exam_saved_at')} ${now.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      );
    } catch (err) {
      console.warn('Lỗi đồng bộ nháp:', err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    const updated = { ...answers, [questionId]: optionIndex };
    setAnswers(updated);
    answersRef.current = updated;

    const localDraftKey = `cloudexam_draft_${sessionId}_${candidateEmail}`;
    try {
      localStorage.setItem(localDraftKey, JSON.stringify({
        answers: updated,
        updatedAt: new Date().toISOString()
      }));
      setLastSavedTime(t('exam_auto_saved'));
    } catch (e) {
      console.warn('Lỗi ghi localStorage:', e);
    }

    dirtyCountRef.current += 1;
    if (dirtyCountRef.current >= 10) {
      syncDraftToCloud(updated);
    }
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    const updated = { ...answers, [questionId]: text };
    setAnswers(updated);
    answersRef.current = updated;

    const localDraftKey = `cloudexam_draft_${sessionId}_${candidateEmail}`;
    try {
      localStorage.setItem(localDraftKey, JSON.stringify({
        answers: updated,
        updatedAt: new Date().toISOString()
      }));
      setLastSavedTime(t('exam_auto_saved'));
    } catch (e) {
      console.warn('Lỗi ghi localStorage:', e);
    }

    dirtyCountRef.current += 1;
    if (dirtyCountRef.current >= 10) {
      syncDraftToCloud(updated);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (e) {
      alert(`${t('alert_camera_error')} (${e})`);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const toggleMirror = () => {
    setIsMirrored((prev) => !prev);
    if (capturedImage && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
          const b64 = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedImage(b64);
          canvas.toBlob((blob) => {
            if (blob) setCapturedBlob(blob);
          }, 'image/jpeg', 0.85);
        }
      };
      img.src = capturedImage;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      const b64 = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(b64);
      canvas.toBlob((blob) => {
        if (blob) setCapturedBlob(blob);
      }, 'image/jpeg', 0.85);
      stopCamera();
    }
  };

  const handleVerifyFace = async () => {
    if (!capturedImage) return alert(t('alert_capture_face_required'));
    if (!candidateEmail) return alert(t('alert_select_candidate_required'));

    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const localTokenKey = `cloudexam_cand_token_${sessionId}_${candidateEmail.toLowerCase()}`;
      const existingDevToken = localStorage.getItem(localTokenKey) || '';

      let s3Key = '';
      if (capturedBlob) {
        try {
          const matchedCand =
            candidates.find((c) => c.email.toLowerCase() === candidateEmail.toLowerCase()) ||
            (session as any)?.candidates?.find((c: any) => c.email.toLowerCase() === candidateEmail.toLowerCase()) ||
            DEFAULT_CANDIDATES.find((c) => c.email.toLowerCase() === candidateEmail.toLowerCase());
          const studentCode = matchedCand?.studentCode || candidateEmail.split('@')[0];
          const facePresign = await requestFacePresignedUrl(sessionId, studentCode);
          if (facePresign && facePresign.uploadUrl) {
            await uploadBinaryToS3(facePresign.uploadUrl, capturedBlob, 'image/jpeg');
            s3Key = facePresign.s3Key || '';
          }
        } catch (faceErr) {
          console.warn('Lỗi lấy face-presign, fallback sang presigned thông thường:', faceErr);
          try {
            const presign = await requestPresignedUploadUrl({
              fileName: `verify_${candidateEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`,
              contentType: 'image/jpeg',
              prefix: 'faces',
            });
            if (presign && presign.uploadUrl) {
              await uploadBinaryToS3(presign.uploadUrl, capturedBlob, 'image/jpeg');
              s3Key = presign.s3Key || '';
            }
          } catch (s3Err) {
            console.warn('Upload ảnh gặp sự cố, fallback sang truyền Base64:', s3Err);
          }
        }
      }

      const result = await verifyFace({
        sessionId,
        capturedImage: s3Key ? undefined : capturedImage,
        capturedS3Key: s3Key || undefined,
        email: candidateEmail,
        roomPassword: session?.roomPassword || '123456',
        deviceToken: existingDevToken || undefined,
      });

      if (result.verified) {
        const finalToken = result.deviceToken || existingDevToken || `tok_${Date.now()}`;
        localStorage.setItem(localTokenKey, finalToken);
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            lockedCandidates: {
              ...(prev.lockedCandidates || {}),
              [candidateEmail.toLowerCase()]: {
                locked: true,
                deviceToken: finalToken,
                candidateName: currentCandidateObj?.name || candidateEmail,
                lockedAt: new Date().toISOString(),
              },
            },
          };
        });
      }

      setVerifyResult(result);
    } catch (err: any) {
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || t('face_verify_failed');
      if (msg === 'Forbidden' || err?.response?.status === 403) {
        msg = err?.response?.data?.message || t('face_mismatch_desc');
      }
      setVerifyResult({
        status: 'FAIL',
        verified: false,
        similarity: 0,
        message: msg,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmitExam = async (isAutoSubmit = false) => {
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      if (!isAutoSubmit) {
        alert(t('exam_turnstile_required'));
        return;
      }
    }
    if (!isAutoSubmit && !confirm(t('exam_submit_confirm'))) return;
    setIsSubmitting(true);
    try {
      await syncDraftToCloud(answersRef.current || answers);
      const res = await submitExam({
        sessionId,
        answers: answersRef.current || answers,
        candidateEmail,
        turnstileToken: turnstileToken || (TURNSTILE_SITE_KEY ? '' : TURNSTILE_DEV_TOKEN),
      });
      setSubmitResult(res.result);
      setStep('COMPLETED');
      if (isAutoSubmit) {
        alert(t('alert_time_up_auto_submit'));
      }
    } catch (err: any) {
      alert(`${t('alert_submit_exam_error')} ${err?.response?.data?.error || err?.message || err}`);
      setTurnstileToken('');
      setTurnstileResetKey((k) => k + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentCandidateObj =
    candidates.find((c) => c.email.toLowerCase() === candidateEmail.toLowerCase()) ||
    (session as any)?.candidates?.find(
      (c: any) => c.email.toLowerCase() === candidateEmail.toLowerCase()
    ) ||
    DEFAULT_CANDIDATES.find((c) => c.email.toLowerCase() === candidateEmail.toLowerCase());

  if (loadingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <span className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></span>
        <p className="text-xs text-slate-500 font-medium">{t('exam_loading_info')}</p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-3xl border border-slate-200/80 shadow-md text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-800">{t('exam_not_found')}</h2>
        <p className="text-xs text-slate-600">{errorMsg || t('exam_invalid_id')}</p>
        <button
          onClick={onExit}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          {t('exam_back')}
        </button>
      </div>
    );
  }

  const currentStatus = resolveSessionStatus(session.status, session.startTime, session.endTime);
  const statusStyles: Record<string, string> = {
    RUNNING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
    CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const statusKeys: Record<string, string> = {
    RUNNING: 'sess_status_running',
    SCHEDULED: 'sess_status_scheduled',
    CLOSED: 'sess_status_closed',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Tiêu đề ca thi & Header điều khiển */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
              #{session.id}
            </span>
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusStyles[currentStatus] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
            >
              {t(statusKeys[currentStatus] || 'sess_status_scheduled')}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {session.id === 'EX-VNU-2026-01' ? t('default_session_exam_name') : session.name}
          </h2>
          <p className="text-xs text-slate-500">
            {sessionQuestions.length} {t('sess_questions_unit')} • {t('exam_candidate_label')} <span className="font-semibold text-slate-700">{currentCandidateObj?.name || candidateEmail}</span>
            {currentCandidateObj?.studentCode && <span className="font-mono text-indigo-700"> ({currentCandidateObj.studentCode})</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {step === 'IN_EXAM' && (
            <div className="flex items-center gap-3 bg-indigo-50/70 px-4 py-2 rounded-2xl border border-indigo-100/80">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 flex items-center justify-end gap-1 font-medium">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSavingDraft ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></span>
                  {isSavingDraft ? t('exam_syncing_cloud') : (lastSavedTime || t('exam_auto_save_local'))}
                </span>
                <span className={`text-base font-mono font-bold ${timeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-indigo-900'}`}>
                  {formatTimer(timeLeft)}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={onExit}
            className="text-xs text-slate-600 hover:text-slate-900 px-3.5 py-2 border border-slate-200/80 rounded-xl hover:bg-slate-50 transition cursor-pointer font-medium flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>{t('exam_exit_room')}</span>
          </button>
        </div>
      </div>

      {/* Thông báo trạng thái ca thi */}
      {currentStatus === 'SCHEDULED' && (
        <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-center gap-2.5 shadow-2xs">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">ℹ</span>
          <span>{t('exam_status_scheduled_msg')}</span>
        </div>
      )}

      {currentStatus === 'CLOSED' && (
        <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-700 flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">✕</span>
          <span>{t('exam_status_closed_msg')}</span>
        </div>
      )}

      {/* BƯỚC 1: XÁC THỰC KHUÔN MẶT SINH TRẮC HỌC */}
      {step === 'FACE_VERIFY' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="border-b border-indigo-100/60 pb-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {t('exam_biometric_title')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('exam_biometric_desc')}
              </p>
            </div>
          </div>

          <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/60 space-y-3">
            {isOrganizer ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('exam_select_preview_cand')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const sessionEmails = session.candidateEmails || [];
                    const allEmails = Array.from(new Set([...sessionEmails, ...candidates.map((c) => c.email)]));
                    return allEmails.map((email) => {
                      const cand = candidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
                      const isSelected = candidateEmail.toLowerCase() === email.toLowerCase();
                      const isAssigned = sessionEmails.some((e) => e.toLowerCase() === email.toLowerCase());
                      return (
                        <button
                          key={email}
                          type="button"
                          onClick={() => {
                            setCandidateEmail(email);
                            if (!isAssigned) {
                              updateSessionCandidates(sessionId, [...sessionEmails, email]).catch(() => {});
                            }
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition cursor-pointer font-medium ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>{cand ? cand.name : email}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-500">{t('exam_candidate_label')}</span>
                <span className="font-bold text-slate-900">{currentCandidateObj?.name || candidateEmail}</span>
                {currentCandidateObj?.studentCode && (
                  <span className="text-indigo-700 font-mono font-semibold">({currentCandidateObj.studentCode})</span>
                )}
                <span className="text-slate-400 font-mono text-[11px]">[{candidateEmail}]</span>
              </div>
            )}

            <div className="pt-2 border-t border-indigo-100/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{t('exam_biometric_algo')}</span>
              </span>
              <span className="font-medium">
                {t('exam_threshold_label')} <span className="font-mono font-bold text-indigo-700">&ge; 80%</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Ảnh hồ sơ sinh viên */}
            <div className="space-y-2 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 text-center">
              <div className="text-xs text-slate-700 font-bold">
                {t('exam_profile_photo')}
              </div>
              <div className="aspect-[3/4] max-w-[240px] mx-auto bg-slate-200/80 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200 shadow-inner">
                {currentCandidateObj?.faceImageUrl ? (
                  <img
                    src={currentCandidateObj.faceImageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      const fileBase =
                        currentCandidateObj.studentCode === 'GV001'
                          ? 'annv'
                          : currentCandidateObj.studentCode;
                      const fallbackUrl = `/sample_faces/${fileBase}.jpg`;
                      if (!img.src.includes(fallbackUrl)) {
                        img.src = fallbackUrl;
                      } else {
                        img.src =
                          'https://ui-avatars.com/api/?name=' +
                          encodeURIComponent(currentCandidateObj.name) +
                          '&background=e0e7ff&color=4338ca&size=256';
                      }
                    }}
                  />
                ) : (
                  <span className="text-xs text-slate-400">{t('exam_no_profile_photo')}</span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-medium">
                {currentCandidateObj?.name} ({currentCandidateObj?.studentCode})
              </p>
            </div>

            {/* Webcam Thí sinh trực tiếp */}
            <div className="space-y-2 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 text-center">
              <div className="text-xs text-slate-700 font-bold">
                {t('exam_webcam_photo')}
              </div>

              <div className="aspect-[3/4] max-w-[240px] mx-auto bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner relative group">
                {/* Nút lật gương / Đảo chiều nhanh góc trên bên phải */}
                <button
                  type="button"
                  onClick={toggleMirror}
                  className="absolute top-2.5 right-2.5 z-20 px-2 py-1 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-md transition cursor-pointer border border-white/20 active:scale-95"
                  title={t('exam_camera_mirror_title')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>{isMirrored ? t('exam_camera_mirror') : t('exam_camera_normal')}</span>
                </button>

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-transform duration-200 ${cameraActive ? "block" : "hidden"} ${isMirrored ? "-scale-x-100" : "scale-x-100"}`}
                />

                {capturedImage && !cameraActive && (
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                )}

                {!cameraActive && !capturedImage && (
                  <div className="text-center text-slate-400 p-4 space-y-1">
                    <svg className="w-8 h-8 mx-auto text-slate-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    <span className="text-xs block">{t('exam_camera_not_active')}</span>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    className="py-1.5 px-3.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                  >
                    {t('exam_open_camera')}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="py-1.5 px-3.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                    >
                      {t('exam_capture_photo')}
                    </button>
                    <button
                      onClick={stopCamera}
                      className="py-1.5 px-3.5 bg-slate-600 text-white rounded-xl text-xs font-medium hover:bg-slate-700 transition cursor-pointer"
                    >
                      {t('exam_close_camera')}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={toggleMirror}
                  className="py-1.5 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title={t('exam_camera_mirror_title')}
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>{t('exam_camera_flip')}</span>
                  <span className="text-[10px] text-indigo-600 font-bold font-mono">({isMirrored ? t('exam_camera_mirror') : t('exam_camera_normal')})</span>
                </button>
              </div>

              {/* Thông báo bắt buộc chụp trực tiếp từ camera (không cho up ảnh từ máy) */}
              <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-center justify-center gap-1.5 font-medium">
                <span className="text-amber-600">📸</span>
                <span>{t('exam_camera_only_notice')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleVerifyFace}
              disabled={!capturedImage || isVerifying}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-2xl shadow-sm shadow-indigo-200 disabled:opacity-40 transition cursor-pointer text-xs active:scale-[0.99]"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{t('exam_camera_capturing')}</span>
                </span>
              ) : (
                t('exam_camera_verify_btn')
              )}
            </button>

            {verifyResult && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  verifyResult.verified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="font-bold flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${verifyResult.verified ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'}`}>
                    {verifyResult.verified ? '✓' : '✕'}
                  </span>
                  <span>{verifyResult.verified ? t('exam_camera_success') : t('exam_camera_failed')}</span>
                </div>
                {verifyResult.verified && (
                  <div className="px-3 py-1.5 bg-emerald-100/70 border border-emerald-300 rounded-xl text-emerald-900 font-semibold text-[11px] flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>{t('exam_account_locked_success')}</span>
                  </div>
                )}
                <p className="leading-relaxed text-slate-600">{verifyResult.message}</p>
                {verifyResult.similarity > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-600">
                      <span>{t('exam_similarity_label')}</span>
                      <span className="font-mono font-bold">{verifyResult.similarity}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${verifyResult.verified ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, verifyResult.similarity)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {verifyResult.verified && (
                  currentStatus === 'RUNNING' ? (
                    <button
                      onClick={() => setStep('IN_EXAM')}
                      className="mt-3 w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl text-xs hover:from-emerald-500 hover:to-teal-500 transition cursor-pointer shadow-xs active:scale-[0.99]"
                    >
                      {t('start_exam_btn')}
                    </button>
                  ) : currentStatus === 'SCHEDULED' ? (
                    <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-center font-medium text-xs">
                      {t('exam_wait_lecturer_start')}
                    </div>
                  ) : (
                    <div className="mt-3 p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-center font-medium text-xs">
                      {t('exam_session_finished')}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BƯỚC 2: LÀM BÀI THI */}
      {step === 'IN_EXAM' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-4 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {t('exam_multiple_choice_title')} ({sessionQuestions.length} {t('sess_questions_unit')})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('exam_question_answered_stat')}: <span className="font-bold text-indigo-700">{Object.keys(answers).length}</span>/{sessionQuestions.length} {t('sess_questions_unit')}
              </p>
            </div>
            <button
              onClick={() => handleSubmitExam(false)}
              disabled={isSubmitting}
              className="py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs shadow-xs shadow-emerald-200 disabled:opacity-40 transition cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? t('exam_submitting_btn') : t('exam_submit_btn')}
            </button>
          </div>

          <div className="space-y-5">
            {sessionQuestions.map((q, idx) => {
              const selectedOpt = answers[q.id];
              return (
                <div
                  key={q.id}
                  className="p-5 rounded-2xl border border-slate-200/80 space-y-3 bg-slate-50/40 hover:bg-white hover:border-indigo-200 transition-all duration-200"
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-medium text-slate-900 text-xs leading-relaxed">
                      <span className="font-bold text-indigo-700 mr-2 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                        {t('exam_question_num')} {idx + 1}
                      </span>
                      {q.content}
                    </p>
                    <span className="text-[11px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                      {q.score} {t('exam_points_unit')}
                    </span>
                  </div>

                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt="Question Image"
                      className="max-h-48 rounded-xl border border-slate-200 object-contain bg-white shadow-2xs"
                    />
                  )}

                  {q.type === 'ESSAY' ? (
                    <div className="pt-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                        {t('exam_essay_prompt')}
                      </label>
                      <textarea
                        value={typeof answers[q.id] === 'string' ? answers[q.id] : ''}
                        onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                        placeholder={t('exam_essay_placeholder_room')}
                        rows={5}
                        className="w-full p-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 leading-relaxed font-sans transition"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const label = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || `${optIdx + 1}`;
                        const isChecked = selectedOpt === optIdx;
                        return (
                          <label
                            key={optIdx}
                            onClick={() => handleSelectOption(q.id, optIdx)}
                            className={`flex items-center space-x-3 p-3 rounded-2xl border cursor-pointer text-xs transition-all duration-150 ${
                              isChecked
                                ? 'bg-indigo-50/80 border-indigo-400 font-semibold text-indigo-900 shadow-2xs ring-1 ring-indigo-200'
                                : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              checked={isChecked}
                              onChange={() => handleSelectOption(q.id, optIdx)}
                              className="text-indigo-600 focus:ring-indigo-300"
                            />
                            <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {label}
                            </span>
                            <span className="flex-1 leading-snug">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            {TURNSTILE_SITE_KEY && (
              <div className="flex flex-col items-center gap-2 p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl">
                <p className="text-xs font-semibold text-slate-700">{t('exam_turnstile_verify_label')}</p>
                <TurnstileCaptcha
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken('')}
                  resetKey={turnstileResetKey}
                />
                <p className={`text-[11px] font-medium ${turnstileToken ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {turnstileToken ? `✓ ${t('exam_turnstile_verified')}` : t('exam_turnstile_protected')}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => handleSubmitExam(false)}
                disabled={isSubmitting || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
                className="py-3 px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-2xl text-xs shadow-md shadow-emerald-200 disabled:opacity-40 transition cursor-pointer active:scale-[0.99]"
              >
                {isSubmitting ? t('exam_submitting_btn') : t('exam_submit_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BẢNG XẾP HẠNG TRỰC TIẾP (Upstash Serverless Redis / DynamoDB Fallback) */}
      {(step === 'IN_EXAM' || step === 'COMPLETED') && (
        <LiveLeaderboard sessionId={sessionId} currentEmail={candidateEmail} />
      )}

      {/* BƯỚC 3: HOÀN THÀNH */}
      {step === 'COMPLETED' && submitResult && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('exam_complete_title')}</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {t('exam_submitted_desc')}
            </p>
          </div>

          <div className="max-w-sm mx-auto bg-slate-50/80 border border-slate-200/80 p-6 rounded-2xl space-y-4">
            <div>
              <div className="text-4xl font-extrabold text-indigo-700">
                {submitResult.score} <span className="text-lg font-normal text-slate-400">/ {submitResult.maxScore}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">
                {t('res_correct_count')}: {submitResult.correctCount} / {submitResult.totalQuestions} {t('sess_questions_unit')}
              </p>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 pt-3 border-t border-slate-200/70 text-left">
              <p>
                <span className="text-slate-400">{t('exam_candidate_label')}</span>{' '}
                <span className="font-semibold text-slate-800">{submitResult.candidateEmail || candidateEmail}</span>
              </p>
              <p>
                <span className="text-slate-400">{t('sess_title')}:</span> #{submitResult.sessionId}
              </p>
              <p>
                <span className="text-slate-400">{t('exam_submitted_at')}</span>{' '}
                {new Date(submitResult.submittedAt).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={onExit}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer active:scale-[0.99]"
            >
              {t('exam_back_to_list')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
