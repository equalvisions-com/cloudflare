'use client';

import { useEffect, useRef } from 'react';

interface DynamicHeightWrapperProps {
  children: React.ReactNode;
}

export default function DynamicHeightWrapper({ children }: DynamicHeightWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setAppHeight = () => {
      if (wrapperRef.current) {
        wrapperRef.current.style.height = `${window.innerHeight}px`;
      }
    };

    // Set height initially
    setAppHeight();

    // Update height on resize and orientation change
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);

    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
    };
  }, []);

  return (
    <div 
      id="app-wrapper" 
      ref={wrapperRef} 
      className="flex flex-col min-h-screen overflow-y-auto"
    >
      {children}
    </div>
  );
} 