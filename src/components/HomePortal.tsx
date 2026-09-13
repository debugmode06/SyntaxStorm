import React, { useState } from 'react';
import {
  User,
  Contest,
  Round,
  Batch,
  ContestAttempt,
  ParticipantSecurityState
} from '../types';
import { api } from '../api';
import { ContestDetailsModal } from './ContestDetailsModal';
import { ContestTermsModal } from './ContestTermsModal';
import { PreparationCountdownModal } from './PreparationCountdownModal';
import { PreContestRulesModal } from './PreContestRulesModal';
import { StudentResultsModal } from './StudentResultsModal';
import {
  Trophy,
  Clock,
  Code2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  Award,
  BookOpen,
  ChevronRight,
  Timer,
  Lock,
  BarChart3,
  Flame,
  CheckCircle,
  Home,
  User as UserIcon
} from 'lucide-react';
import { AppLayout } from './layout/AppLayout';

interface HomePortalProps {
  currentUser: User | null;
  contest: Contest | null;
  activeRound: Round | null;
  rounds: Round[];
  batches: Batch[];
  attempt: ContestAttempt | null;
  securityState: ParticipantSecurityState | null;
  onNavigate: (tab: 'home' | 'coder' | 'admin') => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onRefreshData: () => Promise<void>;
  onLogout?: () => void;
  onOpenResults?: () => void;
}

