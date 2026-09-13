import React, { useState, useEffect } from 'react';
import { User, Contest, Batch, Round, SystemHealth } from '../types';
import { AppLayout } from './layout/AppLayout';
import { StudentManagementPanel } from './admin/StudentManagementPanel';
import { BatchesPanel } from './admin/BatchesPanel';
import { ProblemManagerPanel } from './admin/ProblemManagerPanel';
import { ContestManagementPanel } from './admin/ContestManagementPanel';
import { LeaderboardPanel } from './admin/LeaderboardPanel';
import { AntiCheatPanel } from './admin/AntiCheatPanel';
import { ActiveSessionsPanel } from './admin/ActiveSessionsPanel';
import { SettingsPanel } from './admin/SettingsPanel';
import { FullscreenTestPage } from './FullscreenTestPage';
import {
  GraduationCap,
  Code,
  Trophy,
  ShieldAlert,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Award,
  Bell,
  ChevronRight,
  User as UserIcon,
  ShieldCheck,
  Users,
  Maximize2
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser?: User | null;
  allUsers?: User[];
  contest: Contest | null;
  batches: Batch[];
  rounds: Round[];
  systemHealth: SystemHealth | null;
  onRefresh: () => void;
  onOpenCreateContest?: () => void;
  onUserSwitch?: (userId: string) => void;
  onNavigateHome?: () => void;
  onLogout?: () => void;
  onOpenCoderArena?: () => void;
}

type AdminTab = 'students' | 'batches' | 'sessions' | 'problems' | 'contest' | 'leaderboard' | 'anticheat' | 'settings' | 'fullscreen-test';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  contest,
  onRefresh,
  onLogout
}) => {
  // Sync tab with URL hash or pathname
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    const validTabs: AdminTab[] = ['students', 'sessions', 'problems', 'contest', 'leaderboard', 'anticheat', 'settings', 'fullscreen-test'];
    if (hash === 'anti-cheat') return 'anticheat';
    if (hash === 'contests') return 'contest';
    if (hash === 'fullscreen-test' || hash === 'fullscreen' || (typeof window !== 'undefined' && window.location.pathname.includes('fullscreen-test'))) return 'fullscreen-test';
    if (validTabs.includes(hash as AdminTab)) return hash as AdminTab;
    return 'students';
  });

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sync tab changes with location hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'anti-cheat') setActiveTab('anticheat');
      else if (hash === 'contests') setActiveTab('contest');
      else if (hash === 'fullscreen-test' || hash === 'fullscreen') setActiveTab('fullscreen-test');
      else if (['students', 'sessions', 'problems', 'contest', 'leaderboard', 'anticheat', 'settings', 'fullscreen-test'].includes(hash)) {
        setActiveTab(hash as AdminTab);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
    setMobileSidebarOpen(false);
  };

  const navModules = [
    {
      id: 'students' as const,
      label: 'Student Management',
      icon: GraduationCap,
      description: 'Manage student accounts, credentials, and institutional records'
    },
    {
      id: 'batches' as const,
      label: 'Batches',
      icon: Users,
      description: 'Manage student batches, groupings, and cohort assignments'
    },
    {
      id: 'sessions' as const,
      label: 'Active Sessions',
      icon: Users,
      description: 'Live participant login sessions, single-session status, and force logout controls'
    },
    {
      id: 'problems' as const,
      label: 'Problems',
      icon: Code,
      description: 'Problem bank, test cases, ZIP imports, and difficulty tags'
    },
    {
      id: 'contest' as const,
      label: 'Contest',
      icon: Award,
      description: 'Contest rounds, question set blueprints, and live execution'
    },
    {
      id: 'leaderboard' as const,
      label: 'Leaderboard',
      icon: Trophy,
      description: 'Real-time candidate rankings, scorecards, and time telemetry'
    },
    {
      id: 'anticheat' as const,
      label: 'Anti-Cheat Track',
      icon: ShieldAlert,
      description: 'Proctoring radar, tab-switch monitoring, and focus loss logs'
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: SettingsIcon,
      description: 'Security rules, anti-cheat limits, and browser lockdown policy'
    },
    {
      id: 'fullscreen-test' as const,
      label: 'Fullscreen Diagnostics',
      icon: Maximize2,
      description: 'Cross-laptop hardware & browser Fullscreen API diagnostic test'
    }
  ];

  const currentModule = navModules.find((m) => m.id === activeTab) || navModules[0];
  const adminName = currentUser?.name || 'Dr. Evelyn Vance';
  const adminRole = 'Administrator';

  return (
    <AppLayout
      user={currentUser!}
      roleLabel="ADMIN"
      sidebarItems={navModules}
      activeItemId={activeTab}
      onTabChange={(id) => handleTabChange(id as AdminTab)}
      onLogout={() => {
        if (onLogout) onLogout();
      }}
      pageTitle={currentModule.label}
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
        {activeTab === 'students' && <StudentManagementPanel />}

        {activeTab === 'batches' && <BatchesPanel />}

        {activeTab === 'sessions' && <ActiveSessionsPanel />}

        {activeTab === 'problems' && (
          <ProblemManagerPanel
            onRefreshStats={onRefresh}
          />
        )}

        {activeTab === 'contest' && (
          <ContestManagementPanel contest={contest} onRefresh={onRefresh} />
        )}

        {activeTab === 'leaderboard' && <LeaderboardPanel />}

        {activeTab === 'anticheat' && <AntiCheatPanel />}

        {activeTab === 'settings' && <SettingsPanel />}

        {activeTab === 'fullscreen-test' && <FullscreenTestPage />}
      </div>
    </AppLayout>
  );
};
