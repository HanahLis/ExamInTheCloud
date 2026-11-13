import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '../services/apiService';
import { useTranslation } from '../locales/i18nContext';

interface Props {
  sessionId: string;
  currentEmail?: string;
  pollIntervalMs?: number;
}

const rankStyles = ['bg-amber-50 text-amber-700 border-amber-200', 'bg-slate-100 text-slate-600 border-slate-200', 'bg-orange-50 text-orange-700 border-orange-200'];

export const LiveLeaderboard = ({ sessionId, currentEmail = '', pollIntervalMs = 15000 }: Props) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetchLeaderboard(sessionId);
        if (!isMounted) return;
        setEntries(res.leaderboard || []);
        setLoaded(true);
      } catch (err) {
        console.warn('[Leaderboard] Lỗi tải bảng xếp hạng:', err);
      }
    };
    load();
    const interval = setInterval(load, pollIntervalMs);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, pollIntervalMs]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21h8m-4-4v4m-4-9V4h8v8a4 4 0 01-8 0zM4 5h4v4a4 4 0 01-4-4zm16 0h-4v4a4 4 0 004-4z" />
          </svg>
          {t('exam_leaderboard_title')}
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          {t('exam_leaderboard_live')}
        </span>
      </div>

      {loaded && entries.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-3">{t('exam_leaderboard_empty')}</p>
      )}

      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry) => {
            const isMe = currentEmail && (entry.candidateEmail || '').toLowerCase() === currentEmail.toLowerCase();
            return (
              <div
                key={`${entry.candidateEmail}-${entry.rank}`}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${isMe ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}
              >
                <span className={`w-6 h-6 rounded-md border text-[11px] font-semibold flex items-center justify-center shrink-0 ${rankStyles[entry.rank - 1] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {entry.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isMe ? 'text-indigo-950' : 'text-slate-800'}`}>
                    {entry.name || entry.candidateEmail}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate font-mono">{entry.candidateEmail}</p>
                </div>
                <span className="font-mono font-semibold text-slate-900 shrink-0">
                  {entry.score} <span className="text-[10px] font-normal text-slate-400">{t('exam_points_unit')}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
