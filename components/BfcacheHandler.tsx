'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function BfcacheHandler() {
  const router = useRouter();

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // Check if the page was restored from bfcache
      if (event.persisted) {
        console.log('Page restored from bfcache, forcing refresh to avoid blank feeds');
        
        // Force a hard refresh to avoid bfcache issues with feeds
        // This ensures feeds are properly reinitialized
        window.location.reload();
      }
    };

    // Listen for pageshow events
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [router]);

  // This component doesn't render anything
  return null;
} 