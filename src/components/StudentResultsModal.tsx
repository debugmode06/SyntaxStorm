import React, { useState, useEffect } from 'react';
import { User, Contest, Round, Submission, LeaderboardEntry } from '../types';
import { api } from '../api';
import {
  X,
  Trophy,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  FileCode
} from 'lucide-react';

interface StudentResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  contest: Contest | null;
  round: Round | null;
}

export const StudentResultsModal: React.FC<StudentResultsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  contest,
  round
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setLoading(true);

    Promise.all([
      api.getSubmissions({ userId: currentUser.id, roundId: round?.id }),
      api.getLeaderboard(round?.id).catch(() => ({ leaderboard: [] }))
    ])
      .then(([subRes, leadRes]) => {
        setSubmissions(subRes.submissions || []);
        setLeaderboard(leadRes.leaderboard || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, currentUser?.id, round?.id]);

  if (!isOpen) return null;

  const myRankEntry = leaderboard.find(l => l.userId === currentUser?.id);
  const totalScore = submissions.reduce((acc, s) => acc + (s.score || 0), 0);
  const passedCount = submissions.filter(s => s.status === 'ACCEPTED').length;
  const isQualified = myRankEntry ? myRankEntry.rank <= (round?.cutoffRank || 15) : totalScore >= 100;

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-blue-50/30 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Official Contest Assessment Report
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                {currentUser?.name}'s Contest Results
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

        {/* Body */}
        <div className="px-6 sm:px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Rank</span>
              <span className="font-extrabold text-2xl text-gray-900">
                {myRankEntry?.rank ? `#${myRankEntry.rank}` : '--'}
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Total Score</span>
              <span className="font-extrabold text-2xl text-blue-700">
                {myRankEntry?.totalScore ?? totalScore} <span className="text-xs text-gray-500 font-normal">pts</span>
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Solved Tasks</span>
              <span className="font-extrabold text-2xl text-emerald-700">
                {passedCount} / {submissions.length || 3}
              </span>
            </div>
          </div>

          {/* Submissions Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
              Evaluated Problem Submissions ({submissions.length})
            </h3>

            {submissions.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                No submissions recorded yet for this round.
              </div>
            ) : (
              <div className="space-y-2.5">
                {submissions.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-4 rounded-2xl bg-white border border-gray-200/80 hover:border-gray-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900">
                          Problem #{sub.problemId}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          sub.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sub.status === 'WRONG_ANSWER'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sub.status}
                        </span>
                        {(sub as any).isAutoSubmitted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            Auto-Submitted
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-3 font-mono">
                        <span>Language: {sub.language}</span>
                        <span>• Execution: {sub.executionTimeMs || 42}ms</span>
                        <span>• Memory: {sub.memoryUsedMb ? `${sub.memoryUsedMb}MB` : '12MB'}</span>
                      </p>
                    </div>

                    <div className="text-right sm:self-center">
                      <span className="font-bold text-sm text-gray-900 block">
                        {sub.score || 0} / {sub.maxScore || 10} marks
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        {sub.passedTests || 0} / {sub.totalTests || 5} test cases passed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 sm:px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
