'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';

// Mobile breakpoint constant
const MOBILE_BREAKPOINT = 768;

// Common interface for tabs
export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface SwipeablePanelsProps {
  tabs: Tab[];
  className?: string;
  defaultTabIndex?: number;
  onTabChange?: (index: number) => void;
}

// Memoized tab buttons component
const TabButtons = React.memo(({ 
  tabs, 
  activeTabIndex, 
  onTabChange 
}: { 
  tabs: Tab[];
  activeTabIndex: number;
  onTabChange: (index: number) => void;
}) => (
  <div className="flex mx-4 gap-6 border-b mb-2">
    {tabs.map((tab, index) => (
      <button
        key={tab.id}
        className={cn(
          "flex-1 transition-all duration-200 relative font-medium text-sm",
          activeTabIndex === index
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onTabChange(index)}
      >
        <span className="relative inline-flex pb-[12px]">
          {tab.label}
          <span className={cn(
            "absolute bottom-0 left-0 w-full h-[.25rem] rounded-full transition-all duration-200",
            activeTabIndex === index ? "bg-primary opacity-100" : "opacity-0"
          )} />
        </span>
      </button>
    ))}
  </div>
));

TabButtons.displayName = 'TabButtons';

export function SwipeablePanels({
  tabs,
  className,
  defaultTabIndex = 0,
  onTabChange
}: SwipeablePanelsProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(defaultTabIndex);
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

  // Initialize Embla carousel with conditional options for mobile vs desktop
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

  // Handle tab change - both from tab clicks and swipe
  const handleTabChange = useCallback((index: number) => {
    setActiveTabIndex(index);
    emblaApi?.scrollTo(index);
    if (onTabChange) {
      onTabChange(index);
    }
  }, [emblaApi, onTabChange]);

  // Sync carousel changes with tabs
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setActiveTabIndex(index);
      if (onTabChange) {
        onTabChange(index);
      }
    };

    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onTabChange]);

  // Prevent browser back/forward navigation when interacting with carousel
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
    
    // Add event listeners
    viewport.addEventListener('touchstart', preventNavigation, { passive: true });
    
    return () => {
      viewport.removeEventListener('touchstart', preventNavigation);
    };
  }, [emblaApi, isMobile]);

  return (
    <div className={cn("w-full", className)}>
      {/* Tab buttons */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md">
        <TabButtons 
          tabs={tabs} 
          activeTabIndex={activeTabIndex} 
          onTabChange={handleTabChange} 
        />
      </div>
      
      {/* Swipeable content */}
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
          {tabs.map((tab, index) => (
            <div 
              key={tab.id}
              className={cn(
                "flex-[0_0_100%] min-w-0",
                !isMobile && activeTabIndex !== index && "hidden" // Hide when not active on desktop
              )}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 