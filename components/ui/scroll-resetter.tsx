'use client';

import { useEffect } from 'react';

interface ScrollResetterProps {
  children: React.ReactNode;
}

export function ScrollResetter({ children }: ScrollResetterProps) {
  useEffect(() => {
    // Only reset scroll position on initial page load/refresh
    // Use a small timeout to ensure it works after browser's automatic scroll restoration
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);
    
    // Disable browser's automatic scroll restoration on refresh
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    return () => clearTimeout(timer);
  }, []); // Empty dependency array ensures this only runs once on mount
  
  return <>{children}</>;
} 