import React, { useState } from 'react';
import { User, StudentRegistration, Batch } from '../types';
import { api } from '../api';
import {
  KeyRound,
  UserPlus,
  LogIn,
  Shield,
  GraduationCap,
  Mail,
  Lock,
  Building,
  Hash,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Info,
  ArrowRight
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  batches: Batch[];
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  batches,
  onClose,
  onLoginSuccess
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loginRole, setLoginRole] = useState<'PARTICIPANT' | 'ADMIN'>('PARTICIPANT');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCollege, setRegCollege] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regDepartment, setRegDepartment] = useState('Computer Science & Engineering');
  const [regYear, setRegYear] = useState('3rd Year');
  const [regPhone, setRegPhone] = useState('');
  const [regPreferredBatch, setRegPreferredBatch] = useState('batch-1');
  const [regGithub, setRegGithub] = useState('');

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReg, setSubmittedReg] = useState<StudentRegistration | null>(null);

  if (!isOpen) return null;

  // Fill Hardcoded Admin Credentials
  const handleQuickFillAdmin = () => {
    setLoginRole('ADMIN');
    setLoginEmail('admin');
    setLoginPassword('password');
    setError(null);
  };

  // Fill Demo Approved Student
  const handleQuickFillDemoStudent = () => {
    setLoginRole('PARTICIPANT');
    setLoginEmail('student');
    setLoginPassword('password');
    setError(null);
  };

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setError('Please enter your email/username and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.login(loginEmail, loginPassword);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Student Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regCollege.trim() || !regStudentId.trim()) {
      setError('Please fill in all required fields (Name, Email, College, Student ID).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.registerStudent({
        name: regName,
        email: regEmail,
        college: regCollege,
        studentId: regStudentId,
        department: regDepartment,
        yearOfStudy: regYear,
        phone: regPhone,
        preferredBatchId: regPreferredBatch,
        githubOrProfileUrl: regGithub
      });
      setSubmittedReg(res.registration);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Bar */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 text-white relative">
          <button
            id="close-auth-modal-btn"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
              {mode === 'login' ? <KeyRound className="w-6 h-6 text-yellow-300" /> : <GraduationCap className="w-6 h-6 text-emerald-300" />}
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                {mode === 'login' ? 'Sign In to CodeArena' : 'Student Registration'}
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                {mode === 'login'
                  ? 'Access your contestant coding arena or administrative jury console'
                  : 'Register your candidacy for Apex Code Grand Prix 2026'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mt-5 grid grid-cols-2 bg-black/20 p-1 rounded-xl backdrop-blur-xs">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSubmittedReg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                mode === 'login' ? 'bg-white text-gray-900 shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login Portal</span>
            </button>
            <button
              id="auth-tab-register"
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSubmittedReg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                mode === 'register' ? 'bg-white text-gray-900 shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register as Student</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold">Authentication Notice</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              
              {/* Hardcoded Credentials Fast-Fill Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-blue-900 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quick Demo Credentials</span>
                  </div>
                  <span className="text-[10px] bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                    One-Click Fill
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleQuickFillAdmin}
                    className="p-2.5 bg-white hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-blue-900 block">👑 Admin (Manage All)</span>
                    <span className="text-[11px] text-gray-600 font-mono">admin / password</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickFillDemoStudent}
                    className="p-2.5 bg-white hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-indigo-900 block">🎓 Student (Contest Only)</span>
                    <span className="text-[11px] text-gray-600 font-mono">student / password</span>
                  </button>
                </div>
              </div>

              {/* Login Role Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Signing in as
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLoginRole('PARTICIPANT')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      loginRole === 'PARTICIPANT' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Student Contestant
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginRole('ADMIN')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      loginRole === 'ADMIN' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Admin / Jury
                  </button>
                </div>
              </div>

              {/* Email / Username Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Email Address or Student ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    id="login-email-input"
                    type="text"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder={loginRole === 'ADMIN' ? 'admin@symposium.edu' : 'student.name@univ.edu or Roll Code'}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    id="login-password-input"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder={loginRole === 'ADMIN' ? 'admin123' : 'Your assigned password (e.g. Oxford@2026 or pass123)'}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {loginRole === 'ADMIN'
                    ? 'Default Admin Password: admin123'
                    : 'Use the credentials issued by the Admin upon registration approval.'}
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center space-x-1"
                >
                  <span>New contestant? Register for the symposium</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </form>
          )}

          {/* 2. STUDENT REGISTRATION FORM */}
          {mode === 'register' && !submittedReg && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Admin Approval Required</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    After you register, the Organising Committee will review your details, assign your batch & access code, and issue your secure login credentials.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-name-input"
                  type="text"
                  required
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-email-input"
                    type="email"
                    required
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="alex.morgan@univ.edu"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    id="reg-phone-input"
                    type="tel"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                    placeholder="+1 555 019 2834"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    College / University <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-college-input"
                    type="text"
                    required
                    value={regCollege}
                    onChange={e => setRegCollege(e.target.value)}
                    placeholder="e.g. Stanford University"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Student ID / Roll No <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-studentid-input"
                    type="text"
                    required
                    value={regStudentId}
                    onChange={e => setRegStudentId(e.target.value)}
                    placeholder="e.g. CS2026-881"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Department / Branch
                  </label>
                  <input
                    id="reg-dept-input"
                    type="text"
                    value={regDepartment}
                    onChange={e => setRegDepartment(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Year of Study
                  </label>
                  <select
                    id="reg-year-select"
                    value={regYear}
                    onChange={e => setRegYear(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="1st Year">1st Year (Freshman)</option>
                    <option value="2nd Year">2nd Year (Sophomore)</option>
                    <option value="3rd Year">3rd Year (Junior)</option>
                    <option value="4th Year">4th Year (Senior)</option>
                    <option value="Postgraduate">Postgraduate / Masters</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Preferred Time Slot / Batch
                </label>
                <select
                  id="reg-batch-select"
                  value={regPreferredBatch}
                  onChange={e => setRegPreferredBatch(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.slotDurationMinutes} mins)
                    </option>
                  ))}
                  {batches.length === 0 && (
                    <option value="batch-1">Batch A (90 mins)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  GitHub Profile / Portfolio (Optional)
                </label>
                <input
                  id="reg-github-input"
                  type="url"
                  value={regGithub}
                  onChange={e => setRegGithub(e.target.value)}
                  placeholder="https://github.com/username"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2">
                <button
                  id="reg-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                  <span>{loading ? 'Submitting Registration...' : 'Submit Student Registration'}</span>
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Already registered & approved? Go to Login
                </button>
              </div>
            </form>
          )}

          {/* 3. REGISTRATION SUBMITTED SUCCESS VIEW */}
          {submittedReg && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900">
                Registration Submitted Successfully!
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
                Thank you, <strong className="text-gray-900">{submittedReg.name}</strong>. Your registration has been received and is currently <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">Pending Admin Approval</span>.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left text-xs space-y-1.5 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Registration Ref:</span>
                  <span className="font-mono font-bold text-gray-900">{submittedReg.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">College:</span>
                  <span className="font-semibold text-gray-800">{submittedReg.college}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Email:</span>
                  <span className="font-semibold text-gray-800">{submittedReg.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Status:</span>
                  <span className="font-bold text-amber-700">Awaiting Jury Review</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 leading-normal max-w-xs mx-auto">
                Once the administrator approves your request in the Admin Suite, your login credentials (username & password) will be active.
              </p>

              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedReg(null);
                    setMode('login');
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Return to Login
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
