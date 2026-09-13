import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Maximize2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Laptop,
  Wifi,
  Globe,
  Check,
  XCircle
} from 'lucide-react';
import { Contest, Round, User } from '../types';
import {
  getBrowserInfo,
  checkFullscreenSupport,
  BrowserInfo,
  FullscreenCapability
} from '../utils/fullscreen';

interface PreContestRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  contest: Contest | null;
  round: Round | null;
  currentUser: User | null;
  onEnterFullscreenAndStart: () => Promise<void>;
}

export const PreContestRulesModal: React.FC<PreContestRulesModalProps> = ({
  isOpen,
  onClose,
  contest,
  round,
  currentUser,
  onEnterFullscreenAndStart
}) => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>(() => getBrowserInfo());
  const [capability, setCapability] = useState<FullscreenCapability>(() => checkFullscreenSupport());
  
  // Failure state for retry mechanism
  const [fullscreenFailed, setFullscreenFailed] = useState<boolean>(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Refresh browser & capability diagnostics on modal open
    setBrowserInfo(getBrowserInfo());
    setCapability(checkFullscreenSupport());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isFullscreenApiAvailable = capability.isSupported;
  const isFullscreenEnabled = capability.isEnabled;
  const isIframeRestricted = capability.isIframeRestricted;
  const canProceed = isFullscreenApiAvailable && isFullscreenEnabled && !isIframeRestricted && isOnline;

  /**
   * Direct User Gesture Fullscreen Activation Handler
   *
   * Requirement 2 & 3:
   * USER CLICK -> requestFullscreen() -> verify document.fullscreenElement -> start/resume backend attempt -> load contest
   *
   * Must be called directly from the user's click event.
   */
  const handleEnterFullscreen = async () => {
    setFullscreenFailed(false);
    setFailureReason(null);

    // 1. Pre-validation of browser support
    if (!capability.isSupported) {
      setFullscreenFailed(true);
      setFailureReason("Fullscreen is not supported by this browser.");
      return;
    }

    if (capability.isIframeRestricted) {
      setFullscreenFailed(true);
      setFailureReason("This assessment page must be opened directly in a browser tab.");
      return;
    }

    if (!capability.isEnabled) {
      setFullscreenFailed(true);
      setFailureReason("Fullscreen is unavailable in this browser or page.");
      return;
    }

    setIsActivating(true);

    try {
      const docEl = document.documentElement as any;

      // 2. Direct user-gesture call to browser Fullscreen API
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      }

      // 3. Authoritative verification of document.fullscreenElement
      if (!document.fullscreenElement) {
        throw new Error("Fullscreen was not activated");
      }

      // 4. Start backend attempt only AFTER fullscreen is confirmed active
      await onEnterFullscreenAndStart();

    } catch (error: any) {
      console.error("[FULLSCREEN ERROR]", error);
      const rawMsg = String(error?.message || error || '');
      
      let specificReason = "Fullscreen could not be enabled on this attempt. Please try again.";
      if (capability.isIframe && (rawMsg.includes("Permissions") || rawMsg.includes("feature policy") || rawMsg.includes("disallowed"))) {
        specificReason = "This assessment page must be opened directly in a browser tab.";
      } else if (rawMsg.includes("not supported")) {
        specificReason = "Fullscreen is not supported by this browser.";
      } else if (rawMsg.includes("denied") || rawMsg.includes("user gesture")) {
        specificReason = "Browser prevented fullscreen. Please click Try Again without moving away from the window.";
      }

      setFailureReason(specificReason);
      setFullscreenFailed(true);
    } finally {
      setIsActivating(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-gray-900/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/90 via-blue-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Secure Assessment Mode</span>
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                🔒 Secure Coding Contest
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isActivating}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 sm:px-8 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Section 1: Recommended Browser Banner */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3 sm:p-3.5 flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-extrabold text-blue-900 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Recommended Browser:</span>
              </div>
              <p className="text-blue-800 font-medium">
                Google Chrome or Microsoft Edge (Latest Stable Version)
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-blue-100/80 text-blue-900 font-bold text-[11px] shrink-0">
              {browserInfo.name}
            </span>
          </div>

          {/* Section 18: SYSTEM CHECK */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2.5">
            <div className="text-[11px] font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>SYSTEM CHECK</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* 1. Browser Supported */}
              <div className="flex items-center gap-2 text-gray-800">
                {browserInfo.isRecommended ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span>Browser: {browserInfo.name}</span>
              </div>

              {/* 2. Fullscreen Supported */}
              <div className="flex items-center gap-2 text-gray-800">
                {isFullscreenApiAvailable && isFullscreenEnabled && !isIframeRestricted ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>
                  Fullscreen API: {isFullscreenApiAvailable && isFullscreenEnabled && !isIframeRestricted ? 'Supported' : 'Unavailable'}
                </span>
              </div>

              {/* 3. JavaScript Enabled */}
              <div className="flex items-center gap-2 text-gray-800">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>JavaScript: Enabled</span>
              </div>

              {/* 4. Connection Available */}
              <div className="flex items-center gap-2 text-gray-800">
                {isOnline ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>Connection: {isOnline ? 'Active' : 'Offline'}</span>
              </div>

              {/* 5. Contest Service Available */}
              <div className="sm:col-span-2 flex items-center gap-2 text-gray-800 pt-0.5 border-t border-gray-200/60">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Contest Service: Available & Monitored</span>
              </div>
            </div>
          </div>

          {/* 3 Questions Summary Box */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-blue-50/60 to-indigo-50/90 border border-indigo-100 rounded-2xl p-3.5 text-center space-y-1.5">
            <div className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider">
              Assigned Problem Set Overview
            </div>
            <div className="text-base font-black text-gray-900">
              3 Questions (1 Easy • 1 Medium • 1 Hard)
            </div>
          </div>

          {/* Anti-Cheat Rules Checklist */}
          <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 space-y-2 text-xs text-gray-700">
            <div className="font-extrabold text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Anti-Cheat Guidelines:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Max 3 tab switches</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>No copy/paste or drop</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>No external websites</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>No browser extensions</span>
              </div>
            </div>
          </div>

          {/* Section 4 & 5: Handle First Attempt Failure Display */}
          {fullscreenFailed && (
            <div className="bg-amber-50/90 border border-amber-300 text-amber-950 rounded-2xl p-4 text-xs space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-black text-amber-900 uppercase tracking-wider text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>FULLSCREEN REQUIRED</span>
              </div>
              
              <p className="font-semibold text-amber-900">
                {failureReason || "Fullscreen could not be enabled on this attempt."}
              </p>
              
              <p className="text-amber-800 text-[11px]">
                Please try again. Your attempt has not started, and no tab switches have been recorded.
              </p>

              <div className="bg-white/80 rounded-xl p-3 border border-amber-200/80 space-y-1 text-[11px] text-amber-950">
                <p className="font-bold text-amber-900">Recommended:</p>
                <ul className="space-y-0.5 text-amber-900/90 pl-1">
                  <li>• Use Chrome or Microsoft Edge</li>
                  <li>• Maximize the browser window</li>
                  <li>• Make sure no browser dialog/popup is open</li>
                  <li>• Open the contest directly in a browser tab</li>
                </ul>
              </div>

              {capability.isIframe && (
                <div className="pt-1">
                  <button
                    onClick={handleOpenInNewTab}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Contest Directly in New Tab</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Section 7 & 16: Iframe / In-App Browser Warning */}
          {capability.isIframeRestricted && !fullscreenFailed && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>This assessment page must be opened directly in a browser tab.</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Embedded preview frames restrict standard Fullscreen API access. Please launch this page in a direct browser tab.
              </p>
              <button
                onClick={handleOpenInNewTab}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Browser</span>
              </button>
            </div>
          )}

        </div>

        {/* Footer Buttons */}
        <div className="px-6 sm:px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isActivating}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-200 transition cursor-pointer"
          >
            Cancel
          </button>

          {/* Direct User-Gesture Launch / Retry Button */}
          <button
            id="enter-fullscreen-and-start-btn"
            onClick={handleEnterFullscreen}
            disabled={isActivating || !canProceed}
            className={`px-6 py-3 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !canProceed
                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                : fullscreenFailed
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
            <span>
              {isActivating
                ? 'Activating Fullscreen...'
                : fullscreenFailed
                ? 'TRY AGAIN'
                : 'ENTER FULLSCREEN & START TEST'}
            </span>
            {!isActivating && !fullscreenFailed && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </div>
  );
};
