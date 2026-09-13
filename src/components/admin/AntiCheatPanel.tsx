import React, { useState, useEffect } from 'react';
import { ParticipantSecurityState, User, ContestAttempt, Submission, OverrideAuditRecord, QuestionAssignment, Contest } from '../../types';
import { api } from '../../api';
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Activity,
  FileText,
  Code2,
  History,
  Clock,
  ShieldCheck,
  RefreshCw,
  X,
  UserCheck,
  AlertOctagon,
  Building2,
  GraduationCap
} from 'lucide-react';

interface AuditDossier {
  student: User | null;
  contest: Contest;
  attempt: ContestAttempt;
  securityState: ParticipantSecurityState | null;
  submissions: Submission[];
  assignment: QuestionAssignment | null;
  overrideHistory: OverrideAuditRecord[];
}

export const AntiCheatPanel: React.FC = () => {
  const [matrix, setMatrix] = useState<(ParticipantSecurityState & { user: User | null })[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<(ParticipantSecurityState & { user: User | null }) | null>(null);
  const [dossier, setDossier] = useState<AuditDossier | null>(null);
  const [loadingDossier, setLoadingDossier] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'submissions' | 'code' | 'history'>('timeline');
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  
  // Confirmation & Reason modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMatrix = async () => {
    try {
      const res = await api.getSecurityMatrix();
      setMatrix(res.securityMatrix || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
    const interval = setInterval(fetchMatrix, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectCandidate = async (candidate: ParticipantSecurityState & { user: User | null }) => {
    setSelectedCandidate(candidate);
    setLoadingDossier(true);
    setModalError(null);
    setSuccessBanner(null);
    try {
      const data = await api.getAttemptAuditDossier('contest-grand-prix-2026', candidate.userId);
      setDossier(data);
      if (data.attempt?.codeSnapshots) {
        const problemIds = Object.keys(data.attempt.codeSnapshots);
        if (problemIds.length > 0) setSelectedProblemId(problemIds[0]);
      }
    } catch (e: any) {
      console.error('Failed to load audit dossier:', e);
    } finally {
      setLoadingDossier(false);
    }
  };

  const handleExecuteUnlock = async () => {
    if (!selectedCandidate) return;
    const trimmed = overrideReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setModalError('Override reason must be between 10 and 500 characters.');
      return;
    }

    setIsSubmittingOverride(true);
    setModalError(null);

    try {
      const res = await api.adminUnlockAttempt('contest-grand-prix-2026', selectedCandidate.userId, trimmed);
      setSuccessBanner(`Successfully unlocked test attempt for ${selectedCandidate.user?.name || selectedCandidate.userId}.`);
      setShowConfirmModal(false);
      setOverrideReason('');
      
      // Refresh dossier & matrix
      await handleSelectCandidate(selectedCandidate);
      await fetchMatrix();
    } catch (e: any) {
      setModalError(e.message || 'Failed to unlock test attempt.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const flaggedCount = matrix.filter(m => m.isFlagged || m.sessionTerminated).length;
  const lockedCount = matrix.filter(m => (m.sessionTerminated || m.attemptStatus === 'TERMINATED_SECURITY') && !m.adminOverridden).length;
  const resumedCount = matrix.filter(m => m.adminOverridden || m.attemptStatus === 'RESUMED_AFTER_OVERRIDE').length;

  // Format time remaining helper
  const getRemainingTimeFormatted = (expiresAt?: string) => {
    if (!expiresAt) return 'N/A';
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'EXPIRED (00:00:00)';
    const totalSec = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? String(hrs).padStart(2, '0') + ':' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`;
  };

  const isContestExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return Date.now() >= new Date(expiresAt).getTime();
  };

  const trimmedReasonLen = overrideReason.trim().length;
  const isReasonValid = trimmedReasonLen >= 10 && trimmedReasonLen <= 500;

  return (
    <div className="space-y-6">
      {/* Top Telemetry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Monitored</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{matrix.length} Candidates</div>
          <p className="text-[11px] text-gray-500 mt-1">Real-time focus & clipboard active</p>
        </div>

        <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Flagged Suspicious</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{flaggedCount}</div>
          <p className="text-[11px] text-amber-700 mt-1">&ge; 1 tab switches or high risk</p>
        </div>

        <div className="bg-red-50/40 p-5 rounded-2xl border border-red-200 shadow-2xs">
          <div className="flex items-center justify-between text-red-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Locked Candidates</span>
            <Lock className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-700">{lockedCount}</div>
          <p className="text-[11px] text-red-700 mt-1">3/3 switches reached • Access locked</p>
        </div>

        <div className="bg-purple-50/40 p-5 rounded-2xl border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Resumed by Admin</span>
            <Unlock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">{resumedCount}</div>
          <p className="text-[11px] text-purple-700 mt-1">Unlocked via mandatory audit override</p>
        </div>
      </div>

      {/* Security Incident Table */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-gray-900 tracking-tight">
              Anti-Cheat Incident Radar & Telemetry Feed
            </h3>
          </div>
          <button
            onClick={fetchMatrix}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Batch & College</th>
                <th className="px-4 py-3 text-center">Tab Switches</th>
                <th className="px-4 py-3 text-center">Risk Score</th>
                <th className="px-4 py-3 text-center">State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {matrix.map((row) => {
                const isLocked = (row.sessionTerminated || row.attemptStatus === 'TERMINATED_SECURITY') && !row.adminOverridden;
                const isResumed = row.adminOverridden || row.attemptStatus === 'RESUMED_AFTER_OVERRIDE';

                return (
                  <tr
                    key={row.userId}
                    className={`hover:bg-gray-50/80 transition-colors ${
                      isLocked ? 'bg-red-50/30' : isResumed ? 'bg-purple-50/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{row.user?.name || row.userId}</div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: {row.userId}</div>
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      <div>{row.user?.college || 'College N/A'}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{row.user?.batchId || 'batch-1'}</div>
                    </td>

                    <td className="px-4 py-3 text-center font-mono font-bold">
                      <span
                        className={`px-2.5 py-0.5 rounded-full ${
                          row.tabSwitchCount >= 3
                            ? 'bg-red-100 text-red-800'
                            : row.tabSwitchCount >= 1
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {row.tabSwitchCount} / {row.maxAllowedSwitches}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mx-auto overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            row.riskScore > 70
                              ? 'bg-red-600'
                              : row.riskScore > 40
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${row.riskScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                        {row.riskScore}%
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {isLocked ? (
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center space-x-1 shadow-2xs">
                          <Lock className="w-3 h-3" />
                          <span>🔒 LOCKED (3/3)</span>
                        </span>
                      ) : isResumed ? (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center space-x-1 shadow-2xs">
                          <Unlock className="w-3 h-3" />
                          <span>🟠 RESUMED BY ADMIN</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center space-x-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>🟢 ACTIVE</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        id={`inspect-candidate-${row.userId}`}
                        onClick={() => handleSelectCandidate(row)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
                          isLocked
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }`}
                      >
                        {isLocked ? 'Audit & Override' : 'View Audit'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Dossier Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-5 border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-gray-900">
                  Contest Security Audit Dossier
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  setDossier(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {successBanner && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-3.5 text-xs flex items-center justify-between">
                <span>{successBanner}</span>
                <button onClick={() => setSuccessBanner(null)} className="font-bold text-emerald-900 cursor-pointer">✕</button>
              </div>
            )}

            {loadingDossier ? (
              <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <span>Loading security telemetry and code snapshots...</span>
              </div>
            ) : dossier ? (
              <>
                {/* Candidate & Contest Info Header Card */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Student Name</span>
                    <span className="font-black text-gray-900 text-sm">{dossier.student?.name || selectedCandidate.userId}</span>
                    <span className="text-[10px] text-gray-500 font-mono block">ID: {dossier.student?.id || selectedCandidate.userId}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">College & Batch</span>
                    <span className="font-bold text-gray-800 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      {dossier.student?.college || 'HIT'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono block">{dossier.student?.batchId || 'batch-1'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Current Lock State</span>
                    {dossier.attempt?.status === 'TERMINATED_SECURITY' || dossier.securityState?.sessionTerminated ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-800">
                        <Lock className="w-3 h-3" />
                        <span>🔒 LOCKED (3/3)</span>
                      </span>
                    ) : dossier.attempt?.status === 'RESUMED_AFTER_OVERRIDE' || dossier.securityState?.adminOverridden ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800">
                        <Unlock className="w-3 h-3" />
                        <span>🟠 RESUMED BY ADMIN</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>🟢 ACTIVE</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Assigned Question Set</span>
                    <span className="font-bold text-indigo-700">{dossier.assignment?.setId || 'Set A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Contest Timer</span>
                    <span className="font-mono font-bold text-gray-900">
                      {getRemainingTimeFormatted(dossier.attempt?.expiresAt)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Tab Switch Violations</span>
                    <span className="font-mono font-bold text-red-600">
                      {dossier.securityState?.tabSwitchCount || 0} / {dossier.securityState?.maxAllowedSwitches || 3}
                    </span>
                  </div>
                </div>

                {/* Section: Why Was This Test Locked? */}
                {(dossier.attempt?.status === 'TERMINATED_SECURITY' || dossier.securityState?.sessionTerminated) && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-red-900 font-extrabold text-xs uppercase tracking-wider">
                      <AlertOctagon className="w-4 h-4 text-red-600" />
                      <span>Lock Reason & Trigger Audit</span>
                    </div>
                    <p className="text-red-800 font-semibold leading-relaxed">
                      {dossier.securityState?.terminationReason || dossier.attempt?.terminationReason || 'Maximum allowed tab switches exceeded (3/3).'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-red-700 font-mono">
                      <div>Trigger Code: <span className="font-bold">{dossier.attempt?.lockReasonCode || 'TAB_SWITCH_LIMIT_EXCEEDED'}</span></div>
                      <div>Tab Switches: <span className="font-bold">3 / 3</span></div>
                      <div>Locked At: <span className="font-bold">{dossier.attempt?.lockedAt ? new Date(dossier.attempt.lockedAt).toLocaleTimeString() : 'Recent'}</span></div>
                      <div>Locked By: <span className="font-bold">{dossier.attempt?.lockedBy || 'SYSTEM'}</span></div>
                    </div>
                  </div>
                )}

                {/* Dossier Tabs Navigation */}
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'timeline' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Security Timeline ({dossier.securityState?.violations?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('submissions')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'submissions' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Submissions ({dossier.submissions?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('code')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'code' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Saved Code Snapshots</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Override History ({dossier.overrideHistory?.length || 0})</span>
                  </button>
                </div>

                {/* Tab Views */}
                {activeTab === 'timeline' && (
                  <div className="max-h-56 overflow-y-auto space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs">
                    {(!dossier.securityState?.violations || dossier.securityState.violations.length === 0) ? (
                      <p className="text-gray-400 py-4 text-center">No security violations recorded.</p>
                    ) : (
                      dossier.securityState.violations.map((v, i) => (
                        <div key={v.id || i} className="bg-white p-2.5 rounded-xl border border-gray-200 space-y-1">
                          <div className="flex items-center justify-between font-bold text-gray-900">
                            <span className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                v.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {v.type}
                              </span>
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(v.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-600 text-[11px]">{v.details}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'submissions' && (
                  <div className="max-h-56 overflow-y-auto space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs">
                    {dossier.submissions?.length === 0 ? (
                      <p className="text-gray-400 py-4 text-center">No code submissions recorded yet.</p>
                    ) : (
                      dossier.submissions?.map((sub) => (
                        <div key={sub.id} className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-gray-900">{sub.problemId} • {sub.language}</div>
                            <div className="text-[10px] text-gray-500">Passed: {sub.passedTests}/{sub.totalTests} test cases</div>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-indigo-600 text-sm">{sub.score} pts</span>
                            <div className="text-[10px] text-gray-400 font-mono">{new Date(sub.submittedAt).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'code' && (
                  <div className="space-y-3">
                    {dossier.attempt?.codeSnapshots && Object.keys(dossier.attempt.codeSnapshots).length > 0 ? (
                      <>
                        <div className="flex gap-2">
                          {Object.keys(dossier.attempt.codeSnapshots).map((pid) => (
                            <button
                              key={pid}
                              onClick={() => setSelectedProblemId(pid)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                                selectedProblemId === pid ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {pid}
                            </button>
                          ))}
                        </div>

                        {selectedProblemId && dossier.attempt.codeSnapshots[selectedProblemId] && (
                          <div className="bg-gray-950 text-gray-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto max-h-52 border border-gray-800">
                            <div className="text-[10px] text-gray-400 border-b border-gray-800 pb-2 mb-2 flex justify-between">
                              <span>Language: {dossier.attempt.codeSnapshots[selectedProblemId].language}</span>
                              <span>Updated: {new Date(dossier.attempt.codeSnapshots[selectedProblemId].updatedAt).toLocaleTimeString()}</span>
                            </div>
                            <pre>{dossier.attempt.codeSnapshots[selectedProblemId].code || '// Empty code snapshot'}</pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400 py-6 text-center text-xs">No code snapshots found for this attempt.</p>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="max-h-56 overflow-y-auto space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs">
                    {dossier.overrideHistory?.length === 0 ? (
                      <p className="text-gray-400 py-4 text-center">No override operations performed on this attempt yet.</p>
                    ) : (
                      dossier.overrideHistory?.map((record) => (
                        <div key={record.id} className="bg-white p-3 rounded-xl border border-purple-200 space-y-1">
                          <div className="flex items-center justify-between font-bold text-purple-900">
                            <span>🔓 {record.action}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{new Date(record.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-gray-700 text-xs"><strong>Admin:</strong> {record.adminName} ({record.adminId})</p>
                          <p className="text-gray-700 text-xs"><strong>Mandatory Reason:</strong> "{record.reason}"</p>
                          <p className="text-[10px] text-gray-500 font-mono">Previous State: {record.previousState} → New State: {record.newState}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Unlock Action Footer Bar */}
                <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                  <div>
                    {isContestExpired(dossier.attempt?.expiresAt) ? (
                      <div className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Contest time has expired. This attempt cannot be resumed.</span>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Unlocking preserves student's code, questions & timer without starting a new attempt.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedCandidate(null);
                        setDossier(null);
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Close Dossier
                    </button>

                    {!isContestExpired(dossier.attempt?.expiresAt) && (
                      <button
                        id="open-unlock-dialog-btn"
                        onClick={() => {
                          setOverrideReason('');
                          setModalError(null);
                          setShowConfirmModal(true);
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Unlock & Resume Test</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Confirmation & Mandatory Reason Dialog */}
      {showConfirmModal && selectedCandidate && (
        <div className="fixed inset-0 bg-black/75 z-60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-purple-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-purple-600" />
                <h3 className="text-base font-black text-gray-900 tracking-tight">
                  Unlock & Resume Test?
                </h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 font-medium">
              This will unlock the student's existing attempt and allow them to continue from where they stopped.
            </p>

            {/* Target Candidate Summary */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 text-xs text-purple-950 space-y-1.5">
              <div className="grid grid-cols-2 gap-2 border-b border-purple-200/60 pb-2 mb-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Student</span>
                  <span className="font-extrabold text-sm text-purple-950">{dossier?.student?.name || selectedCandidate.user?.name || selectedCandidate.userId}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Contest</span>
                  <span className="font-extrabold text-xs text-purple-950">{dossier?.contest?.title || 'Round 1: Algorithmic Qualifier'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Current Lock Reason</span>
                  <span className="font-mono font-bold text-red-700 text-[11px]">{dossier?.attempt?.lockReasonCode || 'TAB_SWITCH_LIMIT_EXCEEDED'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Tab Switches</span>
                  <span className="font-mono font-bold text-red-700 text-[11px]">{dossier?.securityState?.tabSwitchCount || 3} / {dossier?.securityState?.maxAllowedSwitches || 3}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Remaining Time</span>
                  <span className="font-mono font-bold text-purple-900 text-[11px]">{getRemainingTimeFormatted(dossier?.attempt?.expiresAt)}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-[11px] font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>The timer, question set, saved code, submissions and security history will NOT be reset.</span>
            </div>

            {/* Mandatory Reason Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-gray-800 block">
                Override Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this attempt is being unlocked..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
              />

              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={trimmedReasonLen < 10 ? 'text-amber-600 font-bold' : trimmedReasonLen > 500 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                  {trimmedReasonLen < 10 ? `⚠️ Min 10 chars required (${trimmedReasonLen}/10)` : trimmedReasonLen > 500 ? `❌ Max 500 chars exceeded (${trimmedReasonLen}/500)` : `✓ Valid reason (${trimmedReasonLen}/500)`}
                </span>
                <span className="text-gray-400">{trimmedReasonLen} / 500</span>
              </div>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl p-3 leading-snug">
                {modalError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                CANCEL
              </button>
              <button
                id="confirm-unlock-resume-btn"
                disabled={!isReasonValid || isSubmittingOverride}
                onClick={handleExecuteUnlock}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingOverride ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>UNLOCKING...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>UNLOCK & RESUME</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
