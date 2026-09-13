import React, { useState, useEffect } from 'react';
import {
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Monitor,
  ExternalLink,
  Laptop,
  Layers,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import {
  getBrowserInfo,
  checkFullscreenSupport,
  requestFullscreenDirect,
  exitFullscreenDirect,
  BrowserInfo,
  FullscreenCapability
} from '../utils/fullscreen';

interface FullscreenTestPageProps {
  onBack?: () => void;
}

export const FullscreenTestPage: React.FC<FullscreenTestPageProps> = ({ onBack }) => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>(() => getBrowserInfo());
  const [capability, setCapability] = useState<FullscreenCapability>(() => checkFullscreenSupport());
  const [testStatus, setTestStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Sync state on fullscreenchange and window resize
  const refreshDiagnostics = () => {
    setBrowserInfo(getBrowserInfo());
    setCapability(checkFullscreenSupport());
  };

  useEffect(() => {
    const handleFsChange = () => {
      refreshDiagnostics();
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    window.addEventListener('resize', refreshDiagnostics);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
      window.removeEventListener('resize', refreshDiagnostics);
    };
  }, []);

  const handleTestFullscreen = async () => {
    setIsTesting(true);
    setTestFeedback(null);
    setTestStatus('IDLE');

    try {
      const res = await requestFullscreenDirect();
      if (res.success && document.fullscreenElement) {
        setTestStatus('SUCCESS');
        setTestFeedback('✓ Fullscreen supported and active! Hardware, OS, and browser passed direct user-gesture activation.');
      } else {
        setTestStatus('FAILED');
        setTestFeedback(res.error || '✗ Fullscreen unavailable on this system.');
      }
    } catch (err: any) {
      console.error('[FULLSCREEN TEST ERROR]', err);
      setTestStatus('FAILED');
      setTestFeedback(`✗ Fullscreen unavailable: ${err?.message || 'Activation rejected by browser security policy'}`);
    } finally {
      setIsTesting(false);
      refreshDiagnostics();
    }
  };

  const handleExitFullscreen = async () => {
    await exitFullscreenDirect();
    refreshDiagnostics();
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Monitor className="w-3.5 h-3.5 text-indigo-600" />
            <span>Internal Diagnostic Suite</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Fullscreen Hardware & Browser Compatibility Test
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
            Verify whether candidate laptops and browser configurations support direct user-gesture Fullscreen API activation before starting the contest.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={refreshDiagnostics}
            className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
            <span>Refresh State</span>
          </button>
          {capability.isIframe && (
            <button
              onClick={handleOpenInNewTab}
              className="px-4 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>Open in New Tab</span>
            </button>
          )}
        </div>
      </div>

      {/* Test Execution Action Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-gray-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Maximize2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Live Fullscreen Activation Test
              </h2>
              <p className="text-xs text-indigo-200">
                Executes a direct user gesture to test whether this laptop enters fullscreen without security rejections.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              id="admin-test-fullscreen-btn"
              onClick={handleTestFullscreen}
              disabled={isTesting}
              className="px-6 py-3.5 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.99] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Maximize2 className="w-4 h-4" />
              <span>{isTesting ? 'Testing Activation...' : 'TEST FULLSCREEN'}</span>
            </button>

            {capability.isCurrentlyFullscreen && (
              <button
                onClick={handleExitFullscreen}
                className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <Minimize2 className="w-4 h-4 text-amber-300" />
                <span>Exit Fullscreen</span>
              </button>
            )}
          </div>

          {/* Test Feedback Notice */}
          {testStatus === 'SUCCESS' && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-medium space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>✓ Fullscreen supported</span>
              </div>
              <p className="text-emerald-300/90">{testFeedback}</p>
            </div>
          )}

          {testStatus === 'FAILED' && (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-medium space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>✗ Fullscreen unavailable</span>
              </div>
              <p className="text-rose-300/90">{testFeedback}</p>
              {capability.isIframe && (
                <p className="text-[11px] text-rose-200 font-semibold pt-1">
                  Recommendation: Assessment page must be opened directly in a browser tab.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Card 1: Browser Detection */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Browser</span>
            {browserInfo.isRecommended ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Recommended
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Compatible
              </span>
            )}
          </div>
          <div className="text-base font-black text-gray-900">
            {browserInfo.name}
          </div>
          <div className="text-xs text-gray-600 space-y-1 pt-1 border-t border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-500">Browser Version:</span>
              <span className="font-mono font-medium">{browserInfo.version || 'Standard'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Operating System:</span>
              <span className="font-medium text-gray-800">{browserInfo.os}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Fullscreen API Support */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fullscreen API</span>
            {capability.isSupported ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Supported
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                <XCircle className="w-3.5 h-3.5" /> Not Supported
              </span>
            )}
          </div>
          <div className="text-base font-black text-gray-900">
            {capability.isSupported ? 'document.documentElement.requestFullscreen' : 'API Missing'}
          </div>
          <div className="text-xs text-gray-600 space-y-1 pt-1 border-t border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-500">document.fullscreenEnabled:</span>
              <span className="font-mono font-bold text-gray-900">
                {String(capability.isEnabled)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current State:</span>
              <span className="font-bold text-gray-900">
                {capability.isCurrentlyFullscreen ? 'Fullscreen Active' : 'Windowed (Inactive)'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Iframe & Environment */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Environment Frame</span>
            {capability.isIframe ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Iframe Detected
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Top-Level Tab
              </span>
            )}
          </div>
          <div className="text-base font-black text-gray-900">
            {capability.isIframe ? 'Embedded (window.self !== window.top)' : 'Direct Browser Tab'}
          </div>
          <div className="text-xs text-gray-600 space-y-1 pt-1 border-t border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-500">Iframe Permissions:</span>
              <span className="font-semibold text-gray-800">
                {capability.isIframeRestricted ? 'Restricted' : 'Permitted / Direct'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Recommended Action:</span>
              <span className="font-semibold text-gray-800">
                {capability.isIframe ? 'Open in new tab' : 'Ready for test'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User-Agent String Inspector */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Client User-Agent
          </span>
          <span className="text-[11px] text-gray-400">Hardware & Browser Identity</span>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-[11px] text-gray-700 break-all select-all">
          {browserInfo.userAgent}
        </div>
      </div>

      {/* Cross-Laptop Best Practices Checklist */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-2.5 text-xs text-blue-950">
        <h3 className="font-extrabold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-blue-700" />
          <span>Cross-Laptop Proctoring Checklist:</span>
        </h3>
        <ul className="space-y-1.5 text-blue-900/90 pl-1">
          <li>• Officially supported browsers: <strong>Google Chrome</strong> and <strong>Microsoft Edge</strong> (latest stable versions).</li>
          <li>• Laptops with multiple monitors or external displays should mirror or use the primary display window.</li>
          <li>• Ensure students close third-party desktop notification popups and browser extension dialogs before entering fullscreen.</li>
          <li>• Fullscreen must always be triggered by the student's direct button click gesture (never asynchronous or timer triggers).</li>
        </ul>
      </div>
    </div>
  );
};
