import React, { useState } from 'react';
import { User, Batch } from '../types';
import { api } from '../api';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';

interface LoginPageProps {
  batches: Batch[];
  onLoginSuccess: (user: User, initialTab?: 'home' | 'admin') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionError, setActiveSessionError] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setActiveSessionError(false);

    try {
      const res = await api.login(email.trim(), password);
      const user = res.user;

      if (user.role === 'PARTICIPANT') {
        onLoginSuccess(user, 'home');
      } else {
        onLoginSuccess(user, 'admin');
      }
    } catch (err: any) {
      if (err.code === 'ACTIVE_SESSION_EXISTS' || err.status === 409) {
        setActiveSessionError(true);
      } else {
        setError(err.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4 sm:p-6 md:p-8 font-sans selection:bg-amber-100 selection:text-amber-900">
      <div className="w-full max-w-[1200px] h-[760px] max-h-[90vh] bg-white rounded-[32px] overflow-hidden flex shadow-2xl shadow-gray-200/50 border border-gray-100">
        
        {/* Left Panel: Form */}
        <div className="w-full lg:w-[45%] flex flex-col justify-between bg-[#F7F5EF] p-8 md:p-12 lg:p-14">
          
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center text-white font-black text-sm tracking-tighter">
              &lt;/&gt;
            </div>
            <span className="font-extrabold text-lg tracking-tight text-gray-900">CodeArena</span>
          </div>

          {/* Form Area */}
          <div className="w-full max-w-sm mx-auto my-auto">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Welcome Back</h1>
            <p className="text-sm text-gray-500 mb-8">
              Sign in to continue to your CodeArena account.
            </p>

            {activeSessionError ? (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 animate-in fade-in space-y-1">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                  <span>ACCOUNT ALREADY IN USE</span>
                </div>
                <p className="text-xs font-semibold text-amber-900">
                  This account is currently logged in on another device or browser.
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed pt-0.5">
                  If you recently closed the other browser, please wait for the session to expire (approx. 2 minutes) or ask an administrator to end the active session.
                </p>
              </div>
            ) : error && (
              <div className="mb-6 p-3.5 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 font-medium animate-in fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="text"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-5 h-[56px] bg-white border border-gray-200 rounded-[28px] text-gray-900 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 focus:outline-hidden transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-5 pr-12 h-[56px] bg-white border border-gray-200 rounded-[28px] text-gray-900 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 focus:outline-hidden transition-all placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer appearance-none w-5 h-5 border border-gray-300 rounded-md checked:bg-gray-900 checked:border-gray-900 transition-colors cursor-pointer"
                    />
                    <div className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 4L4 7L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Remember me</span>
                </label>
                
                <button type="button" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
                  Forgot password?
                </button>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[56px] bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-gray-900 font-bold text-sm rounded-[28px] shadow-[0_4px_14px_0_rgba(251,191,36,0.39)] hover:shadow-[0_6px_20px_rgba(251,191,36,0.23)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_14px_0_rgba(251,191,36,0.39)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </div>
            </form>
            
            <div className="mt-8 text-center">
               <p className="text-xs text-gray-400 font-medium">Student accounts are created by the administrator.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-400 font-medium">
            © 2026 CodeArena
          </div>
        </div>

        {/* Right Panel: Image */}
        <div className="hidden lg:block w-[55%] relative bg-gray-100 overflow-hidden rounded-r-[32px] p-4">
           <div className="w-full h-full relative rounded-[24px] overflow-hidden">
             <img 
               src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80" 
               alt="Team collaborating" 
               className="w-full h-full object-cover"
             />
             
             {/* Gradient overlay to make text readable */}
             <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
             
             {/* Glass UI elements */}
             <div className="absolute bottom-12 left-12 right-12 flex flex-col items-start gap-4">
               <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl py-3 px-5 text-white shadow-xl">
                 <h3 className="font-semibold text-sm tracking-wide">Live Coding Challenges</h3>
               </div>
               
               <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 text-white shadow-xl max-w-sm">
                 <h2 className="text-3xl font-bold mb-2">Code. Compete. Excel.</h2>
                 <p className="text-white/80 text-sm leading-relaxed">
                   Your coding journey starts here. Build the future with our comprehensive algorithmic sandbox.
                 </p>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
