'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';

// Add this constant for mobile detection
const MOBILE_BREAKPOINT = 768;

// Define the props for the SwipeableWrapper component
interface SwipeableWrapperProps {
  children: React.ReactNode; // The content to be wrapped
  className?: string;
}

/**
 * SwipeableWrapper - Adds swipe gesture support to any content
 * This is a simpler version of the tabs component that just enables swiping
 * without actual tabs UI. It's meant to be used with content that already
 * has its own navigation UI.
 */
export function SwipeableWrapper({
  children,
  className,
}: SwipeableWrapperProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Update isMobile state based on window width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize Embla carousel with conditional options
  const carouselOptions = useMemo(() => 
    isMobile ? {
      align: 'start' as const,
      skipSnaps: false,
      dragFree: false,
      containScroll: 'trimSnaps' as const
    } : { 
      align: 'start' as const,
      skipSnaps: true,
      dragFree: false,
      containScroll: 'keepSnaps' as const,
      active: false // Disable carousel on desktop
    },
    [isMobile]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    carouselOptions,
    isMobile ? [WheelGesturesPlugin()] : []
  );

  // Prevent browser back/forward navigation when interacting with the content carousels
  useEffect(() => {
    if (!emblaApi || !isMobile) return;
    
    const viewport = emblaApi.rootNode();
    if (!viewport) return;
    
    // Prevent horizontal swipe navigation only when actually dragging
    const preventNavigation = (e: TouchEvent) => {
      if (!emblaApi.internalEngine().dragHandler.pointerDown()) return;
      
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      const handleTouchMove = (e: TouchEvent) => {
        if (!emblaApi.internalEngine().dragHandler.pointerDown()) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        // Only prevent default if horizontal movement is greater than vertical
        if (deltaX > deltaY) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      const cleanup = () => {
        document.removeEventListener('touchmove', handleTouchMove);
      };
      
      document.addEventListener('touchend', cleanup, { once: true });
      document.addEventListener('touchcancel', cleanup, { once: true });
    };
    
    // Add event listeners with passive: false to allow preventDefault
    viewport.addEventListener('touchstart', preventNavigation, { passive: true });
    
    return () => {
      viewport.removeEventListener('touchstart', preventNavigation);
    };
  }, [emblaApi, isMobile]);

  return (
    <div className={cn("w-full", className)}>
      <div 
        className={cn(
          "overflow-hidden prevent-overscroll-navigation",
          !isMobile && "overflow-visible" // Remove overflow hidden on desktop
        )} 
        ref={emblaRef}
      >
        <div className={cn(
          "flex",
          !isMobile && "!transform-none" // Prevent transform on desktop
        )}>
          <div className="flex-[0_0_100%] min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 