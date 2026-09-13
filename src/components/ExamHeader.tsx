import React, { useState, useEffect, useRef } from 'react';
import { User, Round, ParticipantSecurityState, Contest, ContestAttempt } from '../types';
import { Clock, ShieldAlert, ShieldCheck, UserCheck, AlertTriangle, Send } from 'lucide-react';

interface ExamHeaderProps {
  currentUser: User | null;
  activeRound: Round | null;
  contest: Contest | null;
  securityState: ParticipantSecurityState | null;
  attempt?: ContestAttempt | null;
  onExitTest?: () => void;
  onSubmitTest?: () => void;
  onTimeExpired?: () => void;
}

export const ExamHeader: React.FC<ExamHeaderProps> = ({
  currentUser,
  activeRound,
  contest,
  securityState,
  attempt,
  onExitTest,
  onSubmitTest,
  onTimeExpired
}) => {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('--:--:--');
  const [isLowTime, setIsLowTime] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const hasTriggeredExpiryRef = useRef<boolean>(false);

  // Live timer countdown calculation with robust self-healing
  useEffect(() => {
    const roundMinutes = activeRound?.durationMinutes || 60;
    const defaultDurationMs = roundMinutes * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const targetEndTime = attempt?.expiresAt || attempt?.contestEndTime || activeRound?.endTime || contest?.endTime;
      let endMs = targetEndTime ? new Date(targetEndTime).getTime() : 0;
      let diff = endMs - now;

      // If timestamp is missing, invalid, in the past, or unreasonably small (< 10 seconds)
      // while the student is in an active assessment:
      const isActiveAttempt = !attempt || ['IN_PROGRESS', 'ACTIVE', 'PREPARING', 'NOT_STARTED'].includes(attempt.status);
      if ((diff <= 10000 || isNaN(diff)) && isActiveAttempt) {
        // Calculate remaining time from attempt startedAt or fallback to full round duration
        const startMs = attempt?.startedAt ? new Date(attempt.startedAt).getTime() : now;
        const elapsedSinceStart = Math.max(0, now - startMs);
        if (elapsedSinceStart < defaultDurationMs && elapsedSinceStart > 0) {
          diff = defaultDurationMs - elapsedSinceStart;
        } else {
          // If startedAt was a previous day or old session, give standard round duration
          diff = defaultDurationMs;
        }
      }

      diff = Math.max(0, diff);
      const totalSeconds = Math.floor(diff / 1000);
      setSecondsRemaining(totalSeconds);

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setTimeLeftStr(formatted);
      setIsLowTime(totalSeconds < 600 && totalSeconds > 0); // under 10 minutes

      if (totalSeconds <= 0 && isActiveAttempt && !hasTriggeredExpiryRef.current) {
        hasTriggeredExpiryRef.current = true;
        if (onTimeExpired) onTimeExpired();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [attempt?.expiresAt, attempt?.contestEndTime, attempt?.startedAt, attempt?.status, activeRound?.endTime, activeRound?.durationMinutes, contest?.endTime]);

  const switchCount = securityState?.tabSwitchCount ?? attempt?.tabSwitchCount ?? 0;
  const maxSwitches = securityState?.maxAllowedSwitches ?? attempt?.maxTabSwitches ?? contest?.settings?.maxTabSwitches ?? 3;
  const remainingSwitches = Math.max(0, maxSwitches - switchCount);

  const getSwitchBadgeStyle = () => {
    if (switchCount === 0) {
      return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    }
    if (switchCount < maxSwitches) {
      return 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse';
    }
    return 'bg-rose-50 border-rose-300 text-rose-800 font-black animate-bounce';
  };

  return (
    <header
      id="exam-header-bar"
      className="w-full bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 shadow-xs sticky top-0 z-40"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Round & Contest Minimal Label */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0 font-bold text-xs">
            {activeRound?.roundNumber ? `R${activeRound.roundNumber}` : 'EX'}
          </div>
          <div className="truncate">
            <h1 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
              {activeRound?.name || contest?.title || 'Examination Session'}
            </h1>
            <p className="text-[10px] text-gray-500 font-medium truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              Live Assessment Mode • Strict Anti-Cheat Active
            </p>
          </div>
        </div>

        {/* Center: Live Timer Countdown & Tab Switch Status */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* 1. Time Duration Left */}
          <div
            id="exam-countdown-timer"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold transition ${
              isLowTime
                ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse shadow-xs'
                : 'bg-gray-50 border-gray-200 text-gray-900'
            }`}
            title="Time Remaining in this Round"
          >
            <Clock className={`w-4 h-4 ${isLowTime ? 'text-rose-600' : 'text-blue-600'}`} />
            <div>
              <span className="hidden sm:inline text-[10px] text-gray-500 uppercase tracking-wider font-sans font-semibold mr-1.5">
                Time Left:
              </span>
              <span className="tracking-wider">{timeLeftStr}</span>
            </div>
          </div>

          {/* 2. Number of Tab Switch Status */}
          <div
            id="exam-tab-switch-status"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${getSwitchBadgeStyle()}`}
            title={`Anti-Cheat Tab Monitor: ${switchCount} of ${maxSwitches} switches used.`}
          >
            {switchCount >= maxSwitches ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : switchCount > 0 ? (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <div className="flex items-center gap-1">
              <span className="hidden md:inline text-[10px] uppercase tracking-wider font-bold">Tab Switches:</span>
              <span className="font-mono font-bold">{switchCount} / {maxSwitches}</span>
              {switchCount >= maxSwitches && (
                <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-100 px-1 rounded">Locked</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Student Profile Icon with their Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            id="exam-student-profile"
            className="flex items-center gap-2.5 pl-2 py-1 rounded-xl bg-gray-50 border border-gray-200 pr-3"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-gray-900 leading-tight truncate max-w-[120px] lg:max-w-[160px]">
                {currentUser?.name || 'Student Candidate'}
              </div>
              <div className="text-[10px] text-gray-500 font-medium truncate">
                {currentUser?.studentId ? `ID: ${currentUser.studentId}` : currentUser?.email || 'Candidate'}
              </div>
            </div>
          </div>

          {/* Submit Test Button replacing Exit Button near user name */}
          {(onSubmitTest || onExitTest) && (
            <button
              id="exam-submit-test-btn"
              onClick={onSubmitTest || onExitTest}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Submit Complete Test & Evaluate Marks"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>Submit Test</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
