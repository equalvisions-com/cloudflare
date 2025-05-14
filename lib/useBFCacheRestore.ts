import { useEffect } from 'react';

/**
 * Fires `callback()` every time the page is *restored* from the browser
 * Back/Forward-cache (Safari, Chrome, Firefox, iOS, Android ≈ 100 % coverage).
 */
export function useBFCacheRestore(cb: () => void) {
  useEffect(() => {
    const run = () => cb();
    
    const onShow = (e: PageTransitionEvent) => e.persisted && run();
    window.addEventListener('pageshow', onShow);

    // Chrome "memory-saver" / tab-discard
    const onVis = () => {
      // @ts-ignore wasDiscarded is an experimental property
      if (document.visibilityState === 'visible' && (document as any).wasDiscarded) run();
    };
    document.addEventListener('visibilitychange', onVis);

    // initial restore (Chrome & FF)  
    const navEntry = performance.getEntriesByType?.('navigation')[0];
    if (navEntry && (navEntry as PerformanceNavigationTiming).type === 'back_forward') {
      run();
    }

    return () => {
      window.removeEventListener('pageshow', onShow);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [cb]);
} 