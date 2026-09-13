/**
 * CodeArena Fullscreen & Anti-Cheat Compatibility Engine
 *
 * Provides robust, cross-laptop, cross-browser Fullscreen API detection,
 * user gesture verification, iframe isolation awareness, and browser diagnostics.
 */

export interface BrowserInfo {
  name: string;
  version: string;
  isChrome: boolean;
  isEdge: boolean;
  isRecommended: boolean;
  isInApp: boolean;
  os: string;
  userAgent: string;
}

export interface FullscreenCapability {
  isSupported: boolean;
  isEnabled: boolean;
  isIframe: boolean;
  isIframeRestricted: boolean;
  isCurrentlyFullscreen: boolean;
  compatibilityStatus: 'OK' | 'IFRAME_RESTRICTED' | 'NOT_SUPPORTED' | 'DISABLED';
  statusMessage: string;
}

/**
 * Detects client browser, engine, and operating system
 */
export function getBrowserInfo(): BrowserInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let name = 'Unknown Browser';
  let version = '';
  let isChrome = false;
  let isEdge = false;
  let isInApp = false;

  // Detect In-App browsers (Facebook, Instagram, LinkedIn, WeChat, Twitter/X, etc.)
  if (
    /FBAN|FBAV|Instagram|LinkedInApp|Line\/|MicroMessenger|musical_ly|Twitter|Snapchat/i.test(ua)
  ) {
    isInApp = true;
    name = 'In-App Webview';
  } else if (/Edg\/([0-9.]+)/i.test(ua)) {
    isEdge = true;
    name = 'Microsoft Edge';
    const match = ua.match(/Edg\/([0-9.]+)/i);
    version = match ? match[1] : '';
  } else if (/Chrome\/([0-9.]+)/i.test(ua) && !/Chromium|OPR/i.test(ua)) {
    isChrome = true;
    name = 'Google Chrome';
    const match = ua.match(/Chrome\/([0-9.]+)/i);
    version = match ? match[1] : '';
  } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
    name = 'Mozilla Firefox';
    const match = ua.match(/Firefox\/([0-9.]+)/i);
    version = match ? match[1] : '';
  } else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    name = 'Apple Safari';
    const match = ua.match(/Version\/([0-9.]+)/i);
    version = match ? match[1] : '';
  } else if (/OPR\/([0-9.]+)/i.test(ua)) {
    name = 'Opera';
    const match = ua.match(/OPR\/([0-9.]+)/i);
    version = match ? match[1] : '';
  }

  // Detect Operating System
  let os = 'Unknown OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/CrOS/i.test(ua)) os = 'Chrome OS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  return {
    name,
    version,
    isChrome,
    isEdge,
    isRecommended: isChrome || isEdge,
    isInApp,
    os,
    userAgent: ua
  };
}

/**
 * Evaluates Fullscreen API capability and iframe environment restrictions
 */
export function checkFullscreenSupport(): FullscreenCapability {
  if (typeof document === 'undefined') {
    return {
      isSupported: false,
      isEnabled: false,
      isIframe: false,
      isIframeRestricted: false,
      isCurrentlyFullscreen: false,
      compatibilityStatus: 'NOT_SUPPORTED',
      statusMessage: 'Fullscreen API is not available on this platform.'
    };
  }

  const docEl = document.documentElement as any;
  const isSupported = !!(
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen
  );

  const isEnabled = (
    document.fullscreenEnabled ??
    (document as any).webkitFullscreenEnabled ??
    (document as any).mozFullScreenEnabled ??
    (document as any).msFullscreenEnabled ??
    true
  );

  let isIframe = false;
  try {
    isIframe = window.self !== window.top;
  } catch (e) {
    isIframe = true;
  }

  const isCurrentlyFullscreen = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );

  if (!isSupported) {
    return {
      isSupported: false,
      isEnabled: false,
      isIframe,
      isIframeRestricted: false,
      isCurrentlyFullscreen,
      compatibilityStatus: 'NOT_SUPPORTED',
      statusMessage: 'Fullscreen is not supported by this browser.'
    };
  }

  if (isIframe && !isEnabled) {
    return {
      isSupported: true,
      isEnabled: false,
      isIframe: true,
      isIframeRestricted: true,
      isCurrentlyFullscreen,
      compatibilityStatus: 'IFRAME_RESTRICTED',
      statusMessage: 'This assessment page must be opened directly in a browser tab.'
    };
  }

  if (!isEnabled) {
    return {
      isSupported: true,
      isEnabled: false,
      isIframe,
      isIframeRestricted: false,
      isCurrentlyFullscreen,
      compatibilityStatus: 'DISABLED',
      statusMessage: 'Fullscreen is unavailable in this browser or page.'
    };
  }

  return {
    isSupported: true,
    isEnabled: true,
    isIframe,
    isIframeRestricted: false,
    isCurrentlyFullscreen,
    compatibilityStatus: 'OK',
    statusMessage: 'Fullscreen API is supported and enabled.'
  };
}

/**
 * Directly requests browser Fullscreen from a user gesture click.
 * Must be executed synchronously within the user event thread.
 */
export async function requestFullscreenDirect(): Promise<{
  success: boolean;
  error?: string;
  reasonCode?: string;
}> {
  if (typeof document === 'undefined') {
    return { success: false, error: 'Document not loaded' };
  }

  // If already in fullscreen, verify and return success
  if (document.fullscreenElement) {
    return { success: true };
  }

  const capability = checkFullscreenSupport();
  if (!capability.isSupported) {
    return {
      success: false,
      error: 'Fullscreen is not supported by this browser.',
      reasonCode: 'API_NOT_SUPPORTED'
    };
  }

  if (capability.isIframeRestricted) {
    return {
      success: false,
      error: 'This assessment page must be opened directly in a browser tab.',
      reasonCode: 'IFRAME_RESTRICTED'
    };
  }

  if (!capability.isEnabled) {
    return {
      success: false,
      error: 'Fullscreen is unavailable in this browser or page.',
      reasonCode: 'FULLSCREEN_DISABLED'
    };
  }

  const docEl = document.documentElement as any;

  try {
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen();
    }
  } catch (err: any) {
    console.error('[FULLSCREEN ERROR]', err);
    const raw = String(err?.message || err || '');
    if (
      window.self !== window.top &&
      (raw.includes('Permissions') || raw.includes('feature policy') || raw.includes('disallowed'))
    ) {
      return {
        success: false,
        error: 'This assessment page must be opened directly in a browser tab.',
        reasonCode: 'IFRAME_RESTRICTED'
      };
    }

    return {
      success: false,
      error: err?.message || 'Fullscreen was not activated',
      reasonCode: 'ACTIVATION_ERROR'
    };
  }

  // Verify document.fullscreenElement
  if (!document.fullscreenElement) {
    return {
      success: false,
      error: 'Fullscreen was not activated',
      reasonCode: 'NOT_ACTIVATED'
    };
  }

  return { success: true };
}

/**
 * Safely exits fullscreen if currently active
 */
export async function exitFullscreenDirect(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      const doc = document as any;
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    }
  } catch (err) {
    console.warn('[EXIT FULLSCREEN NON-FATAL]', err);
  }
}
