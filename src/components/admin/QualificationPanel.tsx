import React, { useState } from 'react';
import { Round, LeaderboardEntry } from '../../types';
import { api } from '../../api';
import {
  Award,
  CheckCircle2,
  Users,
  Lock,
  Zap,
  Play,
  Layers,
  Sparkles
} from 'lucide-react';

interface QualificationPanelProps {
  rounds: Round[];
  onRefresh: () => void;
}

export const QualificationPanel: React.FC<QualificationPanelProps> = ({
  rounds,
  onRefresh
}) => {
  const [cutoffRank, setCutoffRank] = useState<number>(15);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [resultSummary, setResultSummary] = useState<{
    qualifiedCount: number;
    qualifiedParticipants: LeaderboardEntry[];
  } | null>(null);

  const round1 = rounds.find(r => r.id === 'round-1');
  const round2 = rounds.find(r => r.id === 'round-2');

  const handleFinalize = async () => {
    const confirm = window.confirm(
      `Are you sure you want to finalize Round 1? Top ${cutoffRank} non-disqualified candidates will be promoted and assigned Round 2 question sets.`
    );
    if (!confirm) return;

    setIsFinalizing(true);
    try {
      const res = await api.finalizeRound1(cutoffRank);
      setResultSummary({
        qualifiedCount: res.qualifiedCount,
        qualifiedParticipants: res.qualifiedParticipants
      });
      onRefresh();
    } catch (e: any) {
      alert(e.message || 'Finalization failed');
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs">
        <div className="flex items-center space-x-3 mb-2">
          <Award className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            Automated Round 2 Qualification Pipeline
          </h2>
        </div>
        <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
          Evaluate Round 1 leaderboard standings, lock qualifier results, and automatically assign Round 2 Championship Problem Sets (Set D & Set E) to top-performing candidates.
        </p>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Round 1 Finalization Action Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              1. Round 1 Status & Promotion Cutoff
            </h3>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                round1?.status === 'FINALIZED'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {round1?.status === 'FINALIZED' ? 'LOCKED & FINALIZED' : 'ROUND 1 ACTIVE'}
            </span>
          </div>

          <div className="space-y-3 text-xs text-gray-600">
            <div>
              <label className="font-bold text-gray-700 block mb-1">
                Qualification Cutoff Rank (Top N Candidates)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={cutoffRank}
                  disabled={round1?.status === 'FINALIZED'}
                  onChange={e => setCutoffRank(parseInt(e.target.value, 10) || 15)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold w-28"
                />
                <span className="text-gray-400">Default: Top 15 out of 60</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              * Candidates with terminated sessions due to 3 tab switches are automatically disqualified and skipped.
            </p>
          </div>

          <button
            id="finalize-round1-btn"
            disabled={round1?.status === 'FINALIZED' || isFinalizing}
            onClick={handleFinalize}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {round1?.status === 'FINALIZED' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Round 1 Already Finalized</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>{isFinalizing ? 'Evaluating Leaderboard...' : 'Execute Round 1 Cutoff & Promote to Round 2'}</span>
              </>
            )}
          </button>
        </div>

        {/* Round 2 Championship State Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              2. Round 2 Championship Status
            </h3>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                round2?.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {round2?.status || 'UPCOMING'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-gray-600">
            <p>• Championship Duration: <span className="font-semibold text-gray-900">120 Minutes</span></p>
            <p>• Advanced Sets: <span className="font-semibold text-gray-900">Set D & Set E (Segment Trees & Tries)</span></p>
            <p>
              • Qualified Finalists:{' '}
              <span className="font-semibold text-emerald-700">
                {round2?.qualifiedParticipantIds?.length || 0} Candidates
              </span>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900 flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              When Round 1 is finalized, access controls dynamically unlock the Coding Arena exclusively for qualified finalists while keeping practice mode for others.
            </p>
          </div>
        </div>
      </div>

      {/* Post-Finalization Promotion Roster */}
      {resultSummary && (
        <div className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-black text-gray-900">
              Round 2 Qualified Finalists ({resultSummary.qualifiedCount})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {resultSummary.qualifiedParticipants.map(q => (
              <div key={q.userId} className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs">
                <div className="font-bold text-gray-900">#{q.rank} {q.name}</div>
                <div className="text-[11px] text-gray-500">{q.college}</div>
                <div className="font-mono text-[10px] text-blue-600 font-bold mt-1">
                  Score: {q.totalScore} pts • {q.solvedCount} Solved
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
