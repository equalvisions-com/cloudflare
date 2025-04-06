'use client';

import { useEffect } from 'react';

export default function ViewportFix() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleLoad = () => {
        // Check if it's likely a mobile device based on touch capability and screen width
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth < 768; // Adjust breakpoint as needed

        if (isMobile && isSmallScreen) {
            setTimeout(() => {
              // Scroll down 1px then back to 0 to trigger resize
              window.scrollTo(0, 1);
              // Optional: scroll back immediately if the 1px scroll is noticeable
              // requestAnimationFrame(() => { window.scrollTo(0, 0); });
            }, 100); // Delay ensures layout/address bar is likely settled
        }
      };

      // Use 'load' event as it fires after all resources are loaded
      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad, { once: true });
      }

      // Cleanup listener on component unmount
      return () => {
        window.removeEventListener('load', handleLoad);
      };
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return null; // This component doesn't render anything visible
} 