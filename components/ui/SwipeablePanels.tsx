'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import AutoHeight from 'embla-carousel-auto-height';
import './swipeable-panels.css';

// Mobile breakpoint constant - match the same value used in CategorySliderWrapper
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

// Memoized tab buttons component - follows exact same styling as CategorySliderWrapper
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
  
  // Update isMobile state based on window width - exactly like CategorySliderWrapper
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
  // These are the exact same options used in CategorySliderWrapper
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
    isMobile ? [AutoHeight(), WheelGesturesPlugin()] : [AutoHeight()]
  );

  // Handle tab change - both from tab clicks and swipe - match CategorySliderWrapper behavior
  const handleTabChange = useCallback((index: number) => {
    setActiveTabIndex(index);
    emblaApi?.scrollTo(index);
    if (onTabChange) {
      onTabChange(index);
    }
  }, [emblaApi, onTabChange]);

  // Sync carousel changes with tabs - exactly like CategorySliderWrapper
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
  // This exact same code is used in CategorySliderWrapper
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
    
    // Prevent mousewheel horizontal navigation (for trackpads) - Added to exactly match CategorySliderWrapper
    const preventWheelNavigation = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && emblaApi.internalEngine().dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault - Match exact same event handling as CategorySliderWrapper
    viewport.addEventListener('touchstart', preventNavigation, { passive: true });
    viewport.addEventListener('wheel', preventWheelNavigation, { passive: false });
    
    return () => {
      viewport.removeEventListener('touchstart', preventNavigation);
      viewport.removeEventListener('wheel', preventWheelNavigation);
    };
  }, [emblaApi, isMobile]);

  return (
    <div className={cn("w-full", className)}>
      {/* Tab buttons - match the exact same layout in CategorySliderWrapper */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md">
        <TabButtons 
          tabs={tabs} 
          activeTabIndex={activeTabIndex} 
          onTabChange={handleTabChange} 
        />
      </div>
      
      {/* Swipeable content - use exact same className structure as CategorySliderWrapper */}
      <div 
        className={cn(
          "overflow-hidden prevent-overscroll-navigation embla-container-with-auto-height",
          !isMobile && "overflow-visible" // Remove overflow hidden on desktop
        )} 
        ref={emblaRef}
      >
        <div className={cn(
          "flex embla-slides-container",
          !isMobile && "!transform-none" // Prevent transform on desktop
        )}>
          {tabs.map((tab, index) => (
            <div 
              key={tab.id}
              className={cn(
                "flex-[0_0_100%] min-w-0 embla-slide",
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