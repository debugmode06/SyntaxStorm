import React, { useState, useEffect } from 'react';
import { ContestAttempt, Contest, Round, User } from '../types';
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Code2,
  Terminal,
  Sparkles,
  Loader2,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';

interface PreparationCountdownModalProps {
  attempt: ContestAttempt;
  contest: Contest | null;
  round: Round | null;
  currentUser: User | null;
  onCountdownComplete: () => void;
}

export const PreparationCountdownModal: React.FC<PreparationCountdownModalProps> = ({
  attempt,
  contest,
  round,
  currentUser,
  onCountdownComplete
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [checklistIndex, setChecklistIndex] = useState<number>(0);

  // Guarantee a full 30-second countdown (30, 29, 28... 0) when modal opens
  useEffect(() => {
    setSecondsRemaining(30);
    setChecklistIndex(0);

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            onCountdownComplete();
          }, 200);
          return 0;
        }
        const next = prev - 1;
        const elapsed = 30 - next;
        if (elapsed >= 5 && elapsed < 12) setChecklistIndex(1);
        else if (elapsed >= 12 && elapsed < 20) setChecklistIndex(2);
        else if (elapsed >= 20 && elapsed < 27) setChecklistIndex(3);
        else if (elapsed >= 27) setChecklistIndex(4);

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onCountdownComplete]);

  const checklistItems = [
    { label: 'Candidate Identity & Batch Sandboxing Verified', status: checklistIndex >= 0 },
    { label: 'Unique Algorithmic Problem Set Permuted & Assigned', status: checklistIndex >= 1 },
    { label: 'Anti-Cheat Surveillance & Tab Switch Sentinel Initialized', status: checklistIndex >= 2 },
    { label: 'Isolated Monaco Code Workspace & Sandboxed Judge Ready', status: checklistIndex >= 3 },
    { label: 'Entering Fullscreen Secure Arena', status: checklistIndex >= 4 }
  ];

  const progressPercent = Math.min(100, Math.max(0, ((30 - secondsRemaining) / 30) * 100));

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 text-center shadow-2xl border border-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Badges */}
        <div className="flex items-center justify-center gap-2">
          <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Secure Environment Provisioning</span>
          </span>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            GET READY TO CODE
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Your private, sandboxed coding environment is initializing. Entering full screen automatically in 30 seconds.
          </p>
        </div>

        {/* Big 30s Countdown Circular Metric */}
        <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
          {/* Circular Progress Ring */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-gray-100"
              strokeWidth="7"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-blue-600 transition-all duration-1000 ease-linear"
              strokeWidth="7"
              strokeDasharray="276.46"
              strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Center Countdown Number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              id="preparation-countdown-timer"
              className="font-mono text-4xl sm:text-5xl font-black text-gray-900 tracking-tighter"
            >
              {secondsRemaining}
            </span>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
              Seconds Left
            </span>
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 sm:p-5 text-left space-y-2.5">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Initialization Status</span>
            <span className="text-blue-600 font-mono">{progressPercent.toFixed(0)}%</span>
          </div>

          {checklistItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 text-xs">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                {item.status ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                ) : checklistIndex === idx - 1 ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-300 mx-auto" />
                )}
              </div>
              <span className={`font-semibold ${item.status ? 'text-gray-900' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Instant Launch Action Button */}
        <button
          id="enter-arena-now-btn"
          onClick={onCountdownComplete}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          <span>Enter Coding Arena Now</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Candidate & Session Info Footer */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-100 pt-4 px-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Candidate: <strong>{currentUser?.name || 'Participant'}</strong></span>
          </div>
          <span className="font-mono text-gray-400">ID: {currentUser?.id || 'usr-cand'}</span>
        </div>

      </div>
    </div>
  );
};
