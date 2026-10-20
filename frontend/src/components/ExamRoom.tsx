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
      alert('Không thể mở Webcam: ' + e + '. Bạn có thể chọn cách tải ảnh chụp từ máy.');
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
    if (!capturedImage) return alert('Vui lòng chụp ảnh khuôn mặt trước khi xác thực!');
    if (!candidateEmail) return alert('Vui lòng chọn hoặc nhập email thí sinh!');

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
        alert('Đã hết 45 phút làm bài! Hệ thống đã tự động nộp bài thi của bạn.');
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
      alert('Lỗi gán thí sinh vào ca thi: ' + (e?.message || e));
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-600">Đang tải thông tin ca thi từ AWS DynamoDB...</p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow border border-red-200 text-center space-y-4">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy ca thi</h2>
        <p className="text-sm text-red-600">{errorMsg || 'Mã ca thi không hợp lệ.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800 cursor-pointer"
        >
          Quay lại trang quản lý
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              #{session.id}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                session.status === 'RUNNING'
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {session.status}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{session.name}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Tổng số câu hỏi: <span className="font-semibold text-slate-800">{sessionQuestions.length}</span> câu |
            Thí sinh: <span className="font-semibold text-slate-800">{candidateEmail}</span>
            {currentCandidateObj && ` (${currentCandidateObj.name} - ${currentCandidateObj.studentCode})`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {step === 'IN_EXAM' && (
            <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-center">
              <span className="block text-[10px] uppercase font-bold text-blue-600 tracking-wider">Thời gian</span>
              <span className="text-lg font-mono font-bold text-blue-900">{formatTimer(timeLeft)}</span>
            </div>
          )}
          <button
            onClick={onExit}
            className="text-xs text-slate-500 hover:text-slate-800 px-3 py-2 border rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            ✕ Thoát phòng thi
          </button>
        </div>
      </div>

      {step === 'FACE_VERIFY' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>👤</span> Bước 1: Điểm danh & Xác thực khuôn mặt (Amazon Rekognition)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Theo quy chế phòng thi CloudExam, hệ thống sẽ sử dụng <strong>Amazon Rekognition CompareFaces</strong> để so
              khớp ảnh chụp trực tiếp từ webcam với ảnh hồ sơ lưu trên <strong>Amazon S3</strong>. Độ tương đồng yêu cầu đạt tối
              thiểu <strong>80%</strong> và trạng thái ca thi phải là <strong>RUNNING</strong>.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Thí sinh trong ca thi này ({session.candidateEmails.length}):
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {session.candidateEmails.map((email) => {
                  const cand = candidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
                  return (
                    <button
                      key={email}
                      type="button"
                      onClick={() => setCandidateEmail(email)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition flex items-center gap-2 ${
                        candidateEmail.toLowerCase() === email.toLowerCase()
                          ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cand ? cand.name : email}</span>
                      <span className="text-[10px] opacity-80">({email})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {candidates.filter(
              (c) => !session.candidateEmails.some((e) => e.toLowerCase() === c.email.toLowerCase())
            ).length > 0 && (
              <div className="pt-2.5 border-t border-slate-200">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">
                    Thí sinh vừa thêm trong hệ thống (Chưa gán vào ca thi này):
                  </label>
                  <span className="text-[10px] text-amber-700 font-medium">Bấm để gán vào ca thi ngay</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {candidates
                    .filter(
                      (c) => !session.candidateEmails.some((e) => e.toLowerCase() === c.email.toLowerCase())
                    )
                    .map((cand) => (
                      <button
                        key={cand.email}
                        type="button"
                        onClick={() => handleAssignCandidateToSession(cand.email)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-blue-400 bg-blue-50/70 text-blue-950 hover:bg-blue-100 font-mono transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="Bấm để gán thí sinh này vào ca thi"
                      >
                        <span className="font-bold text-blue-600">+</span>
                        <span className="font-semibold">{cand.name}</span>
                        <span className="text-[10px] text-slate-500">({cand.email})</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">Thử nghiệm tình huống Rekognition:</span>
              <select
                value={simulateMode}
                onChange={(e) => setSimulateMode(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 font-medium outline-none"
              >
                <option value="AUTO">🎯 Tự động nhận diện (Người thật - PASS ≥ 80%)</option>
                <option value="FORCE_MISMATCH">🚫 Giả lập không khớp mặt (Khác người - FAIL &lt; 80%)</option>
                <option value="FORCE_NO_FACE">⚠️ Giả lập che camera / Không có mặt (No Face)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
                <span className="font-bold">Ảnh gốc thí sinh (Amazon S3)</span>
                <span className="font-mono text-[11px] text-blue-600">faces/{currentCandidateObj?.studentCode}.jpg</span>
              </div>
              <div className="aspect-4/3 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300">
                {currentCandidateObj?.faceImageUrl ? (
                  <img
                    src={currentCandidateObj.faceImageUrl}
                    alt="Ảnh gốc S3"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://ui-avatars.com/api/?name=' +
                        encodeURIComponent(currentCandidateObj.name) +
                        '&background=0D8ABC&color=fff&size=256';
                    }}
                  />
                ) : (
                  <span className="text-xs text-slate-400">Chưa có ảnh hồ sơ</span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {currentCandidateObj?.name} ({currentCandidateObj?.studentCode})
              </p>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
                <span className="font-bold">Ảnh chụp trực tiếp (Webcam Live)</span>
                <span className="font-mono text-[11px] text-green-600">CompareFaces Target</span>
              </div>

              {/* Tích hợp hiệu ứng laser tia quét sinh trắc học */}
              <div className="relative aspect-4/3 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300">
                <style>
                  {`
                    @keyframes scan {
                      0% { top: 0%; opacity: 0; }
                      10% { opacity: 1; }
                      90% { opacity: 1; }
                      100% { top: 100%; opacity: 0; }
                    }
                  `}
                </style>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                
                {cameraActive && (
                  <div className="absolute inset-0 z-10 pointer-events-none">
                    <div 
                      className="absolute left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,1)]" 
                      style={{ animation: 'scan 2.5s ease-in-out infinite' }}
                    ></div>
                    <div className="absolute inset-0 m-8 border-2 border-dashed border-white/40 rounded-2xl"></div>
                    <div className="absolute top-4 left-4 text-[10px] text-green-400 font-mono font-bold">● REC / AI SCANNING</div>
                  </div>
                )}

                {capturedImage && !cameraActive && (
                  <img
                    src={capturedImage}
                    alt="Captured Webcam"
                    className="w-full h-full object-cover"
                  />
                )}

                {!cameraActive && !capturedImage && (
                  <div className="text-center text-slate-400 p-4">
                    <span className="text-3xl block mb-2">📷</span>
                    <span className="text-xs">Chưa bật Webcam hoặc chưa có ảnh</span>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    className="py-1.5 px-3 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 transition cursor-pointer"
                  >
                    🎥 Bật Webcam
                  </button>
                ) : (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="py-1.5 px-3 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition cursor-pointer"
                    >
                      📸 Chụp ảnh ngay
                    </button>
                    <button
                      onClick={stopCamera}
                      className="py-1.5 px-3 bg-slate-500 text-white rounded-lg text-xs font-medium hover:bg-slate-600 transition cursor-pointer"
                    >
                      Tắt cam
                    </button>
                  </>
                )}

                <label className="py-1.5 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer transition">
                  📁 Tải ảnh từ máy
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                4 Tiêu chí bắt buộc của AWS Lambda CompareFaces:
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <span>{session.status === 'RUNNING' ? '✅' : '❌'}</span>
                  <span>1. Ca thi đang RUNNING (Hiện tại: <strong>{session.status}</strong>)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>{session.candidateEmails.includes(candidateEmail) ? '✅' : '❌'}</span>
                  <span>2. Email thuộc ca thi (<strong>{candidateEmail}</strong>)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>{currentCandidateObj?.faceImageUrl ? '✅' : '❌'}</span>
                  <span>3. Có ảnh gốc mẫu trên S3 Bucket</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>{capturedImage ? '✅' : '⏳'}</span>
                  <span>4. Đã chụp ảnh chân dung từ camera</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleVerifyFace}
              disabled={!capturedImage || isVerifying}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md transition cursor-pointer"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Đang gọi AWS Lambda & Rekognition CompareFaces...
                </span>
              ) : (
                '🔍 Gửi xác thực khuôn mặt lên AWS Rekognition'
              )}
            </button>

            {verifyResult && (
              <div
                className={`p-4 rounded-xl border ${
                  verifyResult.verified
                    ? 'bg-green-50 border-green-300 text-green-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <span>{verifyResult.verified ? '🎉' : '⛔'}</span>
                  <span>{verifyResult.verified ? 'XÁC THỰC THÀNH CÔNG (PASS)' : 'XÁC THỰC THẤT BÀI (FAIL)'}</span>
                </div>
                <p className="text-xs leading-relaxed mb-2">{verifyResult.message}</p>
                {verifyResult.similarity > 0 && (
                  <div className="text-xs font-mono font-semibold">
                    Độ tương đồng khuôn mặt (Similarity): {verifyResult.similarity}% (Yêu cầu ≥ 80%)
                  </div>
                )}

                {verifyResult.verified && (
                  <button
                    onClick={() => setStep('IN_EXAM')}
                    className="mt-3 w-full py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition shadow cursor-pointer"
                  >
                    👉 Bắt đầu làm bài thi ngay
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'IN_EXAM' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                📝 Bài thi trắc nghiệm ({sessionQuestions.length} câu)
              </h3>
              <p className="text-xs text-slate-500">
                Đã trả lời: {Object.keys(answers).length}/{sessionQuestions.length} câu hỏi
              </p>
            </div>
            <button
              onClick={() => handleSubmitExam(false)}
              disabled={isSubmitting}
              className="py-2.5 px-6 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-400 transition shadow cursor-pointer"
            >
              {isSubmitting ? 'Đang nộp...' : '🏁 Nộp bài thi'}
            </button>
          </div>

          <div className="space-y-6">
            {sessionQuestions.map((q, idx) => {
              const selectedOpt = answers[q.id];
              return (
                <div
                  key={q.id}
                  className="p-5 rounded-xl border border-slate-200 hover:border-blue-300 transition space-y-3 bg-slate-50/50"
                >
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-semibold text-slate-900 text-sm">
                      <span className="text-blue-600 font-bold mr-2">Câu {idx + 1}:</span>
                      {q.content}
                    </p>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                      {q.score} điểm
                    </span>
                  </div>

                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt="Hình minh họa"
                      className="max-h-56 rounded-lg border object-contain bg-white"
                    />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const label = ['A', 'B', 'C', 'D'][optIdx] || `${optIdx + 1}`;
                      const isChecked = selectedOpt === optIdx;
                      return (
                        <label
                          key={optIdx}
                          className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer text-xs transition ${
                            isChecked
                              ? 'bg-blue-50 border-blue-600 font-semibold text-blue-950 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            checked={isChecked}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-bold text-blue-700">{label}.</span>
                          <span className="flex-1">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              onClick={() => handleSubmitExam(false)}
              disabled={isSubmitting}
              className="py-3 px-8 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-400 transition shadow-md cursor-pointer"
            >
              {isSubmitting ? 'Đang chấm điểm qua API Gateway...' : '🏁 Nộp bài thi và Xem kết quả'}
            </button>
          </div>
        </div>
      )}

      {step === 'COMPLETED' && submitResult && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-6">
          <div className="text-5xl">🏆</div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">Nộp bài thi thành công!</h3>
            <p className="text-xs text-slate-500 mt-1">Kết quả đã được Lambda chấm điểm và lưu vào AWS DynamoDB.</p>
          </div>

          <div className="max-w-md mx-auto bg-blue-50/70 border border-blue-200 p-6 rounded-2xl space-y-4">
            <div>
              <div className="text-4xl font-black text-blue-600">
                {submitResult.score} / {submitResult.maxScore} điểm
              </div>
              <p className="text-xs font-semibold text-blue-800 mt-1">
                Số câu đúng: {submitResult.correctCount} / {submitResult.totalQuestions} câu hỏi
              </p>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-blue-200 text-left">
              <p>
                <strong>Thí sinh:</strong> {submitResult.candidateEmail || candidateEmail}
              </p>
              <p>
                <strong>Ca thi:</strong> #{submitResult.sessionId} ({session.name})
              </p>
              <p>
                <strong>Thời gian nộp bài:</strong>{' '}
                {new Date(submitResult.submittedAt).toLocaleString('vi-VN')}
              </p>
              <p>
                <strong>Trạng thái lưu trữ:</strong>{' '}
                <span className="font-bold text-green-700">{submitResult.status}</span>
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setStep('IN_EXAM');
                setAnswers({});
              }}
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              🔄 Thi lại (Reset)
            </button>
            <button
              onClick={onExit}
              className="px-6 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition shadow cursor-pointer"
            >
              Quay lại danh sách ca thi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};