export const HomePortal: React.FC<HomePortalProps> = ({
  currentUser,
  contest,
  activeRound,
  rounds,
  batches,
  attempt,
  securityState,
  onNavigate,
  onOpenAuth,
  onRefreshData,
  onLogout,
  onOpenResults
}) => {
  // Modal State Controls
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [preContestRulesModalOpen, setPreContestRulesModalOpen] = useState(false);
  const [preparationModalOpen, setPreparationModalOpen] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'UPCOMING'>('ALL');
  const [localAttempt, setLocalAttempt] = useState<ContestAttempt | null>(attempt);
  const [studentContests, setStudentContests] = useState<(Contest & { computedStatus: 'UPCOMING' | 'LIVE' | 'ENDED'; assignedSet?: any })[]>([]);
  const [loadingContests, setLoadingContests] = useState(true);

  
  React.useEffect(() => {
    const fetchContests = async () => {
      try {
        const res = await api.getStudentContests();
        setStudentContests(res.contests || []);
      } catch (e) {
        console.error('Failed to load student contests', e);
      } finally {
        setLoadingContests(false);
      }
    };
    if (currentUser) {
      fetchContests();
    } else {
      setLoadingContests(false);
    }
  }, [currentUser]);

  React.useEffect(() => {
    if (attempt) {
      setLocalAttempt(attempt);
    }
  }, [attempt]);

  const rawAttempt = localAttempt || attempt;
  // Ensure attempt strictly matches the active contest ID
  const effectiveAttempt = (rawAttempt && contest && (rawAttempt.contestId === contest.id || rawAttempt.contestId === (activeRound as any)?.contestId)) ? rawAttempt : null;

  // Find candidate's batch
  const studentBatch = batches.find(b => b.id === currentUser?.batchId) || batches[0] || null;

  // Derive Attempt State
  const isCompleted = effectiveAttempt?.status === 'COMPLETED' || effectiveAttempt?.status === 'SUBMITTED' || effectiveAttempt?.status === 'AUTO_SUBMITTED' || effectiveAttempt?.status === 'SUBMITTING' || effectiveAttempt?.status === 'AUTO_SUBMITTING' || effectiveAttempt?.status === 'DISQUALIFIED';
  const isTerminated = effectiveAttempt?.status === 'TERMINATED_SECURITY' || !!securityState?.sessionTerminated;
  const isPreparing = effectiveAttempt?.status === 'PREPARING';
  const isActive = effectiveAttempt?.status === 'ACTIVE' || effectiveAttempt?.status === 'IN_PROGRESS';

  // Handle flow initiation
  const handleOpenContestFlow = (targetContest?: Contest) => {
    const currentTarget = targetContest || contest;
    const cAttempt = localAttempt?.contestId === currentTarget?.id ? localAttempt : (attempt?.contestId === currentTarget?.id ? attempt : null);
    const cIsCompleted = cAttempt?.status === 'COMPLETED' || cAttempt?.status === 'SUBMITTED' || cAttempt?.status === 'AUTO_SUBMITTED' || cAttempt?.status === 'DISQUALIFIED';
    const cIsTerminated = cAttempt?.status === 'TERMINATED_SECURITY';
    const cIsPreparing = cAttempt?.status === 'PREPARING';
    const cIsActive = cAttempt?.status === 'ACTIVE' || cAttempt?.status === 'IN_PROGRESS';

    if (cIsTerminated || cIsCompleted) {
      setResultsModalOpen(true);
      return;
    }

    if (cIsActive) {
      onNavigate('coder');
      return;
    }

    if (cIsPreparing) {
      setPreparationModalOpen(true);
      return;
    }

    // Otherwise, open contest details view
    setDetailsModalOpen(true);
  };

  // Step 1 -> Step 2
  const handleStartFromDetails = () => {
    setDetailsModalOpen(false);
    setTermsModalOpen(true);
  };

  // Step 2 -> 30s Preparation Countdown Screen (bypassing extra system check popups)
  const handleAcceptTermsAndStart = async () => {
    setTermsModalOpen(false);
    try {
      const targetRoundId = activeRound?.id || contest?.currentRoundId || 'round-1';
      const contestId = contest?.id;
      const res = await api.startAttempt(targetRoundId, true, contestId);
      if (res && res.attempt) {
        const isTerminal = ['COMPLETED', 'SUBMITTED', 'AUTO_SUBMITTED', 'EXPIRED', 'DISQUALIFIED', 'TERMINATED_ADMIN', 'TERMINATED_SECURITY'].includes(res.attempt.status);
        if (isTerminal) {
          alert('You have already attended this contest. Re-attending is not permitted.');
          setResultsModalOpen(true);
          return;
        }
        setLocalAttempt(res.attempt);
        setPreparationModalOpen(true);
      } else {
        setPreparationModalOpen(true);
      }
    } catch (err: any) {
      console.warn('Start attempt preparation non-fatal:', err);
      if (err.message && err.message.includes('already attended')) {
        alert('You have already attended this contest. Re-attending is not permitted.');
        setResultsModalOpen(true);
        return;
      }
      setPreparationModalOpen(true);
    }
  };

  // Fallback for pre-contest rules modal
  const handleEnterFullscreenAndStart = async () => {
    await handleCountdownFinished();
  };

  // Step 3: Countdown Finished or Skip -> Auto Enter Fullscreen & Coding Arena
  const handleCountdownFinished = async () => {
    try {
      const contestId = contest?.id;
      await api.transitionAttemptToActive(contestId);
    } catch (e) {
      console.warn('Attempt transition fallback triggered');
    }
    if (localAttempt) {
      setLocalAttempt({ ...localAttempt, status: 'ACTIVE' });
    }
    setPreparationModalOpen(false);

    // Enter fullscreen automatically as requested
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      }
    } catch (fsErr) {
      console.warn('Fullscreen request auto-exit non-fatal:', fsErr);
    }

    onNavigate('coder');
    onRefreshData().catch(() => {});
  };

  const getAttemptBadge = () => {
    if (isTerminated) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>LOCKED OUT (SECURITY)</span>
        </span>
      );
    }
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>ATTEMPT COMPLETED</span>
        </span>
      );
    }
    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span>CONTEST IN PROGRESS</span>
        </span>
      );
    }
    if (isPreparing) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>PREPARATION STAGE (60s)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
        <span>AVAILABLE TO START</span>
      </span>
    );
  };

  const getActionButtonText = () => {
    if (isTerminated) return 'View Lockout Record';
    if (isCompleted) return 'View My Results';
    if (isActive) return 'Resume Contest Arena';
    if (isPreparing) return 'Resume Preparation (60s)';
    return 'View Contest';
  };

  const studentNavModules = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'contests', label: 'My Contests', icon: Trophy },
    { id: 'practice', label: 'Problems / Practice', icon: Code2 },
    { id: 'results', label: 'Results', icon: Award },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  const handleTabChange = (id: string) => {
    if (id === 'results' && onOpenResults) {
      onOpenResults();
    }
  };

  return (
    <AppLayout
      user={currentUser!}
      roleLabel="STUDENT"
      sidebarItems={studentNavModules}
      activeItemId="home"
      onTabChange={handleTabChange}
      onLogout={() => { if (onLogout) onLogout(); }}
      pageTitle="Home"
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        
        {/* 1. STUDENT HERO (LIGHT THEME) */}
        <section className="bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 lg:p-10 shadow-xs relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left: Greeting & Description */}
          <div className="lg:col-span-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Official Candidate Portal</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">
              WELCOME, {currentUser?.name?.toUpperCase() || 'STUDENT'}
            </h1>

            <p className="text-sm text-gray-600 leading-relaxed max-w-2xl font-normal">
              Ready for your next challenge? Your assigned coding symposium rounds, live sandboxed environments, and official leaderboard results are ready.
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                id="hero-view-contests-btn"
                onClick={() => handleOpenContestFlow()}
                disabled={studentContests.length === 0}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 ${studentContests.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}
              >
                <Trophy className="w-4 h-4" />
                <span>{getActionButtonText()}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="hero-results-btn"
                onClick={() => setResultsModalOpen(true)}
                className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4 text-emerald-600" />
                <span>My Assessment Results</span>
              </button>
            </div>
          </div>

          {/* Right: Next Contest Quick Card */}
          <div className="lg:col-span-4 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-100/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200/60 shadow-2xs">
                NEXT CONTEST
              </span>
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-blue-600" />
                <span>{studentContests.length > 0 && activeRound ? activeRound.durationMinutes : 0} Minutes</span>
              </span>
            </div>

            <div>
              <h3 className="font-extrabold text-sm text-gray-900 leading-tight">
                {studentContests.length > 0 ? studentContests[0].title : 'No Contests Available'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {studentContests.length > 0 && activeRound ? activeRound.name : 'Waiting for round publication'}
              </p>
            </div>

            <div className="pt-2 border-t border-blue-200/50 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">Batch: <strong className="text-gray-900">{studentBatch?.name || 'Unassigned'}</strong></span>
              <button
                onClick={() => handleOpenContestFlow()}
                disabled={studentContests.length === 0}
                className={`font-bold flex items-center gap-1 ${studentContests.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700 cursor-pointer'}`}
              >
                <span>View Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 2. QUICK STATS ROW */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">MY CONTESTS</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{studentContests.length}</p>
          <span className="text-[11px] text-gray-400 font-medium mt-0.5 block">{studentContests.length === 1 ? 'Available Contest' : 'Available Contests'}</span>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ATTEMPT STATUS</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">
            {studentContests.length === 0 ? 'N/A' : (isCompleted ? 'Finished' : isTerminated ? 'Locked' : isActive ? 'Active' : 'Ready')}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
            {studentContests.length === 0 ? 'No active contest' : (isCompleted ? 'Submissions Evaluated' : '1 Attempt Allowed')}
          </span>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">CUTOFF TARGET</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{activeRound?.cutoffRank ? 'Top ' + activeRound.cutoffRank : 'N/A'}</p>
          <span className="text-[11px] text-gray-400 font-medium mt-0.5 block">{activeRound?.cutoffRank ? 'Advances to Next Round' : 'No target set'}</span>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">INTEGRITY SUITE</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{studentContests.length > 0 ? 'Active Guard' : 'N/A'}</p>
          <span className="text-[11px] text-indigo-600 font-medium mt-0.5 block">{studentContests.length > 0 ? 'Max ' + (effectiveAttempt?.maxTabSwitches || 3) + ' Tab Switches' : 'No active guard'}</span>
        </div>
      </section>

      
      {/* 3. MY CONTESTS SECTION */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-600" />
              <span>MY CONTESTS</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Your registered collegiate coding symposium challenges and active rounds.
            </p>
          </div>
        </div>
        {studentContests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200/80 p-12 text-center shadow-xs flex flex-col items-center justify-center">
            <Trophy className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-xl font-black text-gray-900 mb-2">No contests available</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Your assigned contests will appear here when they are published.
            </p>
          </div>
        ) : (
          studentContests.map(c => {
            const r = rounds.find(rd => rd.id === c.currentRoundId) || activeRound;
            const cAttempt = (c as any).myAttempt || (localAttempt?.contestId === c.id ? localAttempt : (attempt?.contestId === c.id ? attempt : null));
            const cIsCompleted = cAttempt?.status === 'COMPLETED' || cAttempt?.status === 'SUBMITTED' || cAttempt?.status === 'AUTO_SUBMITTED' || cAttempt?.status === 'DISQUALIFIED';
            const cIsTerminated = cAttempt?.status === 'TERMINATED_SECURITY';
            const cIsPreparing = cAttempt?.status === 'PREPARING';
            const cIsActive = cAttempt?.status === 'ACTIVE' || cAttempt?.status === 'IN_PROGRESS';

            const renderCardAttemptBadge = () => {
              if (cIsTerminated) {
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span>LOCKED OUT (SECURITY)</span>
                  </span>
                );
              }
              if (cIsCompleted) {
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ATTEMPT COMPLETED</span>
                  </span>
                );
              }
              if (cIsActive) {
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>CONTEST IN PROGRESS</span>
                  </span>
                );
              }
              if (cIsPreparing) {
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>PREPARATION STAGE (30s)</span>
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AVAILABLE TO START</span>
                </span>
              );
            };

            const getCardButtonLabel = () => {
              if (c.computedStatus === 'UPCOMING') return 'Upcoming';
              if (cIsTerminated) return 'View Lockout Record';
              if (cIsCompleted) return 'View My Results';
              if (cIsActive) return 'Resume Contest Arena';
              if (cIsPreparing) return 'Resume Preparation (30s)';
              if (c.computedStatus === 'ENDED') return 'Start Contest';
              return 'Start Contest';
            };

            return (
              <div key={c.id} className="bg-white rounded-3xl border border-gray-200/80 hover:border-gray-300 transition-all p-6 sm:p-7 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                        {c.computedStatus}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                      {c.title}
                    </h3>
                  </div>
                  <div className="self-start sm:self-auto">
                    {renderCardAttemptBadge()}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Round</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate">
                      {r?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Assigned Batch</span>
                    <span className="font-bold text-xs sm:text-sm text-indigo-700 block truncate">
                      {studentBatch?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Duration</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block">
                      {r?.durationMinutes || 0} Minutes
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Anti-Cheat Protected • 60s Preparation Required</span>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {cIsCompleted || cIsTerminated ? (
                      <button
                        id="view-results-btn"
                        onClick={() => {
                          setResultsModalOpen(true);
                        }}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        View Result Breakdown
                      </button>
                    ) : null}
                    <button
                      id="main-contest-action-btn"
                      onClick={() => handleOpenContestFlow(c)}
                      disabled={c.computedStatus === 'UPCOMING'}
                      className={`px-6 py-3 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 ${
                        c.computedStatus === 'UPCOMING'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : cIsTerminated
                          ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                          : cIsCompleted
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          : cIsActive
                          ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse cursor-pointer'
                          : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      }`}
                    >
                      <span>{getCardButtonLabel()}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      
      {/* 4. UPCOMING ROUNDS SECTION */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>UPCOMING ROUNDS & FINALS</span>
          </h2>
        </div>
        <div className="bg-white rounded-3xl border border-gray-200/80 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <Layers className="w-10 h-10 text-gray-300 mb-3" />
          <h3 className="text-lg font-black text-gray-900 mb-1">No upcoming contests</h3>
        </div>
      </section>

      {/* 5. STUDENT GUIDANCE / HELPFUL NOTES */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 space-y-2 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h4 className="font-bold text-sm text-gray-900">Step 1: View Contest & Agree to Rules</h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Click <strong>View Contest</strong> to inspect the round structure, scoring details, and read the 10 integrity rules before confirming.
          </p>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 space-y-2 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h4 className="font-bold text-sm text-gray-900">Step 2: 60-Second Preparation Phase</h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            A 60-second preparation countdown initializes your private question set and sandboxed environment before entering the arena.
          </p>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 space-y-2 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h4 className="font-bold text-sm text-gray-900">Step 3: Solve & Anti-Cheat Protection</h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Stay on your workspace window! 3 tab switches will auto-submit all code snapshots and lock the session. Autosave runs continuously.
          </p>
        </div>
      </section>

      {/* Modals */}
      <ContestDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        contest={contest}
        round={activeRound}
        batch={studentBatch}
        attempt={effectiveAttempt}
        onStartContest={handleStartFromDetails}
      />

      <ContestTermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAcceptAndContinue={handleAcceptTermsAndStart}
        contestTitle={contest?.title}
        roundName={activeRound?.name}
      />

      <PreContestRulesModal
        isOpen={preContestRulesModalOpen}
        onClose={() => setPreContestRulesModalOpen(false)}
        contest={contest}
        round={activeRound}
        currentUser={currentUser}
        onEnterFullscreenAndStart={handleEnterFullscreenAndStart}
      />

      {preparationModalOpen && effectiveAttempt && (
        <PreparationCountdownModal
          attempt={effectiveAttempt}
          contest={contest}
          round={activeRound}
          currentUser={currentUser}
          onCountdownComplete={handleCountdownFinished}
        />
      )}

      <StudentResultsModal
        isOpen={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        currentUser={currentUser}
        contest={contest}
        round={activeRound}
      />

      {/* Footer */}
      <footer className="pt-6 pb-2 border-t border-gray-200/80 text-center text-xs text-gray-400">
        <p>CodeArena • Official Coding Contest Portal © 2026</p>
      </footer>
      </div>
    </AppLayout>
  );
};
