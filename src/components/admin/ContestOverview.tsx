import React, { useState } from 'react';
import { Contest, Batch, Round, SystemHealth } from '../../types';
import { api } from '../../api';
import {
  Play,
  Pause,
  Clock,
  Users,
  Activity,
  Server,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ContestOverviewProps {
  contest: Contest | null;
  batches: Batch[];
  rounds: Round[];
  systemHealth: SystemHealth | null;
  onRefresh: () => void;
  onOpenCreateContest?: () => void;
}

export const ContestOverview: React.FC<ContestOverviewProps> = ({
  contest,
  batches,
  rounds,
  systemHealth,
  onRefresh,
  onOpenCreateContest
}) => {
  const [loadingAction, setLoadingAction] = useState(false);

  const togglePause = async () => {
    if (!contest) return;
    setLoadingAction(true);
    try {
      await api.updateContestControl(contest.id, { isPaused: !contest.isPaused });
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Contest Status & Quick Control Hero */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              {contest?.title || 'Contest Control Center'}
            </h2>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                contest?.isPaused
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {contest?.isPaused ? 'Contest Paused' : 'Live & Active'}
            </span>
          </div>
          <p className="text-xs text-gray-500 max-w-2xl">
            {contest?.description}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {onOpenCreateContest && (
            <button
              onClick={onOpenCreateContest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              + Create New Contest
            </button>
          )}

          <button
            id="admin-pause-toggle-btn"
            disabled={loadingAction}
            onClick={togglePause}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-xs cursor-pointer ${
              contest?.isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {contest?.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{contest?.isPaused ? 'Resume Contest' : 'Emergency Pause'}</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Candidates</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">60</div>
          <p className="text-[11px] text-gray-500 mt-1">30 Batch A • 30 Batch B</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Contest</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">
            {contest?.title || 'CodeArena 2026'}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Contest Status: Live</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Judge Worker Queue</span>
            <Server className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">
            {systemHealth?.queuedJobs || 0} <span className="text-xs font-medium text-gray-400">queued</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {systemHealth?.activeWorkers || 0} / {systemHealth?.totalWorkers || 4} Workers Active
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">System Stability</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {systemHealth?.status || 'HEALTHY'}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Avg Latency: {systemHealth?.avgExecutionTimeMs || 45}ms
          </p>
        </div>
      </div>

      {/* Batch Slots Timeline */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          Multi-Batch Scheduling Matrix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {batches.map(b => (
            <div
              key={b.id}
              className={`p-5 rounded-2xl border ${
                b.isActive
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-extrabold text-sm text-gray-900">{b.name}</span>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                    b.isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {b.isActive ? 'ACTIVE NOW' : 'SCHEDULED'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-gray-600">
                <p>• Assigned Candidates: <span className="font-semibold text-gray-900">{b.participantCount} users</span></p>
                <p>• Time Slot: <span className="font-semibold text-gray-900">{b.startTime ? new Date(b.startTime).toLocaleTimeString() : 'N/A'} - {b.endTime ? new Date(b.endTime).toLocaleTimeString() : 'N/A'}</span></p>
                <p>• Slot Duration: <span className="font-semibold text-gray-900">{b.slotDurationMinutes} mins</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
