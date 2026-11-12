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
    return runningSessions[0]?.id || sessions[0]?.id || '';
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
    if (!/^\d{6}$/.test(cleanPin)) {
      alert('Mật khẩu phòng thi phải gồm đúng 6 chữ số!');
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
  const [securityEvents, setSecurityEvents] = useState<SecurityAuditItem[]>([]);

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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* 1. Header Bàn Cán bộ coi thi */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-semibold text-slate-900 tracking-tight">
                  Bàn giám sát phòng thi
                </h1>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Trực tuyến
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {user.name || 'Giám thị'} · {user.email}
                {user.studentCode && <span className="font-mono"> · {user.studentCode}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            {countryLanguageBar}

            {/* Nút đăng xuất */}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 transition cursor-pointer"
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
        <div className="bg-slate-900 text-white text-xs font-medium py-2 px-4 text-center sticky top-[57px] z-30 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{pinNotice}</span>
        </div>
      )}

      {/* 2. Nội dung chính của Proctor Console */}
      <main className="max-w-7xl w-full mx-auto p-4 md:p-8 flex-1 space-y-6">
        {/* Bộ chọn ca thi & Thanh điều khiển thời gian thực */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Ca thi đang giám sát
            </span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer min-w-[280px]"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} — {s.name} ({resolveSessionStatus(s.status, s.startTime, s.endTime)})
                </option>
              ))}
            </select>

            <span
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border ${
                currentStatus === 'RUNNING'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : currentStatus === 'SCHEDULED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {currentStatus === 'RUNNING' ? 'Đang diễn ra' : currentStatus === 'SCHEDULED' ? 'Chưa bắt đầu' : 'Đã kết thúc'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              <span>Tự động cập nhật <strong className="text-slate-700 font-medium">{autoRefresh ? `${countdown}s` : 'Đã tắt'}</strong></span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="ml-1 text-[10px] text-indigo-600 hover:underline font-medium cursor-pointer"
              >
                {autoRefresh ? 'Dừng' : 'Bật'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 transition cursor-pointer disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddCandModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Bổ sung thí sinh khẩn cấp</span>
            </button>
          </div>
        </div>

        {/* Cụm 1: Kiểm soát cửa ngõ phòng thi & Mật khẩu phòng thi 6 số */}
        {activeSession && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Card Mật khẩu phòng thi */}
            <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
              <svg
                className="pointer-events-none absolute -right-14 -top-16 w-64 h-64 text-indigo-400/15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                viewBox="0 0 200 200"
              >
                <circle cx="100" cy="100" r="90" />
                <circle cx="100" cy="100" r="62" />
                <circle cx="100" cy="100" r="34" />
              </svg>

              <div className="space-y-4 relative">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    Mã phòng thi
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">#{activeSession.id}</span>
                </div>

                <h2 className="text-lg font-semibold tracking-tight leading-tight">{activeSession.name}</h2>

                <div>
                  <p className="text-[11px] text-slate-400 mb-2">Mật khẩu thí sinh dùng để vào phòng</p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-2 text-2xl md:text-3xl font-mono tracking-[0.3em] text-white">
                      {activeSession.roomPassword || '—'}
                    </div>
                    {activeSession.roomPassword && (
                      <button
                        type="button"
                        onClick={() => handleCopyPin(activeSession.roomPassword || '')}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg text-xs font-medium border border-white/10 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewPin(`${Math.floor(100000 + Math.random() * 900000)}`);
                        setShowEditPinModal(true);
                      }}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      Đổi PIN
                    </button>
                  </div>
                </div>
              </div>

              {/* Điều khiển trạng thái ca thi */}
              <div className="pt-4 mt-6 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 text-[11px]">
                  {new Date(activeSession.startTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} – {new Date(activeSession.endTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-2">
                  {onUpdateSessionStatus && (
                    currentStatus === 'RUNNING' ? (
                      <button
                        type="button"
                        onClick={() => onUpdateSessionStatus(activeSession.id, 'SCHEDULED')}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 rounded-lg text-[11px] font-medium cursor-pointer"
                      >
                        Tạm dừng
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateSessionStatus(activeSession.id, 'RUNNING')}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-emerald-300 border border-white/10 rounded-lg text-[11px] font-medium cursor-pointer"
                      >
                        Bắt đầu
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* 4 Thẻ KPI Giám Sát */}
            <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Tổng thí sinh</span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-semibold text-slate-900">{stats.total}</span>
                </div>
                <div className="text-[10px] text-slate-400">Đã phân công vào ca</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Đã khóa thiết bị</span>
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-semibold text-emerald-600">{stats.locked}</span>
                </div>
                <div className="text-[10px] text-slate-400">Ghim một thiết bị</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Đang thi</span>
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-semibold text-indigo-600">{Math.max(0, stats.locked - stats.submitted)}</span>
                </div>
                <div className="text-[10px] text-slate-400">Đã điểm danh</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Đã nộp bài</span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="my-2">
                  <span className="text-2xl md:text-3xl font-semibold text-slate-900">{stats.submitted}</span>
                </div>
                <div className="text-[10px] text-slate-400">Kết quả chấm tự động</div>
              </div>
            </div>
          </div>
        )}

        {/* Cụm 2 & 3: Lưới Giám Sát Thí Sinh Trực Tiếp & Nhật Ký An Ninh */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CỘT TRÁI (8 CỘT): Lưới Thí Sinh Trong Phòng Thi */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Danh sách thí sinh</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {filteredCandidates.length}/{stats.total}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Trạng thái điểm danh và khóa thiết bị theo thời gian thực
                </p>
              </div>

              {/* Bộ lọc tab */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${filterStatus === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Tất cả ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('LOCKED')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${filterStatus === 'LOCKED' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-emerald-700'}`}
                >
                  Khóa máy ({stats.locked})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('SUBMITTED')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${filterStatus === 'SUBMITTED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
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
                placeholder="Tìm theo họ tên, mã sinh viên hoặc email"
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Danh sách Thẻ Thí sinh */}
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12 space-y-1.5 border border-dashed border-slate-200 rounded-xl">
                <svg className="w-6 h-6 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-xs font-medium text-slate-600">Không tìm thấy thí sinh phù hợp</p>
                <p className="text-[11px] text-slate-400">Thay đổi bộ lọc hoặc bổ sung thí sinh vào ca thi</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {filteredCandidates.map((c) => (
                  <div
                    key={c.email}
                    className={`p-4 rounded-xl border transition-colors flex flex-col justify-between space-y-3 ${
                      c.isLocked
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : c.isSubmitted
                        ? 'border-slate-200 bg-slate-50/50'
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
                            className="w-11 h-13 rounded-lg object-cover border border-slate-200 bg-slate-100"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-11 h-13 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-medium text-xs">
                            {c.name.trim().charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        {c.isLocked && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center" title="Đã khóa thiết bị">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>

                      {/* Thông tin thí sinh */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-semibold text-slate-900 truncate" title={c.name}>
                            {c.name}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                            {c.studentCode}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 truncate" title={c.email}>
                          {c.email}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {c.isLocked ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Đã khóa thiết bị
                            </span>
                          ) : c.isSubmitted ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Đã nộp bài{c.score !== null ? ` · ${c.score} điểm` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                              Chưa vào phòng
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Thao tác của Giám thị */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400">
                        {c.isLocked ? `Thiết bị ${c.deviceToken ? c.deviceToken.slice(0, 8) : 'đã ghim'}` : 'Chưa điểm danh'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {c.isLocked && (
                          <button
                            type="button"
                            onClick={() => handleUnlockCandidate(c.email, c.name)}
                            disabled={unlockLoadingEmail === c.email}
                            className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-md text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                            title="Mở khóa để thí sinh chuyển sang máy khác"
                          >
                            {unlockLoadingEmail === c.email ? 'Đang mở...' : 'Mở khóa máy'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CỘT PHẢI (4 CỘT): Nhật Ký An Ninh & Cảnh Báo */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 tracking-tight">
                  Nhật ký an ninh
                </h3>
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Thời gian thực
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sự kiện sinh trắc học, khóa thiết bị và cảnh báo gửi qua Amazon SNS.
              </p>

              {/* Feed các sự kiện an ninh */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {securityEvents.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg">
                    <p className="text-[11px] text-slate-400">Chưa có sự kiện an ninh trong ca thi này</p>
                  </div>
                ) : (
                  securityEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        ev.level === 'DANGER'
                          ? 'bg-rose-50 border-rose-200 text-rose-900'
                          : ev.level === 'WARN'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : ev.level === 'SUCCESS'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-medium">
                        <span>
                          {ev.level === 'DANGER' && 'Khẩn cấp'}
                          {ev.level === 'WARN' && 'Cảnh báo'}
                          {ev.level === 'SUCCESS' && 'An toàn'}
                          {ev.level === 'INFO' && 'Thông tin'}
                        </span>
                        <span className="font-mono text-slate-400">{ev.time}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">{ev.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Nút gửi báo cáo qua SNS */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTriggerSnsAlert}
                  disabled={sendingSns}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{sendingSns ? 'Đang gửi báo cáo...' : 'Gửi báo cáo ca thi qua SNS'}</span>
                </button>
              </div>
            </div>

            {/* Hướng dẫn nghiệp vụ coi thi */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-2 text-xs">
              <h4 className="font-semibold text-slate-900">Quy trình coi thi</h4>
              <ul className="space-y-1.5 text-[11px] text-slate-500 list-disc pl-4 leading-relaxed">
                <li>Đọc mật khẩu phòng thi cho thí sinh khi bắt đầu giờ làm bài.</li>
                <li>Thí sinh điểm danh thành công sẽ tự động khóa vào thiết bị đang dùng.</li>
                <li>Nếu thí sinh gặp sự cố máy, chọn "Mở khóa máy" để cho phép chuyển máy.</li>
                <li>Thí sinh đến muộn có thể được bổ sung khẩn cấp vào ca thi.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: Đổi mật khẩu phòng thi 6 số */}
      {showEditPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Đổi mật khẩu phòng thi
              </h3>
              <button
                type="button"
                onClick={() => setShowEditPinModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mật khẩu mới có hiệu lực ngay. Thí sinh chưa vào phòng sẽ dùng mã này để đăng nhập.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Mật khẩu mới (6 chữ số)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-center text-lg font-mono tracking-widest outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  onClick={() => setNewPin(`${Math.floor(100000 + Math.random() * 900000)}`)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                >
                  Tạo ngẫu nhiên
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditPinModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSavePin}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer"
              >
                Lưu mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Bổ sung nhanh thí sinh khẩn cấp */}
      {showAddCandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Bổ sung thí sinh khẩn cấp
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCandModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Chọn thí sinh có sẵn trong danh mục hoặc nhập email để cấp quyền vào phòng thi.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Thí sinh chưa có trong ca thi
                </label>
                <select
                  value={selectedAddEmail}
                  onChange={(e) => {
                    setSelectedAddEmail(e.target.value);
                    if (e.target.value) setCustomAddEmail('');
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                >
                  <option value="">Chọn từ danh mục</option>
                  {candidatesNotInSession.map((c) => (
                    <option key={c.email} value={c.email}>
                      {c.name} ({c.studentCode}) — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center justify-center text-[11px] text-slate-400">
                <span className="bg-white px-2">hoặc nhập email</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email thí sinh
                </label>
                <input
                  type="email"
                  value={customAddEmail}
                  onChange={(e) => {
                    setCustomAddEmail(e.target.value);
                    if (e.target.value) setSelectedAddEmail('');
                  }}
                  placeholder="vidu@vnu.edu.vn"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddCandModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddCandidateEmergency}
                disabled={!selectedAddEmail && !customAddEmail}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
              >
                Cấp quyền vào phòng thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-3 px-4 text-center text-[11px] text-slate-400">
        CloudExam · Bàn giám sát phòng thi
      </footer>
    </div>
  );
};
