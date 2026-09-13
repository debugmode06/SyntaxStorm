import React, { useState, useEffect } from 'react';
import {
  User,
  Contest,
  Batch,
  Round,
  Problem,
  QuestionAssignment,
  ParticipantSecurityState,
  SystemHealth,
  ContestAttempt
} from './types';
import { api } from './api';
import { LoginPage } from './components/LoginPage';
import { ExamHeader } from './components/ExamHeader';
import { HomePortal } from './components/HomePortal';
import { CodingWorkspace } from './components/CodingWorkspace';
import { AdminDashboard } from './components/AdminDashboard';
import { AntiCheatGuard } from './components/AntiCheatGuard';
import { AuthModal } from './components/AuthModal';
import { CreateContestModal } from './components/CreateContestModal';
import { StudentResultsModal } from './components/StudentResultsModal';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('symposium_current_user');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore parse error
      }
    }
    return null;
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [contest, setContest] = useState<Contest | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [securityState, setSecurityState] = useState<ParticipantSecurityState | null>(null);
  const [attempt, setAttempt] = useState<ContestAttempt | null>(null);
  const [assignment, setAssignment] = useState<QuestionAssignment | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  
  // Navigation & Modals
  const [activeTab, setActiveTabState] = useState<'home' | 'coder' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      if (p.includes('/admin') || h.includes('admin') || h.includes('fullscreen-test')) {
        return 'admin';
      }
      const savedTab = localStorage.getItem('symposium_active_tab') as any;
      if (savedTab && ['home', 'coder', 'admin'].includes(savedTab)) {
        return savedTab;
      }
    }
    return 'home';
  });

  const setActiveTab = (tab: 'home' | 'coder' | 'admin') => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('symposium_active_tab', tab);
    }
  };

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [createContestModalOpen, setCreateContestModalOpen] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Return to Portal & Final Submission Modals
  const [submitConfirmModalOpen, setSubmitConfirmModalOpen] = useState(false);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  const [submittingStep, setSubmittingStep] = useState('Saving current code snapshots...');

  // Initial & Continuous Data Fetch
  const refreshAllData = async (targetUser?: User | null) => {
    try {
      let activeUser = targetUser !== undefined ? targetUser : currentUser;

      // If activeUser is null, try re-verifying from stored session ID or stored user ID
      if (!activeUser && typeof window !== 'undefined') {
        const storedId = localStorage.getItem('symposium_auth_user_id');
        if (storedId) {
          try {
            const meRes = await api.getMe();
            if (meRes && meRes.user) {
              activeUser = meRes.user;
              setCurrentUser(meRes.user);
              localStorage.setItem('symposium_current_user', JSON.stringify(meRes.user));
              if (meRes.securityState) setSecurityState(meRes.securityState);
            }
          } catch (meErr) {
            console.warn('Session verification fallback on reload:', meErr);
          }
        }
      }

      const [usersRes, contestsRes, batchesRes, roundsRes, healthRes] = await Promise.all([
        api.getUsers(),
        api.getContests(),
        api.getBatches(),
        api.getRounds(),
        api.getSystemHealth().catch(() => null)
      ]);

      setAllUsers(usersRes.users || []);
      
      let fetchedContest = null;
      if (contestsRes.contests && contestsRes.contests.length > 0) {
        if (activeUser?.role === 'PARTICIPANT' && activeUser.batchId) {
           fetchedContest = contestsRes.contests.find((c: any) => c.status === 'LIVE' && c.batchId === activeUser.batchId);
        }
        if (!fetchedContest) {
           fetchedContest = contestsRes.contests.find((c: any) => c.status === 'LIVE');
        }
        if (!fetchedContest) {
           fetchedContest = contestsRes.contests[0];
        }
      }

      setContest(fetchedContest);
      setBatches(batchesRes.batches || []);
      setRounds(roundsRes.rounds || []);
      if (healthRes) setSystemHealth(healthRes);

      // If there is an active logged-in user
      if (activeUser) {
        // If participant, fetch their assigned problem set and attempt state
        if (activeUser.role === 'PARTICIPANT') {
          const activeRoundId = fetchedContest?.currentRoundId || 'round-1';
          
          // Fetch current attempt status
          try {
            const attemptRes = await api.getMyAttempt(activeRoundId, fetchedContest?.id);
            setAttempt(attemptRes.attempt);
          } catch (e) {
            setAttempt(null);
          }

          try {
            const assignRes = await api.getMyAssignment(activeRoundId);
            setAssignment(assignRes.assignment);

            const probRes = await api.getProblems(activeRoundId);
            // Order problems according to candidate's assigned set, sorted by Easy, Medium, Hard
            const probMap = new Map((probRes.problems || []).map(p => [p.id, p]));
            let orderedProbs = (assignRes.assignment.problemIds || [])
              .map(id => probMap.get(id))
              .filter((p): p is Problem => !!p);

            const diffRank: Record<string, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };
            orderedProbs.sort((a, b) => (diffRank[a.difficulty.toUpperCase()] || 2) - (diffRank[b.difficulty.toUpperCase()] || 2));

            setProblems(orderedProbs.length > 0 ? orderedProbs : (probRes.problems || []));
          } catch (e) {
            api.getProblems().then(pRes => setProblems(pRes.problems || []));
          }
        } else {
          // Admin or Judge: load all round problems
          api.getProblems().then(pRes => setProblems(pRes.problems || []));
        }
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();

    // Background polling every 8s for live timer and contest updates
    const interval = setInterval(() => {
      api.getSystemHealth().then(h => setSystemHealth(h)).catch(() => {});
      api.getContests().then(cRes => setContest(cRes.contests?.[0] || null)).catch(() => {});
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Heartbeat polling for active student single-session verification
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'PARTICIPANT') return;

    const sessionInterval = setInterval(async () => {
      const sessionId = localStorage.getItem('symposium_auth_session_id');
      if (sessionId) {
        try {
          const hb = await api.sessionHeartbeat(currentUser.id, sessionId);
          if (hb.conflict || !hb.active) {
            alert('ACCOUNT ALREADY IN USE: This student account was logged in on another device or browser. Session terminated.');
            handleLogout();
          }
        } catch (e) {
          // ignore network hiccups
        }
      }
    }, 10000);

    return () => clearInterval(sessionInterval);
  }, [currentUser?.id]);

  const handleTimeExpired = async () => {
    try {
      if (activeRound) {
        await api.submitDeadlineAttempt(activeRound.id, 'Contest deadline reached');
      }
      setActiveTab('home');
      refreshAllData(currentUser);
    } catch (e) {
      console.error('Failed to submit on timeout', e);
    }
  };

  const handleRequestExitTest = () => {
    if (
      attempt?.status === 'ACTIVE' ||
      attempt?.status === 'IN_PROGRESS' ||
      attempt?.status === 'PREPARING'
    ) {
      setSubmitConfirmModalOpen(true);
    } else {
      setActiveTab('home');
    }
  };

  const handleFinalizeAndSubmitTest = async () => {
    setSubmitConfirmModalOpen(false);
    setIsSubmittingTest(true);
    setSubmittingStep('Saving code snapshots & initializing Judge0 evaluation...');

    try {
      if (contest && attempt) {
        setSubmittingStep('Evaluating 5 test cases per question (Easy / Med / Hard)...');
        const res = await api.finalSubmit(contest.id, attempt.id, {
          isAutoSubmit: false,
          roundId: activeRound?.id
        });

        setSubmittingStep('Calculating scores and finalizing leaderboard...');
        await new Promise(r => setTimeout(r, 600));

        if (res && res.attemptStatus) {
          setAttempt(prev => prev ? { ...prev, status: res.attemptStatus as any } : null);
        }
      }

      // Exit fullscreen automatically on test submit
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (fsExitErr) {
        console.warn('Auto exit fullscreen non-fatal:', fsExitErr);
      }

      await refreshAllData(currentUser);
      setActiveTab('home');
    } catch (e: any) {
      alert(`Submission error: ${e.message || 'Failed to submit test'}`);
    } finally {
      setIsSubmittingTest(false);
    }
  };

  const handleUserSwitch = async (userId: string) => {
    setLoading(true);
    try {
      const res = await api.switchUser(userId);
      setCurrentUser(res.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('symposium_current_user', JSON.stringify(res.user));
      }
      setSecurityState(res.securityState);

      // If user switched to an admin/judge, show admin suite, else home
      if (res.user.role === 'ADMIN' || res.user.role === 'JUDGE') {
        setActiveTab('admin');
      } else {
        setActiveTab('home');
      }

      await refreshAllData(res.user);
    } catch (e: any) {
      alert(`User switch failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (user: User, initialTab?: 'home' | 'admin') => {
    setCurrentUser(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('symposium_current_user', JSON.stringify(user));
    }
    const targetTab = initialTab || (user.role === 'ADMIN' || user.role === 'JUDGE' ? 'admin' : 'home');
    setActiveTab(targetTab);
    await refreshAllData(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
    setAttempt(null);
    setSecurityState(null);
    setAssignment(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('symposium_current_user');
      localStorage.removeItem('symposium_active_tab');
      localStorage.removeItem('symposium_auth_user_id');
      localStorage.removeItem('symposium_auth_session_id');
    }
    api.logout().catch(() => {});
  };

  const activeRound = rounds.find(r => r.id === contest?.currentRoundId) || rounds[0] || null;

  if (loading && !contest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Initializing CodeArena Multi-Batch Examination Suite...
        </p>
      </div>
    );
  }

  // 1. If not authenticated, ALWAYS render the primary LoginPage first!
  if (!currentUser) {
    return (
      <LoginPage
        batches={batches}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
      {/* 2. Student Test Attending Distraction-Free Header (Only on Active Assessment View) */}
      {activeTab === 'coder' && (
        <ExamHeader
          currentUser={currentUser}
          activeRound={activeRound}
          contest={contest}
          securityState={securityState}
          attempt={attempt}
          onSubmitTest={handleRequestExitTest}
          onExitTest={handleRequestExitTest}
          onTimeExpired={handleTimeExpired}
        />
      )}

      {/* Strict Anti-Cheat Guard (Only active for contestants during the competition workspace) */}
      {currentUser?.role === 'PARTICIPANT' && activeTab === 'coder' && contest?.settings && activeRound && (
        <AntiCheatGuard
          participantId={currentUser.id}
          roundId={activeRound.id}
          settings={contest.settings}
          securityState={securityState}
          onSecurityUpdate={setSecurityState}
          onNavigateHome={() => setActiveTab('home')}
          onSwitchToAdmin={() => handleUserSwitch('usr-admin-1')}
        />
      )}

      {/* Main Viewport */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <HomePortal
            currentUser={currentUser}
            contest={contest}
            activeRound={activeRound}
            rounds={rounds}
            batches={batches}
            attempt={attempt}
            securityState={securityState}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
            onRefreshData={() => refreshAllData(currentUser)}
            onLogout={handleLogout}
            onOpenResults={() => setResultsModalOpen(true)}
          />
        )}

        {activeTab === 'coder' && (
          <CodingWorkspace
            problems={problems}
            assignment={assignment}
            roundId={activeRound?.id || 'round-1'}
            contestId={contest?.id}
            isSessionTerminated={!!securityState?.sessionTerminated}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            currentUser={currentUser}
            allUsers={allUsers}
            contest={contest}
            batches={batches}
            rounds={rounds}
            systemHealth={systemHealth}
            onRefresh={() => refreshAllData(currentUser)}
            onOpenCreateContest={() => setCreateContestModalOpen(true)}
            onUserSwitch={handleUserSwitch}
            onNavigateHome={() => setActiveTab('home')}
            onLogout={handleLogout}
            onOpenCoderArena={() => setActiveTab('coder')}
          />
        )}
      </main>

      {/* Auth Modal (Login / Student Registration) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        batches={batches}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Create Contest Modal */}
      <CreateContestModal
        isOpen={createContestModalOpen}
        onClose={() => setCreateContestModalOpen(false)}
        onContestCreated={() => refreshAllData(currentUser)}
      />

      {/* Student Results Modal from Navbar */}
      <StudentResultsModal
        isOpen={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        currentUser={currentUser}
        contest={contest}
        round={activeRound}
      />

      {/* Return to Portal Confirmation Modal */}
      {submitConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-200 max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Submit Complete Test?</h3>
              <p className="text-sm font-semibold text-gray-700">
                Are you sure you want to finalize and submit your test?
              </p>
              <p className="text-xs text-gray-600 leading-relaxed bg-amber-50/80 p-3 rounded-xl border border-amber-200/60 font-medium">
                All completed questions up to this point will be saved, evaluated against test cases, and graded to calculate your overall marks. You cannot make further edits after submission.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                id="cancel-submit-btn"
                onClick={() => setSubmitConfirmModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer"
              >
                CANCEL
              </button>
              <button
                id="confirm-submit-return-btn"
                onClick={handleFinalizeAndSubmitTest}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition shadow-md cursor-pointer"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submitting & Evaluating Progress Overlay Modal */}
      {isSubmittingTest && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-200 max-w-md w-full p-8 shadow-2xl text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">
                Submitting & Evaluating Test...
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Please do not close or reload your browser window.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{submittingStep}</span>
              </div>
              <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-2/3 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
