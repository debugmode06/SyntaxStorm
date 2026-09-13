import React, { useState } from 'react';
import { SystemHealth } from '../../types';
import { api } from '../../api';
import { Activity, Play, Zap, CheckCircle2, Server, Clock } from 'lucide-react';

interface SimulatorPanelProps {
  systemHealth: SystemHealth | null;
  onRefresh: () => void;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  systemHealth,
  onRefresh
}) => {
  const [userCount, setUserCount] = useState<number>(50);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [engineHealth, setEngineHealth] = useState<any>(null);
  const [simulationSummary, setSimulationSummary] = useState<{
    submissionsGenerated: number;
    antiCheatEventsTriggered: number;
    queuedCount: number;
  } | null>(null);

  React.useEffect(() => {
    api.getExecutionHealth().then(h => setEngineHealth(h)).catch(() => setEngineHealth({ healthy: false }));
  }, []);

  const triggerSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await api.runSimulation(userCount);
      setSimulationSummary(res);
      onRefresh();
    } catch (e: any) {
      alert(e.message || 'Simulation execution failed');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs">
        <div className="flex items-center space-x-3 mb-2">
          <Activity className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            50-Participant Load & Anti-Cheat Simulator
          </h2>
        </div>
        <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
          Stress-test the judging isolate queue by dispatching concurrent code submissions and security telemetry across 50 simulated college contestants simultaneously.
        </p>
      </div>

      {/* Simulator Control Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-5">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Load Generator Controls
          </h3>

          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-700 block">
              Simulated Concurrent Contestants:
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min={10}
                max={60}
                step={5}
                value={userCount}
                onChange={e => setUserCount(Number(e.target.value))}
                className="flex-1 accent-blue-600 cursor-pointer"
              />
              <span className="font-mono text-sm font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-xl border border-gray-200">
                {userCount} Users
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Dispatches parallel algorithmic submissions to the 4-worker judging queue and triggers random focus/tab-switch events.
            </p>
          </div>

          <button
            id="trigger-load-simulator-btn"
            disabled={isSimulating}
            onClick={triggerSimulation}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl flex items-center justify-center space-x-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSimulating ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Simulating High Concurrency...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Fire {userCount}-User Load Simulation</span>
              </>
            )}
          </button>
        </div>

        {/* Live Queue Monitor */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Judge Queue Throughput Telemetry
            </h3>
            {engineHealth && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase flex items-center space-x-1 ${
                engineHealth.healthy ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${engineHealth.healthy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span>{engineHealth.healthy ? 'Judge0 Engine Online' : 'Judge0 Unavailable'}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Active Workers</span>
              <div className="text-lg font-black text-gray-900 font-mono">
                {systemHealth?.activeWorkers || 0} / {systemHealth?.totalWorkers || 4}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Jobs In Queue</span>
              <div className="text-lg font-black text-blue-600 font-mono">
                {systemHealth?.queuedJobs || 0}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Completed Jobs</span>
              <div className="text-lg font-black text-emerald-600 font-mono">
                {systemHealth?.completedJobs || 0}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Avg Latency</span>
              <div className="text-lg font-black text-gray-900 font-mono">
                {systemHealth?.avgExecutionTimeMs || 45}ms
              </div>
            </div>
          </div>

          {simulationSummary && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Simulation Burst Enqueued Successfully:</span>
              </div>
              <p>• {simulationSummary.submissionsGenerated} code submissions sent to judge queue.</p>
              <p>• {simulationSummary.antiCheatEventsTriggered} focus/tab perturbations registered.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
