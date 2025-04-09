'use client';

import { useEffect } from 'react';

interface DynamicHeightWrapperProps {
  children: React.ReactNode;
}

export default function DynamicHeightWrapper({ children }: DynamicHeightWrapperProps) {
  useEffect(() => {
    // Function to update CSS variable with current viewport height
    const updateHeight = () => {
      // Set a CSS variable with the viewport height
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };

    // Initial update
    updateHeight();

    // Update on resize and orientation change
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, []);

  return (
    <div className="dynamic-height-container">
      {children}
    </div>
  );
} 