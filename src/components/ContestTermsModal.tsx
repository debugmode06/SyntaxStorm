import React, { useState } from 'react';
import { X, ShieldAlert, CheckSquare, Square, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

interface ContestTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptAndContinue: () => void;
  contestTitle?: string;
  roundName?: string;
}

export const ContestTermsModal: React.FC<ContestTermsModalProps> = ({
  isOpen,
  onClose,
  onAcceptAndContinue,
  contestTitle = 'Apex Code Grand Prix 2026',
  roundName = 'Round 1: Preliminary Algorithmic Challenge'
}) => {
  const [agreed, setAgreed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      await onAcceptAndContinue();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 via-blue-50/30 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Integrity Agreement & Code of Conduct
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                Contest Terms & Conditions
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

        {/* Scrollable Terms Content */}
        <div className="px-6 sm:px-8 py-5 space-y-4 max-h-[60vh] overflow-y-auto text-xs text-gray-700 leading-relaxed">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-indigo-950">
            <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Please review the following competitive programming guidelines carefully. Once you click <strong>Agree & Continue</strong>, your <strong>30-second preparation countdown</strong> will start immediately.
            </p>
          </div>

          <div className="space-y-3 font-normal text-gray-600">
            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">1. Individual Participation & Originality</h4>
              <p>Every participant must solve the assigned algorithmic tasks independently. No collaborative communication, pair programming, or third-party assistance is allowed.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">2. Strict Anti-Cheat & Tab Switch Limits (3 Maximum)</h4>
              <p>The coding environment runs in active surveillance mode. Switching tabs, minimizing windows, or opening external browser instances triggers security violation counts. Reaching <strong>3 tab switches will immediately lock out your session and auto-submit your current saved code snapshots</strong>.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">3. Clipboard & Keyboard Policy</h4>
              <p>Copying problem statements and pasting external code into the editor is disabled and logged by the integrity engine. All code must be written within the provided Monaco editor.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">4. Continuous Autosave Protection</h4>
              <p>Your code is automatically snapshot and saved to the server continuously. In the event of network disruption, your most recent saved code remains intact.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">5. Timed Round Duration & Automatic Submission</h4>
              <p>The round duration is strict and server-authoritative. When the timer hits 00:00:00, all problems are automatically submitted for final sandbox evaluation.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">6. Sandbox Judge Execution Limits</h4>
              <p>Code executions have strict runtime timeouts (2.0s per test case) and memory bounds (128MB). Infinite loops or excessive resource allocations will receive a Time Limit Exceeded (TLE) or Memory Limit Exceeded (MLE) verdict.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">7. Real-Time AST Plagiarism Surveillance</h4>
              <p>All submitted solutions are automatically parsed into Abstract Syntax Trees (AST) and cross-compared against all participants to detect disguised collusion or variable renaming.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">8. Single Attempt per Contestant</h4>
              <p>Each registered student is granted one official attempt for the assigned round. Once submitted or terminated, re-entry is blocked unless authorized by the Chief Jury.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">9. Official Leaderboard Ranking</h4>
              <p>Top participants with highest scores and fastest problem solving times will be featured on the official live leaderboard.</p>
            </div>

            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-2xs space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">10. Jury Decision Finality</h4>
              <p>The organizers and evaluation jury reserve the right to review audit trails, flag anomalous activities, and enforce disciplinary actions if integrity rules are breached.</p>
            </div>
          </div>
        </div>

        {/* Agreement Checkbox & Actions */}
        <div className="px-6 sm:px-8 py-5 bg-gray-50 border-t border-gray-100 space-y-4">
          
          <label className="flex items-start gap-3 cursor-pointer select-none group">
            <div className="pt-0.5">
              <input
                type="checkbox"
                id="terms-agree-checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                agreed ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'border-gray-300 bg-white group-hover:border-indigo-400'
              }`}>
                {agreed ? <CheckSquare className="w-3.5 h-3.5" /> : null}
              </div>
            </div>
            <span className="text-xs font-bold text-gray-800 leading-snug">
              I have read, understood, and agree to abide by all the contest terms, rules, and integrity surveillance policies.
            </span>
          </label>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-200 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="agree-and-continue-btn"
              onClick={handleConfirm}
              disabled={!agreed || submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{submitting ? 'Initializing...' : 'Agree & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
