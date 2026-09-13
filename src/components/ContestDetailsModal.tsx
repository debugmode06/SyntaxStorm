import React from 'react';
import { Contest, Round, Batch, ContestAttempt } from '../types';
import {
  X,
  Trophy,
  Clock,
  Code2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Award,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface ContestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contest: Contest | null;
  round: Round | null;
  batch: Batch | null;
  attempt: ContestAttempt | null;
  onStartContest: () => void;
}

export const ContestDetailsModal: React.FC<ContestDetailsModalProps> = ({
  isOpen,
  onClose,
  contest,
  round,
  batch,
  attempt,
  onStartContest
}) => {
  if (!isOpen) return null;

  const isCompleted = attempt?.status === 'COMPLETED' || attempt?.status === 'SUBMITTING' || attempt?.status === 'DISQUALIFIED';
  const isTerminated = attempt?.status === 'TERMINATED_SECURITY';
  const isExpired = attempt?.status === 'EXPIRED';
  const isActive = attempt?.status === 'ACTIVE' || attempt?.status === 'IN_PROGRESS';
  const isPreparing = attempt?.status === 'PREPARING';
  const canStart = !isCompleted && !isTerminated && !isExpired;

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                {contest?.description?.includes('Apex') ? 'Apex Code Grand Prix 2026' : 'Inter-Collegiate Contest'}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                {contest?.title || 'Algorithmic Arena 2026'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 sm:px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Key Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Status</span>
              <span className="font-extrabold text-sm text-emerald-600">Active Live</span>
            </div>
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Attempt Duration</span>
              <span className="font-extrabold text-sm text-gray-900">90 Minutes</span>
            </div>
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Problems</span>
              <span className="font-extrabold text-sm text-gray-900">{round?.totalQuestions || 3} Tasks</span>
            </div>
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Assigned Batch</span>
              <span className="font-extrabold text-sm text-indigo-700 truncate block">{batch?.name || 'Batch A'}</span>
            </div>
          </div>

          {/* Status Alert if already attempted or terminated */}
          {isCompleted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-emerald-900">Attempt Already Completed</h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  You have already completed and submitted your solutions for this round. Check the Results tab to view your performance breakdown.
                </p>
              </div>
            </div>
          )}

          {isTerminated && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-red-900">Attempt Terminated (Security Lockout)</h4>
                <p className="text-[11px] text-red-700 mt-0.5">
                  This attempt was automatically submitted and locked out due to exceeding the maximum allowed tab switch threshold (3/3).
                </p>
              </div>
            </div>
          )}

          {/* Contest Structure & Scoring */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
              Evaluation & Scoring Summary
            </h3>
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs text-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">• Maximum Score:</span>
                <span className="font-bold text-gray-900">300 Points (100 pts per problem)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">• Grading Model:</span>
                <span className="font-bold text-gray-900">Automated Sandbox Judge (Time & Memory limits)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">• Leaderboard Progression:</span>
                <span className="font-bold text-blue-700">Live Evaluation & Automated Grading</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">• Supported Languages:</span>
                <span className="font-bold text-gray-900">Python 3, JavaScript (Node.js), C++</span>
              </div>
            </div>
          </div>

          {/* Important Rules */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
              Important Integrity Rules
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-gray-600 bg-white border border-gray-100 rounded-xl p-3 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-gray-900">Max 3 Tab Switches Allowed:</span> Switching browser tabs or minimizing the window triggers warning counts. Exceeding 3 switches terminates the session and auto-submits all work.
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-gray-600 bg-white border border-gray-100 rounded-xl p-3 shadow-2xs">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-gray-900">Server-Authoritative Countdown:</span> When the round duration expires, all latest code snapshots are automatically submitted to the judge.
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-gray-600 bg-white border border-gray-100 rounded-xl p-3 shadow-2xs">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-gray-900">30-Second Preparation Phase:</span> After agreeing to contest terms, a 30-second preparation countdown initializes your sandboxed environment before problems are unveiled.
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 sm:px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-200 transition cursor-pointer"
          >
            Close
          </button>

          {canStart && (
            <button
              id="start-contest-flow-btn"
              onClick={onStartContest}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{isActive ? 'Resume Contest Arena' : isPreparing ? 'Resume Preparation (30s)' : 'Start Contest'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
