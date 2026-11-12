import { useState, useEffect, useMemo } from 'react';
import {
  type ExamSession,
  type Candidate,
  type SessionStatus,
  unlockCandidateInSession,
  updateSessionDetails,
  sendSessionReport,
  resolveSessionStatus,
} from '../services/apiService';
import { type AuthUser, logout } from '../services/auth';
import { useTranslation } from '../locales/i18nContext';

interface Props {
  user: AuthUser;
  sessions: ExamSession[];
  candidates: Candidate[];
  onRefresh: () => Promise<void> | void;
  onUpdateSessionCandidates?: (sessionId: string, candidateEmails: string[]) => Promise<void> | void;
  onUpdateSessionStatus?: (sessionId: string, status: SessionStatus) => Promise<void> | void;
  countryLanguageBar?: React.ReactNode;
}

interface SecurityAuditItem {
  id: string;
  time: string;
  level: 'INFO' | 'WARN' | 'DANGER' | 'SUCCESS';
  type: 'FACE_REKOGNITION' | 'DEVICE_LOCK' | 'SNS_ALERT' | 'SUBMISSION' | 'PROCTOR_ACTION';
  message: string;
  candidateEmail?: string;
}

export const LiveProctorDashboard = ({
  user,
  sessions,
  candidates,
  onRefresh,
  onUpdateSessionCandidates,
  onUpdateSessionStatus,
  countryLanguageBar,
}: Props) => {
  const { t, lang } = useTranslation();
  const dateLocale = lang === 'en' ? 'en-US' : lang === 'de' ? 'de-DE' : lang === 'la' ? 'lo-LA' : 'vi-VN';

  // 1. Ca thi đang được giám sát (Ưu tiên ca thi RUNNING hoặc ca thi đầu tiên)
  const runningSessions = useMemo(
    () => sessions.filter((s) => resolveSessionStatus(s.status, s.startTime, s.endTime) === 'RUNNING'),
    [sessions]
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    return runningSessions[0]?.id || sessions[0]?.id || 'EX-VNU-2026-01';
  });

  useEffect(() => {
    if (!sessions.some((s) => s.id === selectedSessionId) && sessions.length > 0) {
      setSelectedSessionId(runningSessions[0]?.id || sessions[0]?.id);
    }
  }, [sessions, runningSessions, selectedSessionId]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null,
    [sessions, selectedSessionId]
  );

  // 2. Trạng thái bộ lọc thí sinh trong phòng
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LOCKED' | 'UNLOCKED' | 'SUBMITTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 3. Tự động làm mới thời gian thực (Live Refresh)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefresh();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, onRefresh]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setCountdown(5);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 4. Quản lý Mật khẩu phòng thi 6 số (roomPassword)
  const [showEditPinModal, setShowEditPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinNotice, setPinNotice] = useState<string | null>(null);

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setPinNotice(t('sess_copied_room_password') + ' ' + pin);
    setTimeout(() => setPinNotice(null), 3000);
  };

  const handleSavePin = async () => {
    if (!activeSession) return;
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      alert('Mật khẩu phòng thi phải từ 4 đến 8 ký tự!');
      return;
    }
    await updateSessionDetails(activeSession.id, { roomPassword: cleanPin });
    await onRefresh();
    setShowEditPinModal(false);
    setPinNotice(`Đã đổi mật khẩu phòng thi thành: ${cleanPin}`);
    setTimeout(() => setPinNotice(null), 4000);
  };

  // 5. Quản lý Thí sinh khẩn cấp (Emergency Add Candidate)
  const [showAddCandModal, setShowAddCandModal] = useState(false);
  const [selectedAddEmail, setSelectedAddEmail] = useState('');
  const [customAddEmail, setCustomAddEmail] = useState('');

  const candidatesNotInSession = useMemo(() => {
    if (!activeSession) return [];
    const emails = (activeSession.candidateEmails || []).map((e) => e.toLowerCase());
    return candidates.filter((c) => !emails.includes(c.email.toLowerCase()));
  }, [activeSession, candidates]);

  const handleAddCandidateEmergency = async () => {
    if (!activeSession) return;
    const emailToAdd = (selectedAddEmail || customAddEmail).trim().toLowerCase();
    if (!emailToAdd) return;

    const currentEmails = activeSession.candidateEmails || [];
    if (currentEmails.some((e) => e.toLowerCase() === emailToAdd)) {
      alert('Thí sinh này đã có trong danh sách ca thi!');
      return;
    }

    const updated = [...currentEmails, emailToAdd];
    if (onUpdateSessionCandidates) {
      await onUpdateSessionCandidates(activeSession.id, updated);
    } else {
      await updateSessionDetails(activeSession.id, { candidateEmails: updated });
    }

    addSecurityEvent({
      level: 'SUCCESS',
      type: 'PROCTOR_ACTION',
      message: `Giám thị đã bổ sung khẩn cấp thí sinh ${emailToAdd} vào ca thi #${activeSession.id}.`,
      candidateEmail: emailToAdd,
    });

    setSelectedAddEmail('');
    setCustomAddEmail('');
    setShowAddCandModal(false);
    await onRefresh();
  };

  // 6. Xử lý mở khóa định thiết bị (Unlock Device Token)
  const [unlockLoadingEmail, setUnlockLoadingEmail] = useState<string | null>(null);

  const handleUnlockCandidate = async (candidateEmail: string, candidateName: string) => {
    if (!activeSession) return;
    const confirmMsg = `Bạn có chắc chắn muốn MỞ KHÓA THIẾT BỊ cho thí sinh "${candidateName}" (${candidateEmail})?\n\nSau khi mở khóa, thí sinh có thể đăng nhập lại từ máy tính khác trong phòng thi.`;
    if (!window.confirm(confirmMsg)) return;

    setUnlockLoadingEmail(candidateEmail);
    try {
      await unlockCandidateInSession(activeSession.id, candidateEmail);
      // Xóa đồng thời trên local storage token nếu chạy cùng máy test
      localStorage.removeItem(`cloudexam_cand_token_${activeSession.id}_${candidateEmail.toLowerCase()}`);

      addSecurityEvent({
        level: 'WARN',
        type: 'PROCTOR_ACTION',
        message: `Giám thị đã giải phóng khóa thiết bị cho thí sinh ${candidateName} (${candidateEmail}). Thí sinh được phép đổi máy.`,
        candidateEmail,
      });

      setPinNotice(`Đã mở khóa thiết bị thành công cho thí sinh: ${candidateName}!`);
      setTimeout(() => setPinNotice(null), 4000);
      await onRefresh();
    } catch (err: any) {
      alert(`Không thể mở khóa thiết bị: ${err?.message || err}`);
    } finally {
      setUnlockLoadingEmail(null);
    }
  };

  // 7. Nhật ký an ninh & Cảnh báo Amazon SNS
  const [securityEvents, setSecurityEvents] = useState<SecurityAuditItem[]>([
    {
      id: 'sec-1',
      time: new Date(Date.now() - 1000 * 60 * 8).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level: 'SUCCESS',
      type: 'FACE_REKOGNITION',
      message: 'Thí sinh Trần Minh Đức (24020001) đối soát sinh trắc học Rekognition thành công (Tương đồng: 94.2%).',
      candidateEmail: '24020001@vnu.edu.vn',
    },
    {
      id: 'sec-2',
      time: new Date(Date.now() - 1000 * 60 * 7).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level: 'INFO',
      type: 'DEVICE_LOCK',
      message: 'Tài khoản 24020001@vnu.edu.vn đã được KHÓA CỨNG vào thiết bị (Fingerprint: dev-7c4a...). Ngăn chặn mở trên máy thứ 2.',
      candidateEmail: '24020001@vnu.edu.vn',
    },
    {
      id: 'sec-3',
      time: new Date(Date.now() - 1000 * 60 * 4).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level: 'DANGER',
      type: 'SNS_ALERT',
      message: 'Cảnh báo khẩn cấp Amazon SNS: Nghi vấn gian lận danh tính - Thí sinh Nguyễn VĂN BẢY (24020007) đối soát Rekognition chỉ đạt 41.5% (< 80%).',
      candidateEmail: '24020007@vnu.edu.vn',
    },
  ]);

  const addSecurityEvent = (item: Omit<SecurityAuditItem, 'id' | 'time'>) => {
    const newItem: SecurityAuditItem = {
      ...item,
      id: `sec-${Date.now()}`,
      time: new Date().toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setSecurityEvents((prev) => [newItem, ...prev.slice(0, 19)]);
  };

  const [sendingSns, setSendingSns] = useState(false);
  const handleTriggerSnsAlert = async () => {
    if (!activeSession) return;
    setSendingSns(true);
    try {
      await sendSessionReport(activeSession.id);
      addSecurityEvent({
        level: 'WARN',
        type: 'SNS_ALERT',
        message: `Đã phát thông báo an ninh ca thi #${activeSession.id} qua Amazon SNS Topic thành công!`,
      });
      alert('Đã gửi thông báo an ninh tới Amazon SNS Topic của Hội đồng thi!');
    } catch (err: any) {
      alert(`Lỗi gửi SNS: ${err?.message || err}`);
    } finally {
      setSendingSns(false);
    }
  };

  // 8. Lọc danh sách thí sinh hiển thị
  const filteredCandidates = useMemo(() => {
    if (!activeSession) return [];
    const sessionCandEmails = (activeSession.candidateEmails || []).map((e) => e.toLowerCase());
    const locks = activeSession.lockedCandidates || {};
    const submissions = activeSession.submissions || {};

    let list = sessionCandEmails.map((email) => {
      const info = candidates.find((c) => c.email.toLowerCase() === email);
      const isLocked = !!locks[email]?.locked;
      const sub = submissions[email];
      const isSubmitted = !!sub;
      return {
        email,
        name: info?.name || email,
        studentCode: info?.studentCode || 'N/A',
        className: info?.className || 'N/A',
        faceImageUrl: info?.faceImageUrl || '',
        isLocked,
        deviceToken: locks[email]?.deviceToken || '',
        lockedAt: locks[email]?.lockedAt || '',
        isSubmitted,
        score: sub ? (typeof sub === 'object' ? sub.score : sub) : null,
      };
    });

    if (filterStatus === 'LOCKED') {
      list = list.filter((c) => c.isLocked);
    } else if (filterStatus === 'UNLOCKED') {
      list = list.filter((c) => !c.isLocked && !c.isSubmitted);
    } else if (filterStatus === 'SUBMITTED') {
      list = list.filter((c) => c.isSubmitted);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.studentCode.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeSession, candidates, filterStatus, searchQuery]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    if (!activeSession) return { total: 0, locked: 0, submitted: 0, waiting: 0 };
    const total = (activeSession.candidateEmails || []).length;
    const locks = activeSession.lockedCandidates || {};
    const locked = Object.values(locks).filter((l: any) => l?.locked).length;
    const submitted = Object.keys(activeSession.submissions || {}).length;
    const waiting = Math.max(0, total - Math.max(locked, submitted));
    return { total, locked, submitted, waiting };
  }, [activeSession]);

  const currentStatus = activeSession
    ? resolveSessionStatus(activeSession.status, activeSession.startTime, activeSession.endTime)
    : 'SCHEDULED';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/70 to-indigo-50/30 text-slate-800 flex flex-col justify-between">
      {/* 1. Header Bàn Cán bộ coi thi */}
      <header className="bg-white/95 backdrop-blur-md border-b border-indigo-100 px-4 md:px-8 py-3 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-extrabold text-slate-900 tracking-tight">
                  BÀN GIÁM SÁT PHÒNG THI (LIVE PROCTOR CONSOLE)
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Giám sát trực tuyến
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cán bộ coi thi: <strong className="text-slate-800 font-semibold">{user.name || 'Giám thị'}</strong> ({user.email}) • Mã giám thị: <span className="font-mono font-bold text-indigo-600">{user.studentCode || 'GT002'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            {countryLanguageBar}

            {/* Nút đăng xuất */}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-semibold border border-slate-200 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Thông báo PIN / Thao tác */}
      {pinNotice && (
        <div className="bg-emerald-600 text-white text-xs font-semibold py-2 px-4 text-center sticky top-[57px] z-30 shadow-md flex items-center justify-center gap-2 animate-fadeIn">
          <span>✓</span>
          <span>{pinNotice}</span>
        </div>
      )}

      {/* 2. Nội dung chính của Proctor Console */}
      <main className="max-w-7xl w-full mx-auto p-4 md:p-8 flex-1 space-y-6">
        {/* Bộ chọn ca thi & Thanh điều khiển thời gian thực */}
        <div className="bg-white rounded-3xl p-4 md:p-6 border border-slate-200/90 shadow-sm flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>📋</span> Ca thi đang giám sát:
            </span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 cursor-pointer min-w-[280px]"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} — {s.name} ({resolveSessionStatus(s.status, s.startTime, s.endTime)})
                </option>
              ))}
            </select>

            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                currentStatus === 'RUNNING'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse'
                  : currentStatus === 'SCHEDULED'
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-slate-100 text-slate-500 border-slate-300'
              }`}
            >
              ● {currentStatus === 'RUNNING' ? 'Đang diễn ra' : currentStatus === 'SCHEDULED' ? 'Chưa bắt đầu' : 'Đã kết thúc'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
              <span>Tự động cập nhật: <strong>{autoRefresh ? `${countdown}s` : 'Tắt'}</strong></span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="ml-1 text-[10px] text-indigo-600 hover:underline font-bold"
              >
                {autoRefresh ? 'Dừng' : 'Bật'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition cursor-pointer"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddCandModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-200 transition cursor-pointer"
            >
              <span>➕</span>
              <span>Bổ sung thí sinh khẩn cấp</span>
            </button>
          </div>
        </div>

        {/* Cụm 1: Kiểm soát cửa ngõ phòng thi & Mật khẩu phòng thi 6 số */}
        {activeSession && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Card Mật khẩu phòng thi (Gatekeeper PIN) */}
            <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <span className="text-9xl">🔒</span>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-800/60 px-3 py-1 rounded-full border border-indigo-700/80">
                    Cửa ngõ phòng thi (Gate Access)
                  </span>
                  <span className="text-[11px] font-mono text-indigo-200">
                    ID: #{activeSession.id}
                  </span>
                </div>

                <h2 className="text-lg font-bold tracking-tight text-white leading-tight">
                  {activeSession.name}
                </h2>

                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                    <span>🔑</span> MẬT KHẨU PHÒNG THI (6 KÝ TỰ CUNG CẤP CHO THÍ SINH):
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-2 text-2xl md:text-3xl font-mono font-black tracking-[0.3em] text-amber-300 shadow-inner">
                      {activeSession.roomPassword || '123456'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyPin(activeSession.roomPassword || '123456')}
                      className="px-3.5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold border border-white/20 transition cursor-pointer flex items-center gap-1.5"
                      title="Sao chép mật khẩu"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPin(`${Math.floor(100000 + Math.random() * 900000)}`);
                        setShowEditPinModal(true);
                      }}
                      className="px-3 py-2.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold border border-indigo-500 transition cursor-pointer"
                      title="Đổi mật khẩu mới"
                    >
                      <span>Đổi PIN</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-300/80 mt-1.5">
                    * Thí sinh bắt buộc phải nhập đúng mã 6 số này sau khi xác thực để bước vào phòng thi.
                  </p>
                </div>
              </div>

              {/* Điều khiển trạng thái ca thi */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
                <span className="text-indigo-200 text-[11px]">
                  Thời gian: {new Date(activeSession.startTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} - {new Date(activeSession.endTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-2">
                  {onUpdateSessionStatus && (
                    <>
                      {currentStatus === 'RUNNING' ? (
                        <button
                          type="button"
                          onClick={() => onUpdateSessionStatus(activeSession.id, 'SCHEDULED')}
                          className="px-2.5 py-1 bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-400/40 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          ⏸️ Tạm dừng
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUpdateSessionStatus(activeSession.id, 'RUNNING')}
                          className="px-2.5 py-1 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 border border-emerald-400/40 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          ▶️ Bắt đầu
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Thẻ KPI Giám Sát */}
            <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* KPI 1 */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Tổng thí sinh</span>
                  <span className="text-base">👥</span>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-extrabold text-slate-900">{stats.total}</span>
                  <span className="text-xs text-slate-400 ml-1">thí sinh</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-lg">
                  Đã phân công vào ca
                </div>
              </div>

              {/* KPI 2: Khóa định thiết bị (Device Lock) */}
              <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs flex flex-col justify-between bg-gradient-to-br from-emerald-50/30 to-white">
                <div className="flex items-center justify-between text-emerald-700 text-xs font-bold">
                  <span>Khóa thiết bị 🔒</span>
                  <span className="text-base">🖥️</span>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-extrabold text-emerald-700">{stats.locked}</span>
                  <span className="text-xs text-emerald-600 ml-1">đã khóa</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                  <span>✓</span> Chống 2 máy song song
                </div>
              </div>

              {/* KPI 3: Đang làm bài */}
              <div className="bg-white p-5 rounded-3xl border border-indigo-200 shadow-xs flex flex-col justify-between bg-gradient-to-br from-indigo-50/30 to-white">
                <div className="flex items-center justify-between text-indigo-700 text-xs font-bold">
                  <span>Đang thi</span>
                  <span className="text-base">✍️</span>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-extrabold text-indigo-700">{Math.max(0, stats.locked - stats.submitted)}</span>
                  <span className="text-xs text-indigo-600 ml-1">thí sinh</span>
                </div>
                <div className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                  Lưu nháp Atomic Updates
                </div>
              </div>

              {/* KPI 4: Đã nộp bài */}
              <div className="bg-white p-5 rounded-3xl border border-purple-200 shadow-xs flex flex-col justify-between bg-gradient-to-br from-purple-50/30 to-white">
                <div className="flex items-center justify-between text-purple-700 text-xs font-bold">
                  <span>Đã nộp bài</span>
                  <span className="text-base">🏁</span>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-extrabold text-purple-700">{stats.submitted}</span>
                  <span className="text-xs text-purple-600 ml-1">bài nộp</span>
                </div>
                <div className="text-[10px] text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded-lg border border-purple-100">
                  Chấm điểm tự động SQS
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cụm 2 & 3: Lưới Giám Sát Thí Sinh Trực Tiếp & Hộp Cảnh Báo An Ninh Amazon SNS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CỘT TRÁI (8 CỘT): Lưới Thí Sinh Trong Phòng Thi */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="text-base">👥</span>
                  <span>DANH SÁCH THÍ SINH PHÒNG THI</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {filteredCandidates.length}/{stats.total}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Theo dõi trạng thái điểm danh sinh trắc học và khóa định phần cứng thời gian thực
                </p>
              </div>

              {/* Bộ lọc tab */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterStatus === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Tất cả ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('LOCKED')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${filterStatus === 'LOCKED' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-emerald-700'}`}
                >
                  <span>🔒 Khóa máy</span>
                  <span>({stats.locked})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('SUBMITTED')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterStatus === 'SUBMITTED' ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-purple-700'}`}
                >
                  Đã nộp ({stats.submitted})
                </button>
              </div>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm thí sinh theo Họ tên, Mã sinh viên (2402xxxx) hoặc Email..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Danh sách Thẻ Thí sinh */}
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12 space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <span className="text-3xl">🔍</span>
                <p className="text-xs font-semibold text-slate-600">Không tìm thấy thí sinh nào phù hợp</p>
                <p className="text-[11px] text-slate-400">Thử thay đổi bộ lọc hoặc thêm thí sinh vào ca thi</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {filteredCandidates.map((c) => (
                  <div
                    key={c.email}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                      c.isLocked
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/20 via-white to-white shadow-xs'
                        : c.isSubmitted
                        ? 'border-purple-200 bg-purple-50/10'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Ảnh thẻ thí sinh */}
                      <div className="relative shrink-0">
                        {c.faceImageUrl ? (
                          <img
                            src={c.faceImageUrl}
                            alt={c.name}
                            className="w-12 h-14 rounded-xl object-cover border border-slate-200 shadow-2xs bg-slate-100"
                            onError={(e) => {
                              // Fallback nếu ảnh không tải được
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">
                            TS
                          </div>
                        )}
                        {c.isLocked && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shadow-sm font-bold" title="Đã khóa định thiết bị">
                            🔒
                          </span>
                        )}
                      </div>

                      {/* Thông tin thí sinh */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate" title={c.name}>
                            {c.name}
                          </h4>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {c.studentCode}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 truncate" title={c.email}>
                          {c.email}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {c.isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              <span>Đã khóa thiết bị ({c.deviceToken ? c.deviceToken.slice(0, 8) + '...' : 'Active'})</span>
                            </span>
                          ) : c.isSubmitted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-100/80 px-2 py-0.5 rounded-md border border-purple-200">
                              <span>🏁</span>
                              <span>Đã nộp bài (Điểm: {c.score ?? 'Đã ghi nhận'})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              <span>⏳</span> Chưa vào phòng thi
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Thao tác của Giám thị */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400">
                        {c.isLocked ? 'Thiết bị đang ghim máy' : 'Chưa điểm danh'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {c.isLocked && (
                          <button
                            type="button"
                            onClick={() => handleUnlockCandidate(c.email, c.name)}
                            disabled={unlockLoadingEmail === c.email}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                            title="Mở khóa thiết bị khi thí sinh gặp sự cố máy móc cần chuyển máy"
                          >
                            <span>🔓</span>
                            <span>{unlockLoadingEmail === c.email ? 'Đang mở...' : 'Mở khóa máy'}</span>
                          </button>
                        )}
                        {!c.isLocked && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!activeSession) return;
                              // Khóa thủ công cho thí sinh
                              const currentLocks = activeSession.lockedCandidates || {};
                              const token = `token-${Math.random().toString(36).slice(2, 8)}`;
                              const updatedLocks = {
                                ...currentLocks,
                                [c.email.toLowerCase()]: {
                                  locked: true,
                                  deviceToken: token,
                                  lockedAt: new Date().toISOString(),
                                },
                              };
                              await updateSessionDetails(activeSession.id, { lockedCandidates: updatedLocks });
                              addSecurityEvent({
                                level: 'SUCCESS',
                                type: 'PROCTOR_ACTION',
                                message: `Giám thị đã xác thực và khóa định thiết bị thủ công cho thí sinh ${c.name} (${c.email}).`,
                                candidateEmail: c.email,
                              });
                              await onRefresh();
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                            title="Xác thực & Khóa thiết bị trực tiếp cho thí sinh"
                          >
                            <span>Khóa máy</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CỘT PHẢI (4 CỘT): Nhật Ký An Ninh & Cảnh Báo Khẩn Cấp Amazon SNS */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🚨</span> NHẬT KÝ AN NINH (SNS AUDIT)
                </h3>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  Thời gian thực
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Hệ thống tự động phát hiện thi hộ qua Rekognition & phát cảnh báo khẩn cấp tới Amazon SNS Topic.
              </p>

              {/* Feed các sự kiện an ninh */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {securityEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      ev.level === 'DANGER'
                        ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                        : ev.level === 'WARN'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : ev.level === 'SUCCESS'
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="flex items-center gap-1">
                        {ev.level === 'DANGER' && <span>🚨 KHẨN CẤP</span>}
                        {ev.level === 'WARN' && <span>⚠️ CẢNH BÁO</span>}
                        {ev.level === 'SUCCESS' && <span>✓ AN TOÀN</span>}
                        {ev.level === 'INFO' && <span>ℹ THÔNG TIN</span>}
                      </span>
                      <span className="font-mono text-slate-400">{ev.time}</span>
                    </div>
                    <p className="text-[11px] font-medium leading-relaxed">{ev.message}</p>
                  </div>
                ))}
              </div>

              {/* Nút gửi cảnh báo thủ công qua SNS */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTriggerSnsAlert}
                  disabled={sendingSns}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>📢</span>
                  <span>{sendingSns ? 'Đang phát cảnh báo SNS...' : 'Bắn cảnh báo khẩn cấp (Amazon SNS)'}</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  Gửi báo cáo an ninh tức thì về hòm thư Hội đồng thi
                </p>
              </div>
            </div>

            {/* Hướng dẫn nghiệp vụ coi thi */}
            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/40 rounded-3xl p-5 border border-indigo-100 space-y-2 text-xs text-indigo-950">
              <h4 className="font-bold flex items-center gap-1.5 text-indigo-900">
                <span>📖</span> QUY TRÌNH COI THI CLOUDEXAM
              </h4>
              <ul className="space-y-1.5 text-[11px] text-slate-600 list-disc pl-4 leading-relaxed">
                <li>Đọc <strong>Mật khẩu phòng thi (6 số)</strong> cho thí sinh khi bắt đầu giờ làm bài.</li>
                <li>Thí sinh điểm danh Rekognition thành công sẽ tự động nhận <strong>Ổ khóa xanh 🔒</strong> ghim thiết bị.</li>
                <li>Nếu thí sinh bị hỏng máy, bấm <strong>"Mở khóa máy"</strong> để cho phép chuyển máy thi khác.</li>
                <li>Nếu có thí sinh đến muộn chính đáng, bấm <strong>"Bổ sung thí sinh khẩn cấp"</strong> để cấp quyền vào thi ngay.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: Đổi mật khẩu phòng thi 6 số */}
      {showEditPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>🔑</span> ĐỔI MẬT KHẨU PHÒNG THI
              </h3>
              <button
                type="button"
                onClick={() => setShowEditPinModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Mật khẩu phòng thi mới sẽ có hiệu lực ngay lập tức. Thí sinh chưa vào phòng sẽ dùng mã này để đăng nhập.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu PIN mới (4 - 8 số)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  maxLength={8}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-xl font-mono font-black tracking-widest outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="button"
                  onClick={() => setNewPin(`${Math.floor(100000 + Math.random() * 900000)}`)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Sinh ngẫu nhiên
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditPinModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSavePin}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition cursor-pointer"
              >
                Lưu mật khẩu mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Bổ sung nhanh thí sinh khẩn cấp */}
      {showAddCandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>➕</span> BỔ SUNG THÍ SINH KHẨN CẤP
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCandModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Chọn thí sinh có sẵn trong danh sách hồ sơ trường hoặc nhập trực tiếp email sinh viên để cấp quyền vào phòng thi ngay lập tức.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn thí sinh chưa có trong ca thi:
                </label>
                <select
                  value={selectedAddEmail}
                  onChange={(e) => {
                    setSelectedAddEmail(e.target.value);
                    if (e.target.value) setCustomAddEmail('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">-- Chọn thí sinh từ danh mục trường --</option>
                  {candidatesNotInSession.map((c) => (
                    <option key={c.email} value={c.email}>
                      {c.name} ({c.studentCode}) — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center justify-center text-xs text-slate-400">
                <span className="bg-white px-2">hoặc nhập email mới</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email thí sinh:
                </label>
                <input
                  type="email"
                  value={customAddEmail}
                  onChange={(e) => {
                    setCustomAddEmail(e.target.value);
                    if (e.target.value) setSelectedAddEmail('');
                  }}
                  placeholder="Ví dụ: 24020099@vnu.edu.vn"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddCandModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddCandidateEmergency}
                disabled={!selectedAddEmail && !customAddEmail}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-500 hover:to-teal-500 shadow-sm disabled:opacity-50 transition cursor-pointer"
              >
                Cấp quyền vào phòng thi ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white/80 border-t border-slate-200/80 py-3 px-4 text-center text-xs text-slate-500">
        CloudExam Live Proctor Console • Hệ thống giám sát phòng thi trực tuyến bảo mật cao • Amazon Rekognition & SNS Security
      </footer>
    </div>
  );
};
