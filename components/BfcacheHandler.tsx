'use client';

import { useEffect } from 'react';

export function BfcacheHandler() {
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // Check if the page was restored from bfcache
      if (event.persisted) {
        console.log('Page restored from bfcache, triggering feed reinitialization');
        
        // Instead of forcing a reload, dispatch a custom event
        // that feed components can listen to for reinitialization
        window.dispatchEvent(new CustomEvent('bfcache-restore', {
          detail: { timestamp: Date.now() }
        }));
      }
    };

    // Listen for pageshow events
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // This component doesn't render anything
  return null;
} 