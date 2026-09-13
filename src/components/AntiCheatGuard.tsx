import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ContestSettings, ParticipantSecurityState } from '../types';
import { api } from '../api';
import { ShieldAlert, AlertOctagon, XCircle, Lock, Maximize2, Shield, AlertTriangle, ShieldCheck, ExternalLink, RotateCcw } from 'lucide-react';
import { requestFullscreenDirect, checkFullscreenSupport } from '../utils/fullscreen';

interface AntiCheatGuardProps {
  participantId: string;
  roundId: string;
  settings: ContestSettings;
  securityState: ParticipantSecurityState | null;
  onSecurityUpdate: (state: ParticipantSecurityState) => void;
  onAttemptTerminated?: (attempt?: any) => void;
  onNavigateHome?: () => void;
  onSwitchToAdmin?: () => void;
}

export const AntiCheatGuard: React.FC<AntiCheatGuardProps> = ({
  participantId,
  roundId,
  settings,
  securityState,
  onSecurityUpdate,
  onAttemptTerminated,
  onNavigateHome,
  onSwitchToAdmin
}) => {
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [lastWarningText, setLastWarningText] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  
  // Strict Fullscreen tracking state
  const isFullscreenEnforced = settings?.lockdownFullscreen !== false;
  const [isFullscreenWarningOpen, setIsFullscreenWarningOpen] = useState<boolean>(() => {
    return isFullscreenEnforced && !document.fullscreenElement;
  });
  const [isResumePrompt, setIsResumePrompt] = useState<boolean>(() => {
    return isFullscreenEnforced && !document.fullscreenElement;
  });
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const wasFullscreenRef = useRef<boolean>(!!document.fullscreenElement);
  const lastFullscreenTransitionTimeRef = useRef<number>(0);

  const [shortcutWarning, setShortcutWarning] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(6);
  const [resumedNoticeDismissed, setResumedNoticeDismissed] = useState<boolean>(false);
  const [terminationDetails, setTerminationDetails] = useState<{
    reason?: string;
    submissionsCount?: number;
  }>({});

  const showResumedModal = !securityState?.sessionTerminated && securityState?.adminOverridden && !resumedNoticeDismissed;

  const handleAdminOverrideUnlock = async () => {
    setUnlocking(true);
    try {
      const res = await api.adminUnlock(participantId, roundId, 'Jury Manual Reset');
      onSecurityUpdate(res.securityState);
      if (res.securityState && !res.securityState.sessionTerminated) {
        setWarningModalOpen(false);
      }
    } catch (e) {
      console.error('Failed to unlock session:', e);
    } finally {
      setUnlocking(false);
    }
  };

  /**
   * Direct User Gesture Fullscreen Re-entry / Resume Handler
   */
  const handleReturnToFullscreen = async () => {
    setFullscreenError(null);
    lastFullscreenTransitionTimeRef.current = Date.now();

    try {
      const res = await requestFullscreenDirect();

      // If entered successfully, update ref and state
      if (res.success && document.fullscreenElement) {
        setIsFullscreenWarningOpen(false);
        setIsResumePrompt(false);
        if (!wasFullscreenRef.current) {
          wasFullscreenRef.current = true;
          api.recordSecurityEvent('FULLSCREEN_ENTER', 'Participant returned to browser full-screen mode', roundId)
            .then(secRes => onSecurityUpdate(secRes.securityState))
            .catch(() => {});
        }
      } else {
        setFullscreenError(res.error || "Fullscreen could not be enabled on this attempt. Please try again.");
      }
    } catch (err: any) {
      console.warn('Failed to re-enter fullscreen:', err);
      setFullscreenError("Fullscreen could not be enabled on this attempt. Please try again.");
    }
  };

  // Fullscreen change listener & state tracking
  useEffect(() => {
    const handleFullscreenChange = async () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      lastFullscreenTransitionTimeRef.current = Date.now();

      if (!isCurrentlyFullscreen && wasFullscreenRef.current) {
        // Participant exited fullscreen during the test (e.g. Escape key)
        wasFullscreenRef.current = false;
        setIsResumePrompt(false);
        if (isFullscreenEnforced) {
          setIsFullscreenWarningOpen(true);
        }
        try {
          // Log FULLSCREEN_EXIT event - does NOT increment tab switches!
          const res = await api.recordSecurityEvent('FULLSCREEN_EXIT', 'Participant exited browser full-screen mode', roundId);
          onSecurityUpdate(res.securityState);
        } catch (e) {
          console.error('Error recording FULLSCREEN_EXIT event:', e);
        }
      } else if (isCurrentlyFullscreen && !wasFullscreenRef.current) {
        // Participant entered fullscreen
        wasFullscreenRef.current = true;
        setIsFullscreenWarningOpen(false);
        setIsResumePrompt(false);
        try {
          // Log FULLSCREEN_ENTER event
          const res = await api.recordSecurityEvent('FULLSCREEN_ENTER', 'Participant entered browser full-screen mode', roundId);
          onSecurityUpdate(res.securityState);
        } catch (e) {
          console.error('Error recording FULLSCREEN_ENTER event:', e);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isFullscreenEnforced, roundId, onSecurityUpdate]);

  // Initial Check on Mount (Page Reload / Reconnect / Refresh)
  useEffect(() => {
    const isCurrentlyFullscreen = !!document.fullscreenElement;
    if (!isCurrentlyFullscreen && isFullscreenEnforced) {
      setIsFullscreenWarningOpen(true);
      setIsResumePrompt(true);
      wasFullscreenRef.current = false;
    } else if (isCurrentlyFullscreen) {
      wasFullscreenRef.current = true;
      setIsFullscreenWarningOpen(false);
      setIsResumePrompt(false);
    }
  }, [isFullscreenEnforced]);

  // Track last tab switch event timestamp to prevent double counting
  const lastSwitchRecordedTimeRef = useRef<number>(0);

  // Trigger accurate tab switch violation (handles both tab switch & window blur)
  const triggerTabViolation = useCallback(async (type: 'TAB_SWITCH' | 'WINDOW_BLUR', reason: string) => {
    const now = Date.now();
    // 1500ms debounce ensures rapid firing of blur + visibilitychange for the same switch is counted once
    if (now - lastSwitchRecordedTimeRef.current < 1500) {
      return;
    }
    // Ignore during intentional fullscreen transitions
    if (now - lastFullscreenTransitionTimeRef.current < 2000) {
      return;
    }

    lastSwitchRecordedTimeRef.current = now;

    try {
      const res = await api.recordViolation('TAB_SWITCH', reason, roundId);
      onSecurityUpdate(res.securityState);
      
      if (res.isTerminated || res.securityState.sessionTerminated || res.securityState.tabSwitchCount >= res.securityState.maxAllowedSwitches) {
        setWarningModalOpen(false);
        setTerminationDetails({
          reason: res.securityState.terminationReason || 'Exceeded maximum allowed tab switches. Session terminated and code auto-submitted.',
          submissionsCount: (res as any).submissions?.length || 3
        });
        if (onAttemptTerminated) {
          onAttemptTerminated(res.attempt);
        }
      } else {
        const remaining = Math.max(0, res.securityState.maxAllowedSwitches - res.securityState.tabSwitchCount);
        setLastWarningText(
          `Tab switch detected (${res.securityState.tabSwitchCount}/${res.securityState.maxAllowedSwitches})! Remaining tab switches: ${remaining}. Tab switching is strictly prohibited while coding.`
        );
        setWarningModalOpen(true);
      }
    } catch (e) {
      console.error('Failed to record tab switch violation:', e);
    }
  }, [roundId, onSecurityUpdate, onAttemptTerminated]);

  // Tab switch & window blur detection (Debounced & accurate to prevent false positives while coding)
  useEffect(() => {
    let blurTimeout: any = null;

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        triggerTabViolation('TAB_SWITCH', 'Switched browser tab or minimized window');
      }
    };

    const handleWindowBlur = () => {
      // Small debounce to check if user clicked an internal dropdown, editor, or iframe
      if (blurTimeout) clearTimeout(blurTimeout);
      blurTimeout = setTimeout(() => {
        // Only trigger if document has genuinely lost focus to another application or OS window
        if (!document.hasFocus() && (document.hidden || document.visibilityState === 'hidden')) {
          triggerTabViolation('TAB_SWITCH', 'Window focus lost to external application');
        }
      }, 300);
    };

    const handleWindowFocus = () => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [triggerTabViolation]);

  // Active Extension Scanner & Disabler (Destroys injected extension elements, overlays & disables extension styles)
  useEffect(() => {
    // Inject permanent CSS shield against known extensions and assistive overlays
    const styleEl = document.createElement('style');
    styleEl.id = 'anti-extension-shield';
    styleEl.textContent = `
      [id*="extension" i], [class*="extension" i], 
      [id*="copilot" i], [class*="copilot" i], 
      [id*="chatgpt" i], [class*="chatgpt" i], 
      [id*="monica" i], [class*="monica" i],
      [id*="codeium" i], [class*="codeium" i],
      [id*="blackbox" i], [class*="blackbox" i],
      [id*="supermaven" i], [class*="supermaven" i],
      [id*="tabnine" i], [class*="tabnine" i],
      [id*="deepseek" i], [class*="deepseek" i],
      [data-browser-extension], [data-extension],
      grammarly-extension, grammarly-popups, [data-grammarly-part],
      [data-lastpass-root], [data-bitwarden-root],
      iframe[src^="chrome-extension:"], iframe[src^="moz-extension:"],
      iframe[src^="edge-extension:"], script[src^="chrome-extension:"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        max-width: 0 !important;
        max-height: 0 !important;
        position: absolute !important;
        left: -9999px !important;
      }
    `;
    document.head.appendChild(styleEl);

    const extensionSelectors = [
      '[id*="extension" i]',
      '[class*="extension" i]',
      '[id*="copilot" i]',
      '[class*="copilot" i]',
      '[id*="chatgpt" i]',
      '[class*="chatgpt" i]',
      '[id*="monica" i]',
      '[class*="monica" i]',
      '[id*="codeium" i]',
      '[class*="codeium" i]',
      '[id*="blackbox" i]',
      '[class*="blackbox" i]',
      '[data-extension]',
      '[data-browser-extension]',
      'grammarly-extension',
      'grammarly-popups',
      '[data-grammarly-part]',
      '[data-lastpass-root]',
      '[data-bitwarden-root]',
      'iframe[src^="chrome-extension:"]',
      'iframe[src^="moz-extension:"]',
      'script[src^="chrome-extension:"]',
      'script[src^="moz-extension:"]'
    ];

    const scanAndRemoveExtensions = () => {
      try {
        const elements = document.querySelectorAll(extensionSelectors.join(','));
        if (elements.length > 0) {
          elements.forEach(el => {
            try {
              el.remove(); // Forcefully destroy extension UI
            } catch (_) {}
          });
          setShortcutWarning('Browser extension detected and disabled.');
          setTimeout(() => setShortcutWarning(null), 3000);
          api.recordSecurityEvent('EXTENSION_DETECTED', 'Active browser extension element removed from DOM', roundId)
            .then(r => onSecurityUpdate(r.securityState))
            .catch(() => {});
        }
      } catch (_) {}
    };

    const extInterval = setInterval(scanAndRemoveExtensions, 1500);

    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of Array.from(mut.addedNodes)) {
          if (node instanceof HTMLElement) {
            const tag = node.tagName.toLowerCase();
            const id = (node.id || '').toLowerCase();
            const className = (typeof node.className === 'string' ? node.className : '').toLowerCase();

            if (
              tag.includes('extension') ||
              tag.includes('grammarly') ||
              id.includes('extension') ||
              id.includes('copilot') ||
              id.includes('chatgpt') ||
              id.includes('monica') ||
              id.includes('codeium') ||
              id.includes('blackbox') ||
              className.includes('extension') ||
              className.includes('copilot') ||
              node.hasAttribute('data-browser-extension')
            ) {
              try {
                node.remove();
              } catch (_) {}
              setShortcutWarning('Browser extension injection neutralized.');
              setTimeout(() => setShortcutWarning(null), 3000);
              api.recordSecurityEvent('EXTENSION_DETECTED', `Injected extension element <${tag}> was removed`, roundId)
                .then(r => onSecurityUpdate(r.securityState))
                .catch(() => {});
            }
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Prevent accidental page close or navigating away
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Assessment session in progress. Leaving this page will terminate your contest attempt.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      styleEl.remove();
      clearInterval(extInterval);
      observer.disconnect();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roundId, onSecurityUpdate]);

  // Restrict Context Menu (right-click), Copy-Paste, & Keyboard Shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (settings.blockContextMenu) {
        e.preventDefault();
        api.recordViolation('CONTEXT_MENU', 'Attempted right-click inspect context menu', roundId)
          .then(r => onSecurityUpdate(r.securityState))
          .catch(() => {});
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (settings.blockClipboardPaste) {
        e.preventDefault();
        setShortcutWarning('Copying content is disabled during the contest.');
        setTimeout(() => setShortcutWarning(null), 3000);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (settings.blockClipboardPaste) {
        e.preventDefault();
        setShortcutWarning('Pasting external code is strictly prohibited.');
        setTimeout(() => setShortcutWarning(null), 3000);
        api.recordSecurityEvent('CLIPBOARD_PASTE', 'External code snippet pasted via clipboard', roundId)
          .then(r => onSecurityUpdate(r.securityState))
          .catch(() => {});
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (settings.blockClipboardPaste) {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Drag and drop injection is prohibited.');
        setTimeout(() => setShortcutWarning(null), 3000);
        api.recordSecurityEvent('DROP_PASTE', 'Attempted drag and drop code injection', roundId)
          .then(r => onSecurityUpdate(r.securityState))
          .catch(() => {});
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (settings.blockClipboardPaste) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect Windows / Meta / OS key press
      if (
        e.key === 'Meta' ||
        e.key === 'OS' ||
        e.code === 'MetaLeft' ||
        e.code === 'MetaRight' ||
        e.code === 'OSLeft' ||
        e.code === 'OSRight' ||
        e.keyCode === 91 ||
        e.keyCode === 92
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerTabViolation('TAB_SWITCH', 'Pressed Windows / Meta key');
        return;
      }

      // Disallow Devtools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Developer tools inspection is prohibited.');
        setTimeout(() => setShortcutWarning(null), 3000);
        api.recordSecurityEvent('DEVTOOLS_OPEN', 'Attempted devtools shortcut inspection', roundId)
          .then(r => onSecurityUpdate(r.securityState))
          .catch(() => {});
        return;
      }

      // Disallow Page Refresh (Ctrl+R, F5, Cmd+R)
      if (
        e.key === 'F5' ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Page refresh shortcut blocked. Your progress is auto-saved.');
        setTimeout(() => setShortcutWarning(null), 3000);
        return;
      }

      // Disallow Print (Ctrl+P, Cmd+P) and View Source (Ctrl+U, Cmd+U)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Browser shortcuts are disabled during test execution.');
        setTimeout(() => setShortcutWarning(null), 3000);
        return;
      }

      // Block Shift + Insert (Legacy paste shortcut)
      if (settings.blockClipboardPaste && e.shiftKey && e.key === 'Insert') {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Paste shortcut (Shift+Insert) is disabled.');
        setTimeout(() => setShortcutWarning(null), 3000);
        api.recordSecurityEvent('SHIFT_INSERT_PASTE', 'Attempted paste via Shift+Insert', roundId)
          .then(r => onSecurityUpdate(r.securityState))
          .catch(() => {});
        return;
      }

      // Block Ctrl+V / Cmd+V / Ctrl+Shift+V
      if (settings.blockClipboardPaste && (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Paste shortcut (Ctrl+V) is disabled.');
        setTimeout(() => setShortcutWarning(null), 3000);
        api.recordSecurityEvent('CLIPBOARD_PASTE', 'Attempted paste via Ctrl+V / Cmd+V shortcut', roundId)
          .then(r => onSecurityUpdate(r.securityState))
          .catch(() => {});
        return;
      }

      // Block Ctrl+C / Cmd+C
      if (settings.blockClipboardPaste && (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Copy shortcut (Ctrl+C) is disabled.');
        setTimeout(() => setShortcutWarning(null), 3000);
      }

      // Block Ctrl+X / Cmd+X
      if (settings.blockClipboardPaste && (e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
        setShortcutWarning('Cut shortcut (Ctrl+X) is disabled.');
        setTimeout(() => setShortcutWarning(null), 3000);
        return;
      }

      // Actively intercept and disable Tab Switching & Navigation Shortcuts while coding
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Tab' || e.key === 'PageUp' || e.key === 'PageDown')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setShortcutWarning('Tab switching is disabled in the coding workspace.');
        setTimeout(() => setShortcutWarning(null), 2500);
        return;
      }

      // Block New Tab (Ctrl+T, Cmd+T)
      if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setShortcutWarning('Opening new tabs is disabled while coding.');
        setTimeout(() => setShortcutWarning(null), 2500);
        return;
      }

      // Block New Window (Ctrl+N, Cmd+N)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setShortcutWarning('Opening new windows is disabled while coding.');
        setTimeout(() => setShortcutWarning(null), 2500);
        return;
      }

      // Block Close Window / Tab (Ctrl+W, Cmd+W)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setShortcutWarning('Tab closure shortcuts are disabled.');
        setTimeout(() => setShortcutWarning(null), 2500);
        return;
      }

      // Block Alt shortcuts (often used for extension shortcuts, window switching, or Alt+Tab)
      if (e.altKey && (e.key === 'Tab' || e.key !== 'Alt')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setShortcutWarning('Alt key navigation and tab switching are disabled while coding.');
        setTimeout(() => setShortcutWarning(null), 2500);
        return;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [settings, roundId, onSecurityUpdate]);

  const isTerminated = !!securityState?.sessionTerminated && !securityState?.adminOverridden;

  return (
    <>
      {/* Shortcut Warning Floating Toast */}
      {shortcutWarning && (
        <div className="fixed top-16 right-6 z-50 bg-rose-900 border border-rose-700 text-rose-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-150">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          <span>{shortcutWarning}</span>
        </div>
      )}

      {/* Mandatory Full-Screen Exited / Resume Warning Overlay */}
      {isFullscreenWarningOpen && !isTerminated && (
        <div className="fixed inset-0 bg-slate-950/90 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl border border-gray-200 space-y-4 animate-in zoom-in-95 duration-200">
            
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
              fullscreenError ? 'bg-amber-100 border border-amber-300 text-amber-700' : 'bg-indigo-100 border border-indigo-200 text-indigo-700'
            }`}>
              {fullscreenError ? <AlertTriangle className="w-7 h-7 text-amber-600" /> : <Maximize2 className="w-7 h-7 text-indigo-600" />}
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 bg-indigo-50 text-indigo-800 border border-indigo-100">
                <Shield className="w-3.5 h-3.5" />
                <span>{isResumePrompt ? 'RESUME SESSION' : 'MANDATORY FULLSCREEN'}</span>
              </div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                {fullscreenError
                  ? 'FULLSCREEN REQUIRED'
                  : isResumePrompt
                  ? 'RESUME TEST'
                  : 'FULLSCREEN REQUIRED'}
              </h2>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed font-medium">
                {fullscreenError
                  ? 'Fullscreen could not be enabled on this attempt. Please try again.'
                  : isResumePrompt
                  ? 'You have an ongoing contest session. Please enter fullscreen to resume.'
                  : 'Please return to fullscreen to continue.'}
              </p>
            </div>

            {/* Recommendations or Policy Reminders */}
            {fullscreenError ? (
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 text-left text-xs text-amber-950 space-y-1.5">
                <p className="font-bold text-amber-900">Recommended:</p>
                <ul className="space-y-0.5 text-[11px] text-amber-900/90 pl-1 font-medium">
                  <li>• Use Chrome or Microsoft Edge</li>
                  <li>• Maximize the browser window</li>
                  <li>• Make sure no browser dialog/popup is open</li>
                  <li>• Open the contest directly in a browser tab</li>
                </ul>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-left text-xs text-gray-700 space-y-1">
                <p className="font-bold text-gray-900 text-[11px] uppercase tracking-wider">Session State Intact:</p>
                <p className="text-[11px] text-gray-600">• Your timer, questions, code, and submissions are preserved.</p>
                <p className="text-[11px] text-gray-600">• Fullscreen exit does NOT count as a tab switch.</p>
                <p className="text-[11px] text-gray-600">• Workspace unlocks immediately upon returning to fullscreen.</p>
              </div>
            )}

            {/* Direct User Gesture Action Button */}
            <div className="space-y-2 pt-1">
              <button
                id="return-to-fullscreen-btn"
                onClick={handleReturnToFullscreen}
                className={`w-full py-3.5 px-4 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] ${
                  fullscreenError
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
                }`}
              >
                <Maximize2 className="w-4 h-4" />
                <span>
                  {fullscreenError
                    ? 'TRY AGAIN'
                    : isResumePrompt
                    ? 'ENTER FULLSCREEN & RESUME'
                    : 'RETURN TO FULLSCREEN'}
                </span>
              </button>

              {/* If in iframe, offer open in new tab */}
              {typeof window !== 'undefined' && window.self !== window.top && (
                <button
                  onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                  className="w-full py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                  <span>Open in Direct Browser Tab</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Permanent Lockout Screen if Session Terminated */}
      {isTerminated && (
        <div className="fixed inset-0 bg-gray-950/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 text-center shadow-2xl border border-red-200 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600 mb-4 shadow-xs">
              <AlertOctagon className="w-9 h-9" />
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Test Auto Submitted</span>
            </div>

            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
              No Remaining Tab Switches
            </h2>
            
            <p className="text-xs text-gray-600 mb-5 leading-relaxed">
              {securityState?.terminationReason ||
                'Your contest attempt has been automatically submitted due to exceeding the maximum allowed tab switch threshold.'}
            </p>

            {/* Auto-Submit Confirmation Box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 text-left text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Work Automatically Submitted to Judge:</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                ✓ Latest code snapshots for all assigned problems have been captured and entered into the automated evaluation queue.
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold">
                ✓ Evaluation in progress. Your score will be reflected on the results board.
              </p>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-3.5 mb-5 text-left text-xs text-red-800 space-y-1">
              <p className="font-bold">Violation Audit Record:</p>
              <p>• Participant ID: {participantId}</p>
              <p>• Tab Switch Count: {securityState?.tabSwitchCount || 3} / {securityState?.maxAllowedSwitches || 3}</p>
              <p>• Lockout Trigger: Automated Anti-Cheat Guardian</p>
            </div>

            <div className="space-y-2.5 pt-1">
              {onNavigateHome && (
                <button
                  id="lockout-home-btn"
                  onClick={onNavigateHome}
                  className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Return to Student Home & View Status</span>
                </button>
              )}

              {onSwitchToAdmin && (
                <button
                  id="admin-override-unlock-btn"
                  onClick={handleAdminOverrideUnlock}
                  disabled={unlocking}
                  className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-gray-500" />
                  <span>{unlocking ? 'Executing...' : 'Jury / Admin Reset & Unlock'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Alert Modal for 1st & 2nd tab switches */}
      {warningModalOpen && !isTerminated && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-xl border border-amber-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto text-amber-600 mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Tab Switch Warning
            </h3>
            <p className="text-xs text-gray-600 mb-4 leading-normal">
              {lastWarningText}
            </p>
            <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 rounded-lg p-2.5 mb-4 border border-amber-200 text-center">
              <span className="font-bold">
                {Math.max(0, (securityState?.maxAllowedSwitches ?? 3) - (securityState?.tabSwitchCount ?? 0))}
              </span> remaining tab {(Math.max(0, (securityState?.maxAllowedSwitches ?? 3) - (securityState?.tabSwitchCount ?? 0))) === 1 ? 'switch' : 'switches'} before immediate termination and auto-submission.
            </div>
            <button
              id="dismiss-anticheat-warning"
              onClick={() => setWarningModalOpen(false)}
              className="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              I Understand & Return to Coding
            </button>
          </div>
        </div>
      )}

      {/* Admin Unlocked & Resumed Notification Modal */}
      {showResumedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border border-emerald-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider mb-2">
                <span>🔓 TEST UNLOCKED & RESUMED</span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">
                Contest Attempt Resumed
              </h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                An administrator has reviewed your contest lock and authorized you to continue your test.
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-left text-xs text-emerald-900 space-y-1">
              <p className="font-bold">Preserved Test Environment:</p>
              <p className="text-[11px] text-emerald-800">✓ Your saved code & snapshots remain intact.</p>
              <p className="text-[11px] text-emerald-800">✓ Assigned question set is unchanged.</p>
              <p className="text-[11px] text-emerald-800">✓ Remaining contest time continues from deadline.</p>
            </div>

            <button
              id="dismiss-resumed-notice-btn"
              onClick={() => setResumedNoticeDismissed(true)}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continue Test</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
