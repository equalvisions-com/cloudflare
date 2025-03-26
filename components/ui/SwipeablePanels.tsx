'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import AutoHeight from 'embla-carousel-auto-height';

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
  const [isInitialized, setIsInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
      containScroll: 'trimSnaps' as const,
      loop: false,
      duration: 10, // Faster than before, matching CategorySliderWrapper
      startIndex: defaultTabIndex
    } : { 
      align: 'start' as const,
      skipSnaps: true,
      dragFree: false,
      containScroll: 'keepSnaps' as const,
      active: false, // Disable carousel on desktop
      startIndex: defaultTabIndex
    },
    [isMobile, defaultTabIndex]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    carouselOptions,
    isMobile ? [WheelGesturesPlugin(), AutoHeight()] : [AutoHeight()]
  );

  // Handle tab change - both from tab clicks and swipe
  const handleTabChange = useCallback((index: number) => {
    setActiveTabIndex(index);
    if (emblaApi) {
      emblaApi.scrollTo(index, true); // Use animation to match CategorySliderWrapper
    }
    if (onTabChange) {
      onTabChange(index);
    }
  }, [emblaApi, onTabChange]);

  // Initial setup and sync carousel changes with tabs
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
    
    if (!isInitialized) {
      // Initial scroll to ensure proper tab selection
      emblaApi.scrollTo(activeTabIndex, false);
      
      // Force a reinitialization to set correct height on start
      setTimeout(() => {
        emblaApi.reInit();
        setIsInitialized(true);
      }, 0);
    }

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onTabChange, activeTabIndex, isInitialized]);

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
    
    // Prevent mousewheel horizontal navigation (for trackpads)
    const preventWheelNavigation = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && emblaApi.internalEngine().dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault
    viewport.addEventListener('touchstart', preventNavigation, { passive: true });
    viewport.addEventListener('wheel', preventWheelNavigation, { passive: false });
    
    return () => {
      viewport.removeEventListener('touchstart', preventNavigation);
      viewport.removeEventListener('wheel', preventWheelNavigation);
    };
  }, [emblaApi, isMobile]);

  // Effect to handle resize and reinitialize carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onResize = () => {
      // Reinitialize Embla on resize with a slight delay
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          emblaApi.reInit();
        });
      }
    };
    
    window.addEventListener('resize', onResize);
    
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [emblaApi]);

  // Preload slides to prevent height issues
  useEffect(() => {
    // Pre-render all tabs in a hidden container to get accurate heights
    const preloadContainer = document.createElement('div');
    preloadContainer.style.position = 'absolute';
    preloadContainer.style.visibility = 'hidden';
    preloadContainer.style.overflow = 'auto';
    preloadContainer.style.height = 'auto';
    preloadContainer.style.width = '100%';
    preloadContainer.style.top = '-9999px';
    
    document.body.appendChild(preloadContainer);
    
    // Force browser to layout the content
    setTimeout(() => {
      document.body.removeChild(preloadContainer);
      
      // Make sure embla is properly initialized with correct heights
      if (emblaApi) {
        emblaApi.reInit();
      }
    }, 50);
    
    return () => {
      if (document.body.contains(preloadContainer)) {
        document.body.removeChild(preloadContainer);
      }
    };
  }, [emblaApi, tabs]);

  // Add CSS classes for auto height
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .embla-container-with-auto-height {
        transition: height 0.2s ease-in-out; /* Faster transition to match CategorySliderWrapper */
        height: auto !important;
        min-height: 200px; /* Minimum height to avoid jumpiness */
      }
      
      .embla-slides-container {
        display: flex;
        align-items: flex-start;
        width: 100%;
      }
      
      .embla-slide {
        flex: 0 0 100%;
        min-width: 0;
        width: 100%;
        height: auto !important; /* Force height auto */
        overflow: visible; /* Ensure content isn't clipped */
        min-height: 200px;
      }
      
      .embla-slide-content {
        overflow: visible !important; /* Force visible overflow */
        height: auto !important; /* Force height auto */
        width: 100%;
        opacity: 1 !important; /* Ensure content is always visible */
        display: block !important; /* Ensure content is always displayed */
      }
      
      /* Prevent flickering during transitions */
      .embla-viewport {
        overflow-x: hidden;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
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
          "overflow-hidden prevent-overscroll-navigation embla-container-with-auto-height embla-viewport",
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
              <div className="embla-slide-content w-full">
                {tab.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 