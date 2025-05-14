import { useEffect } from 'react';

/**
 * Fires `callback()` every time the page is *restored* from the browser
 * Back/Forward-cache (Safari, Chrome, Firefox, iOS, Android ≈ 100 % coverage).
 */
export function useBFCacheRestore(callback: () => void) {
  useEffect(() => {
    // Standard – Chrome/Firefox/Safari ≥16
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) callback();
    };
    // Legacy Safari (pagehide α)
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) callback();
    };
    // Proposed spec – Chrome bfcache discard
    const onVisibility = () => {
      // @ts-ignore old Chrome channel
      if (document.visibilityState === 'visible' && (document as any).wasDiscarded) {
        callback();
      }
    };

    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [callback]);
} 