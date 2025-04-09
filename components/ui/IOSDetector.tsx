"use client";

import { useEffect } from "react";

/**
 * IOSDetector - Detects iOS Chrome and adds appropriate class to the HTML element
 * to trigger specific CSS fixes
 */
export function IOSDetector() {
  useEffect(() => {
    // Check if we're on iOS Chrome
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isChrome = /CriOS/.test(navigator.userAgent);
    
    if (isIOS && isChrome) {
      // Add class to html element to trigger CSS
      document.documentElement.classList.add('ios-chrome');
      
      // Force content to recalculate on orientation changes
      const handleOrientationChange = () => {
        // Set timeout to ensure the browser has completed any UI adjustments
        setTimeout(() => {
          // Force height recalculation
          document.body.style.height = `${window.innerHeight}px`;
          
          // Trigger a small resize to force recalculation
          window.dispatchEvent(new Event('resize'));
        }, 300);
      };
      
      window.addEventListener('orientationchange', handleOrientationChange);
      
      // Also force recalculation when keyboard appears/disappears
      window.addEventListener('resize', () => {
        document.body.style.height = `${window.innerHeight}px`;
      });
      
      return () => {
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
  }, []);

  return null; // Render nothing
} 