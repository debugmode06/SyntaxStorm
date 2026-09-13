import React, { useState, useEffect } from 'react';
import { StudentRegistration, Batch, User } from '../../types';
import { api } from '../../api';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ShieldCheck,
  KeyRound,
  GraduationCap,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Loader2,
  Layers
} from 'lucide-react';

interface RegistrationsPanelProps {
  batches: Batch[];
  onDataChanged: () => void;
}

export const RegistrationsPanel: React.FC<RegistrationsPanelProps> = ({
  batches,
  onDataChanged
}) => {
  const [registrations, setRegistrations] = useState<StudentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Approval Modal State
  const [selectedReg, setSelectedReg] = useState<StudentRegistration | null>(null);
  const [assignedBatchId, setAssignedBatchId] = useState('batch-1');
  const [assignedUsername, setAssignedUsername] = useState('');
  const [assignedPassword, setAssignedPassword] = useState('');
  const [assignedRollCode, setAssignedRollCode] = useState('');
  const [approving, setApproving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Reject Modal State
  const [rejectingReg, setRejectingReg] = useState<StudentRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not meet current symposium eligibility criteria.');
  const [rejecting, setRejecting] = useState(false);

  // Copied State Tracker
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const res = await api.getRegistrations();
      setRegistrations(res.registrations);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const openApproveModal = (reg: StudentRegistration) => {
    setSelectedReg(reg);
    setAssignedBatchId(reg.preferredBatchId || 'batch-1');
    setAssignedUsername(reg.email);
    // Generate secure randomized memorable password (e.g. Apex@9821)
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setAssignedPassword(`Symposium@${randomDigits}`);
    setAssignedRollCode(`CS26-B1-${String(Math.floor(100 + Math.random() * 900))}`);
    setModalError(null);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReg) return;
    if (!assignedUsername.trim() || !assignedPassword.trim()) {
      setModalError('Please specify assigned username and login password.');
      return;
    }

    setApproving(true);
    setModalError(null);
    try {
      await api.approveRegistration(selectedReg.id, {
        assignedBatchId,
        assignedUsername: assignedUsername.trim(),
        assignedPassword: assignedPassword.trim(),
        assignedRollCode: assignedRollCode.trim()
      });
      setSelectedReg(null);
      await fetchRegistrations();
      onDataChanged();
    } catch (err: any) {
      setModalError(err.message || 'Failed to approve student');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReg) return;

    setRejecting(true);
    try {
      await api.rejectRegistration(rejectingReg.id, rejectReason);
      setRejectingReg(null);
      await fetchRegistrations();
      onDataChanged();
    } catch (err) {
      console.error('Failed to reject registration:', err);
    } finally {
      setRejecting(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered List
  const filtered = registrations.filter(r => {
    const matchesFilter = filter === 'ALL' || r.status === filter;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.college.toLowerCase().includes(q) ||
      r.studentId.toLowerCase().includes(q) ||
      (r.assignedRollCode && r.assignedRollCode.toLowerCase().includes(q));
    return matchesFilter && matchesQuery;
  });

  const pendingCount = registrations.filter(r => r.status === 'PENDING_APPROVAL').length;
  const approvedCount = registrations.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = registrations.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center space-x-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            <span>Student Registration & Credential Issuance</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Review student registrations, assign competition batch slots, and issue login credentials.
          </p>
        </div>

        <button
          onClick={fetchRegistrations}
          className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all self-start sm:self-auto cursor-pointer"
        >
          Refresh Registrations
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Total Applicants</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{registrations.length}</p>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-2">{pendingCount}</p>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase">Approved & Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2">{approvedCount}</p>
        </div>

        <div className="bg-red-50/50 p-4 rounded-2xl border border-red-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-800 uppercase">Rejected</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-black text-red-900 mt-2">{rejectedCount}</p>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by student name, college, email, or roll code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'ALL' && `All (${registrations.length})`}
              {tab === 'PENDING_APPROVAL' && `Pending (${pendingCount})`}
              {tab === 'APPROVED' && `Approved (${approvedCount})`}
              {tab === 'REJECTED' && `Rejected (${rejectedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Registrations Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-medium">Loading applicant roster...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-gray-300" />
            <p className="text-xs font-medium">No registrations match the selected filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student / Candidate</th>
                  <th className="px-4 py-3">Institution & Dept</th>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Issued Credentials</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(reg => (
                  <tr key={reg.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Student Info */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-gray-900">{reg.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{reg.email}</div>
                      {reg.phone && <div className="text-[10px] text-gray-400">{reg.phone}</div>}
                    </td>

                    {/* Institution */}
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-800">{reg.college}</div>
                      <div className="text-[11px] text-gray-500">{reg.department} • {reg.yearOfStudy}</div>
                    </td>

                    {/* Student ID */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                        {reg.studentId}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {reg.status === 'PENDING_APPROVAL' && (
                        <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                          <Clock className="w-3 h-3" />
                          <span>Pending Approval</span>
                        </span>
                      )}
                      {reg.status === 'APPROVED' && (
                        <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approved & Active</span>
                        </span>
                      )}
                      {reg.status === 'REJECTED' && (
                        <span className="inline-flex items-center space-x-1 bg-red-100 text-red-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                          <XCircle className="w-3 h-3" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </td>

                    {/* Issued Credentials Info */}
                    <td className="px-4 py-3.5">
                      {reg.status === 'APPROVED' && reg.assignedUsername ? (
                        <div className="space-y-1 bg-gray-50 p-2 rounded-xl border border-gray-200">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Username:</span>
                            <span className="font-mono font-bold text-gray-900">{reg.assignedUsername}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Password:</span>
                            <div className="flex items-center space-x-1">
                              <span className="font-mono font-bold text-indigo-700">
                                {showPasswords[reg.id] ? reg.assignedPassword : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(reg.id)}
                                className="text-gray-400 hover:text-gray-600 p-0.5"
                              >
                                {showPasswords[reg.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-200">
                            <span>Batch: {reg.assignedBatchId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(`Username: ${reg.assignedUsername}\nPassword: ${reg.assignedPassword}`, reg.id)}
                              className="text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-0.5"
                            >
                              {copiedId === reg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === reg.id ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">No credentials issued</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      {reg.status === 'PENDING_APPROVAL' && (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openApproveModal(reg)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1 shadow-xs cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Review & Approve</span>
                          </button>
                          <button
                            onClick={() => setRejectingReg(reg)}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {reg.status === 'APPROVED' && (
                        <button
                          onClick={() => openApproveModal(reg)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Edit Credentials
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. APPROVAL MODAL */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    Approve Student & Issue Credentials
                  </h3>
                  <p className="text-xs text-emerald-100">
                    {selectedReg.name} • {selectedReg.college}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleApproveSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center space-x-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Student Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Applicant:</span>
                  <span className="font-bold text-gray-900">{selectedReg.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Institution:</span>
                  <span className="font-medium text-gray-800">{selectedReg.college}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Department:</span>
                  <span className="font-medium text-gray-800">{selectedReg.department} ({selectedReg.yearOfStudy})</span>
                </div>
              </div>

              {/* Batch Assignment */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Assign Competition Batch / Slot <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignedBatchId}
                  onChange={e => setAssignedBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.slotDurationMinutes} mins)
                    </option>
                  ))}
                  {batches.length === 0 && (
                    <option value="batch-1">Batch A</option>
                  )}
                </select>
              </div>

              {/* Assigned Username */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Assigned Username / Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={assignedUsername}
                  onChange={e => setAssignedUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Assigned Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Generated Login Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAssignedPassword(`Symposium@${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={assignedPassword}
                  onChange={e => setAssignedPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  The student will log in using this password.
                </p>
              </div>

              {/* Roll Code */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Official Roll Code / Contestant ID
                </label>
                <input
                  type="text"
                  value={assignedRollCode}
                  onChange={e => setAssignedRollCode(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedReg(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 shadow-xs"
                >
                  {approving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{approving ? 'Approving...' : 'Approve & Activate Credentials'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. REJECT MODAL */}
      {rejectingReg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-gray-900">
                Reject Student Registration
              </h3>
            </div>

            <p className="text-xs text-gray-600">
              Are you sure you want to reject registration for <strong className="text-gray-900">{rejectingReg.name}</strong> ({rejectingReg.email})?
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingReg(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={rejecting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
