import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Search,
  UserCheck,
  Clock,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  X,
  Users
} from 'lucide-react';

interface SessionItem {
  sessionId: string;
  studentId: string;
  studentName: string;
  email: string;
  registrationNo: string;
  batchName: string;
  loginAt: string;
  lastSeenAt: string;
  ageSeconds: number;
  active: boolean;
  status: 'ACTIVE' | 'STALE' | 'TERMINATED';
  userAgent: string;
  contestStatus: string;
  logoutReason?: string | null;
}

export const ActiveSessionsPanel: React.FC = () => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [forceLogoutModalOpen, setForceLogoutModalOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminSessions();
      if (res.success && Array.isArray(res.sessions)) {
        setSessions(res.sessions);
      }
    } catch (err: any) {
      console.error('Failed to load active sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // Auto refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleOpenForceLogout = (session: SessionItem) => {
    setSelectedSession(session);
    setForceLogoutModalOpen(true);
  };

  const handleConfirmForceLogout = async () => {
    if (!selectedSession) return;
    setActionInProgress(true);
    try {
      const res = await api.adminForceLogoutSession(selectedSession.studentId, selectedSession.sessionId);
      setToastMessage(res.message || 'Student session force logged out successfully.');
      setForceLogoutModalOpen(false);
      setSelectedSession(null);
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Failed to force logout session');
    } finally {
      setActionInProgress(false);
    }
  };

  const filteredSessions = sessions.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.registrationNo.toLowerCase().includes(q) ||
      s.batchName.toLowerCase().includes(q)
    );
  });

  const activeCount = sessions.filter(s => s.status === 'ACTIVE').length;
  const staleCount = sessions.filter(s => s.status === 'STALE').length;

  return (
    <div className="space-y-6">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-800 text-sm animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Active Student Login Sessions</h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeCount} Active
            </span>
            {staleCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {staleCount} Stale
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Monitor real-time participant login connections, enforce single active session policies, and force logout stuck accounts.
          </p>
        </div>

        <button
          onClick={fetchSessions}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Sessions</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search student name, registration number, email or batch..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Participant / College</th>
                <th className="py-3.5 px-4">Batch</th>
                <th className="py-3.5 px-4">Login Time</th>
                <th className="py-3.5 px-4">Last Heartbeat</th>
                <th className="py-3.5 px-4">Session Status</th>
                <th className="py-3.5 px-4">Contest Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                    {loading ? 'Loading active student sessions...' : 'No active student sessions found.'}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => (
                  <tr key={`${s.studentId}_${s.sessionId}`} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {s.studentName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            <span>{s.studentName}</span>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 font-mono">
                            <span>{s.registrationNo}</span>
                            <span>•</span>
                            <span>{s.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                        {s.batchName}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-xs text-gray-600 font-mono">
                      {s.loginAt ? new Date(s.loginAt).toLocaleTimeString() : 'N/A'}
                    </td>

                    <td className="py-4 px-4">
                      <div className="text-xs font-mono text-gray-700">
                        {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleTimeString() : 'N/A'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {s.ageSeconds < 5 ? 'Just now' : `${s.ageSeconds}s ago`}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {s.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          ACTIVE
                        </span>
                      ) : s.status === 'STALE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          STALE ({s.ageSeconds}s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                          TERMINATED
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        s.contestStatus === 'IN_PROGRESS' || s.contestStatus === 'ACTIVE'
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                          : s.contestStatus === 'SUBMITTED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-50 text-gray-600'
                      }`}>
                        {s.contestStatus || 'NOT_STARTED'}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-right">
                      {s.active && (
                        <button
                          onClick={() => handleOpenForceLogout(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                        >
                          <ShieldX className="w-3.5 h-3.5" />
                          <span>Force Logout</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Force Logout Confirmation Modal */}
      {forceLogoutModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Force Logout Student?</h3>
                <p className="text-xs text-gray-500">Admin Session Enforcement</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 text-sm text-gray-700 space-y-1">
              <div className="font-bold text-gray-900">{selectedSession.studentName}</div>
              <div className="text-xs text-gray-500 font-mono">ID: {selectedSession.registrationNo} • {selectedSession.email}</div>
              <div className="text-xs text-gray-500">Batch: {selectedSession.batchName}</div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to force logout this student's active session? They will be immediately disconnected and required to authenticate again.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setForceLogoutModalOpen(false)}
                disabled={actionInProgress}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmForceLogout}
                disabled={actionInProgress}
                className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {actionInProgress ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span>FORCE LOGOUT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
