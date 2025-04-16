'use client';

import { useEffect } from 'react';

/**
 * This component fixes the mobile browser viewport height issues, especially in iOS
 * where the browser address bar can collapse or expand, causing layout issues.
 * 
 * It updates CSS variables --vh and --app-height that can be used for height calculations.
 */
export default function ViewportHeightFix() {
  useEffect(() => {
    // Update the app-height variable to match the inner height of the window
    const updateHeight = () => {
      // Get the viewport height
      const vh = window.innerHeight * 0.01;
      // Set the --vh variable in CSS
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      // Set the app height to 100 viewport heights
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    // Call the function to set the height initially
    updateHeight();

    // Update the height on resize and orientation change
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);

    // Handle iOS Safari address bar collapse/expand which doesn't trigger resize
    window.addEventListener('scroll', updateHeight);

    // Cleanup the event listeners when the component unmounts
    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('scroll', updateHeight);
    };
  }, []);

  // This component doesn't render anything
  return null;
} 