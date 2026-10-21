import { useEffect, useRef, useState } from 'react';
import {
  getSession,
  getQuestions,
  getCandidates,
  verifyFace,
  submitExam,
  updateSessionCandidates,
  type ExamSession,
  type Question,
  type Candidate,
  type FaceVerifyResponse,
  type ExamSubmitResult,
} from '../services/apiService';

interface Props {
  sessionId: string;
  currentUserEmail?: string;
  onExit: () => void;
}

type ExamStep = 'FACE_VERIFY' | 'IN_EXAM' | 'COMPLETED';

export const ExamRoom = ({ sessionId, currentUserEmail = '', onExit }: Props) => {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [step, setStep] = useState<ExamStep>('FACE_VERIFY');
  const [candidateEmail, setCandidateEmail] = useState(currentUserEmail);
  const [simulateMode, setSimulateMode] = useState<'AUTO' | 'FORCE_PASS' | 'FORCE_MISMATCH' | 'FORCE_NO_FACE'>('AUTO');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<FaceVerifyResponse | null>(null);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<ExamSubmitResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(45 * 60);

  useEffect(() => {
    let isMounted = true;
    const loadSessionData = async () => {
      setLoadingSession(true);
      setErrorMsg(null);
      try {
        const [s, allQuestions, allCandidates] = await Promise.all([
          getSession(sessionId),
          getQuestions(),
          getCandidates(),
        ]);
        if (!isMounted) return;
        setSession(s);
        setCandidates(allCandidates);

        if (s.candidateEmails && s.candidateEmails.length > 0) {
          if (!candidateEmail || !s.candidateEmails.some((e) => e.toLowerCase() === candidateEmail.toLowerCase())) {
            setCandidateEmail(s.candidateEmails[0]);
          }
        }

        const filtered = allQuestions.filter((q) => s.questionIds.includes(q.id));
        setSessionQuestions(filtered.length > 0 ? filtered : allQuestions);
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMsg(err?.response?.data?.error || err?.message || 'Không thể tải thông tin ca thi.');
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
      alert('Không thể mở camera: ' + e + '. Bạn có thể chọn cách tải ảnh từ thiết bị.');
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

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(b64);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerifyFace = async () => {
    if (!capturedImage) return alert('Vui lòng chụp ảnh khuôn mặt trước khi xác thực.');
    if (!candidateEmail) return alert('Vui lòng chọn thí sinh.');

    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyFace({
        sessionId,
        capturedImage,
        email: candidateEmail,
        simulateMode,
      });
      setVerifyResult(result);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Lỗi xác thực khuôn mặt';
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
    if (!isAutoSubmit && !confirm('Bạn có chắc chắn muốn nộp bài thi?')) return;
    setIsSubmitting(true);
    try {
      const res = await submitExam({
        sessionId,
        answers: answersRef.current || answers,
        candidateEmail,
      });
      setSubmitResult(res.result);
      setStep('COMPLETED');
      if (isAutoSubmit) {
        alert('Hết giờ làm bài. Bài thi đã được tự động nộp.');
      }
    } catch (err: any) {
      alert('Lỗi nộp bài: ' + (err?.response?.data?.error || err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignCandidateToSession = async (email: string) => {
    if (!session) return;
    const updatedEmails = Array.from(new Set([...session.candidateEmails, email]));
    try {
      await updateSessionCandidates(session.id, updatedEmails);
      setSession({ ...session, candidateEmails: updatedEmails });
      setCandidateEmail(email);
      setVerifyResult(null);
    } catch (e: any) {
      alert('Lỗi gán thí sinh: ' + (e?.message || e));
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentCandidateObj = candidates.find(
    (c) => c.email.toLowerCase() === candidateEmail.toLowerCase()
  );

  if (loadingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-2">
        <p className="text-xs text-slate-500">Đang tải thông tin ca thi...</p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg border border-slate-200 text-center space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Không tìm thấy ca thi</h2>
        <p className="text-xs text-slate-600">{errorMsg || 'Mã ca thi không hợp lệ.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs cursor-pointer"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Tiêu đề ca thi */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-medium text-slate-500">
              #{session.id}
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                session.status === 'RUNNING'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {session.status}
            </span>
          </div>
          <h2 className="text-base font-semibold text-slate-900">{session.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Số lượng: {sessionQuestions.length} câu | Thí sinh: {candidateEmail}
            {currentCandidateObj && ` (${currentCandidateObj.name} - ${currentCandidateObj.studentCode})`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {step === 'IN_EXAM' && (
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-center">
              <span className="block text-[10px] text-slate-400">Thời gian còn lại</span>
              <span className="text-base font-mono font-semibold text-slate-800">{formatTimer(timeLeft)}</span>
            </div>
          )}
          <button
            onClick={onExit}
            className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-md hover:bg-slate-50 transition cursor-pointer"
          >
            Thoát phòng thi
          </button>
        </div>
      </div>

      {/* BƯỚC 1: XÁC THỰC KHUÔN MẶT */}
      {step === 'FACE_VERIFY' && (
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Xác thực khuôn mặt
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống sẽ đối chiếu ảnh chụp từ camera với ảnh hồ sơ của thí sinh trước khi vào làm bài.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Chọn thí sinh dự thi:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {session.candidateEmails.map((email) => {
                  const cand = candidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
                  const isSelected = candidateEmail.toLowerCase() === email.toLowerCase();
                  return (
                    <button
                      key={email}
                      type="button"
                      onClick={() => setCandidateEmail(email)}
                      className={`text-xs px-2.5 py-1 rounded border transition cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 font-medium'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cand ? cand.name : email}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {candidates.filter(
              (c) => !session.candidateEmails.some((e) => e.toLowerCase() === c.email.toLowerCase())
            ).length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-[11px] text-slate-500 mb-1">
                  Thí sinh khác trong hệ thống:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {candidates
                    .filter(
                      (c) => !session.candidateEmails.some((e) => e.toLowerCase() === c.email.toLowerCase())
                    )
                    .map((cand) => (
                      <button
                        key={cand.email}
                        type="button"
                        onClick={() => handleAssignCandidateToSession(cand.email)}
                        className="text-xs px-2 py-0.5 rounded border border-dashed border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                        title="Gán vào ca thi này"
                      >
                        + {cand.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Chế độ kiểm tra:</span>
              <select
                value={simulateMode}
                onChange={(e) => setSimulateMode(e.target.value as any)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none"
              >
                <option value="AUTO">Tự động nhận diện</option>
                <option value="FORCE_PASS">Chấp nhận xác thực</option>
                <option value="FORCE_MISMATCH">Giả lập không khớp mặt</option>
                <option value="FORCE_NO_FACE">Giả lập không tìm thấy mặt</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Ảnh hồ sơ */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-md border border-slate-200 text-center">
              <div className="text-xs text-slate-600 font-medium">
                Ảnh hồ sơ thí sinh
              </div>
              <div className="aspect-4/3 bg-slate-200 rounded overflow-hidden flex items-center justify-center border border-slate-300">
                {currentCandidateObj?.faceImageUrl ? (
                  <img
                    src={currentCandidateObj.faceImageUrl}
                    alt="Ảnh hồ sơ"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://ui-avatars.com/api/?name=' +
                        encodeURIComponent(currentCandidateObj.name) +
                        '&background=e2e8f0&color=334155&size=256';
                    }}
                  />
                ) : (
                  <span className="text-xs text-slate-400">Chưa có ảnh</span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {currentCandidateObj?.name} ({currentCandidateObj?.studentCode})
              </p>
            </div>

            {/* Camera trực tiếp */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-md border border-slate-200 text-center">
              <div className="text-xs text-slate-600 font-medium">
                Ảnh chụp trực tiếp từ camera
              </div>

              <div className="aspect-4/3 bg-slate-900 rounded overflow-hidden flex items-center justify-center border border-slate-300">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />

                {capturedImage && !cameraActive && (
                  <img
                    src={capturedImage}
                    alt="Ảnh chụp từ camera"
                    className="w-full h-full object-cover"
                  />
                )}

                {!cameraActive && !capturedImage && (
                  <div className="text-center text-slate-400 p-4">
                    <span className="text-xs">Chưa mở camera</span>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    className="py-1 px-3 bg-slate-900 text-white rounded text-xs hover:bg-slate-800 transition cursor-pointer"
                  >
                    Mở camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="py-1 px-3 bg-emerald-700 text-white rounded text-xs font-medium hover:bg-emerald-800 transition cursor-pointer"
                    >
                      Chụp ảnh
                    </button>
                    <button
                      onClick={stopCamera}
                      className="py-1 px-3 bg-slate-600 text-white rounded text-xs hover:bg-slate-700 transition cursor-pointer"
                    >
                      Đóng camera
                    </button>
                  </>
                )}

                <label className="py-1 px-3 bg-white border border-slate-200 text-slate-700 rounded text-xs hover:bg-slate-50 cursor-pointer transition">
                  Tải ảnh từ máy
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <button
              onClick={handleVerifyFace}
              disabled={!capturedImage || isVerifying}
              className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition cursor-pointer text-xs"
            >
              {isVerifying ? 'Đang xác thực...' : 'Xác thực khuôn mặt'}
            </button>

            {verifyResult && (
              <div
                className={`p-3.5 rounded-md border text-xs ${
                  verifyResult.verified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="font-semibold mb-1">
                  {verifyResult.verified ? 'Xác thực thành công' : 'Xác thực không thành công'}
                </div>
                <p className="leading-relaxed mb-1 text-slate-600">{verifyResult.message}</p>
                {verifyResult.similarity > 0 && (
                  <div className="font-mono text-[11px] text-slate-500">
                    Độ tương đồng: {verifyResult.similarity}% (Yêu cầu tối thiểu 80%)
                  </div>
                )}

                {verifyResult.verified && (
                  <button
                    onClick={() => setStep('IN_EXAM')}
                    className="mt-2.5 w-full py-2 bg-emerald-700 text-white font-medium rounded text-xs hover:bg-emerald-800 transition cursor-pointer"
                  >
                    Bắt đầu làm bài thi
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BƯỚC 2: LÀM BÀI THI */}
      {step === 'IN_EXAM' && (
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Bài thi trắc nghiệm ({sessionQuestions.length} câu)
              </h3>
              <p className="text-xs text-slate-500">
                Đã trả lời: {Object.keys(answers).length}/{sessionQuestions.length} câu
              </p>
            </div>
            <button
              onClick={() => handleSubmitExam(false)}
              disabled={isSubmitting}
              className="py-2 px-5 bg-slate-900 text-white font-medium rounded-md text-xs hover:bg-slate-800 disabled:bg-slate-400 transition cursor-pointer"
            >
              {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
            </button>
          </div>

          <div className="space-y-4">
            {sessionQuestions.map((q, idx) => {
              const selectedOpt = answers[q.id];
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-md border border-slate-200 space-y-2.5 bg-slate-50/50"
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-medium text-slate-900 text-xs leading-relaxed">
                      <span className="font-semibold text-slate-700 mr-1.5">Câu {idx + 1}:</span>
                      {q.content}
                    </p>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {q.score} điểm
                    </span>
                  </div>

                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt="Hình minh họa"
                      className="max-h-48 rounded border object-contain bg-white"
                    />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const label = ['A', 'B', 'C', 'D'][optIdx] || `${optIdx + 1}`;
                      const isChecked = selectedOpt === optIdx;
                      return (
                        <label
                          key={optIdx}
                          className={`flex items-center space-x-2.5 p-2 rounded border cursor-pointer text-xs transition ${
                            isChecked
                              ? 'bg-white border-slate-800 font-medium text-slate-900'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            checked={isChecked}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                            className="text-slate-800 focus:ring-slate-400"
                          />
                          <span className="font-semibold text-slate-700">{label}.</span>
                          <span className="flex-1 truncate">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => handleSubmitExam(false)}
              disabled={isSubmitting}
              className="py-2.5 px-6 bg-slate-900 text-white font-medium rounded-md text-xs hover:bg-slate-800 disabled:bg-slate-400 transition cursor-pointer"
            >
              {isSubmitting ? 'Đang nộp...' : 'Nộp bài thi'}
            </button>
          </div>
        </div>
      )}

      {/* BƯỚC 3: HOÀN THÀNH */}
      {step === 'COMPLETED' && submitResult && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Nộp bài thi thành công</h3>
            <p className="text-xs text-slate-500 mt-0.5">Kết quả bài thi đã được lưu vào hệ thống.</p>
          </div>

          <div className="max-w-sm mx-auto bg-slate-50 border border-slate-200 p-5 rounded-lg space-y-3">
            <div>
              <div className="text-3xl font-bold text-slate-900">
                {submitResult.score} / {submitResult.maxScore}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Số câu đúng: {submitResult.correctCount} / {submitResult.totalQuestions}
              </p>
            </div>

            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200 text-left">
              <p>
                <span className="text-slate-400">Thí sinh:</span> {submitResult.candidateEmail || candidateEmail}
              </p>
              <p>
                <span className="text-slate-400">Ca thi:</span> #{submitResult.sessionId}
              </p>
              <p>
                <span className="text-slate-400">Thời gian nộp:</span>{' '}
                {new Date(submitResult.submittedAt).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setStep('IN_EXAM');
                setAnswers({});
              }}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-xs rounded-md hover:bg-slate-50 transition cursor-pointer"
            >
              Làm lại
            </button>
            <button
              onClick={onExit}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 transition cursor-pointer"
            >
              Quay lại danh sách ca thi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
