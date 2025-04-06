'use client';

import { useEffect } from 'react';

export function ViewportHandler() {
  useEffect(() => {
    // Initial set
    setViewportHeight();
    
    // Update on resize
    window.addEventListener('resize', setViewportHeight);
    
    // Update on orientation change (important for mobile)
    window.addEventListener('orientationchange', setViewportHeight);
    
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);
  
  function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  return null; // This component doesn't render anything
} 