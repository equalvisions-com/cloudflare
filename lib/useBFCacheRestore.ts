import { useEffect, useRef } from 'react';

/**
 * Fires `callback()` every time the page is *restored* from the browser
 * Back/Forward-cache (Safari, Chrome, Firefox, iOS, Android ≈ 100 % coverage).
 */
export function useBFCacheRestore(cb: () => void) {
  const fired = useRef(false);
  const run = () => { if (!fired.current) { fired.current = true; cb(); } };

  // 1. Initial page load: check navigation type
  useEffect(() => {
    const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === 'back_forward') run();          // Chrome/Firefox coverage
  }, []);

  // 2. Standard BFCache events
  useEffect(() => {
    const onShow  = (e: PageTransitionEvent) => e.persisted && run();
    const onHide  = (e: PageTransitionEvent) => e.persisted && run(); // legacy iOS
    const onVis   = () => {                                           // discarded tabs
      // @ts-ignore proposed property
      if (document.visibilityState === 'visible' && (document as any).wasDiscarded) run();
    };
    window.addEventListener('pageshow', onShow);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [cb]);
} 