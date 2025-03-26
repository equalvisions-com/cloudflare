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

// Memoized tab content to prevent re-rendering
const TabContent = React.memo(({ 
  tab, 
  isActive,
  isMobile
}: { 
  tab: Tab;
  isActive: boolean;
  isMobile: boolean;
}) => (
  <div 
    className={cn(
      "flex-[0_0_100%] min-w-0 embla-slide",
      !isMobile && !isActive && "hidden" // Hide when not active on desktop
    )}
    style={{ 
      position: 'relative'
    }}
  >
    <div className="embla-slide-content w-full">
      {tab.content}
    </div>
  </div>
));

TabContent.displayName = 'TabContent';

export function SwipeablePanels({
  tabs,
  className,
  defaultTabIndex = 0,
  onTabChange
}: SwipeablePanelsProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(defaultTabIndex);
  const [isMobile, setIsMobile] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const prevActiveTabRef = useRef(defaultTabIndex);
  
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
  // Match settings from CategorySliderWrapper but add crucial settings to prevent bouncing
  const carouselOptions = useMemo(() => 
    isMobile ? {
      align: 'start' as const,
      skipSnaps: false,
      dragFree: false,
      containScroll: 'trimSnaps' as const,
      loop: false,
      duration: 20,
      // Add these critical options to prevent bouncing
      inViewThreshold: 0, 
      dragThreshold: 10, // Higher threshold prevents accidental swipes
      watchDrag: true
    } : { 
      align: 'start' as const,
      skipSnaps: true,
      dragFree: false,
      containScroll: 'keepSnaps' as const,
      active: false // Disable carousel on desktop
    },
    [isMobile]
  );

  // Initialize carousel with appropriate plugins - match CategorySliderWrapper
  const [emblaRef, emblaApi] = useEmblaCarousel(
    carouselOptions,
    isMobile ? [WheelGesturesPlugin(), AutoHeight()] : [AutoHeight()]
  );

  // Scan all slides to ensure proper height calculation
  const scanAllSlides = useCallback(() => {
    if (!emblaApi) return;
    
    // Get current slide
    const currentSlide = emblaApi.selectedScrollSnap();
    
    // Force reinitialization after a short delay to allow content to render
    setTimeout(() => {
      // Reinitialize to recalculate heights
      emblaApi.reInit();
      
      // Scroll back to the original slide without animation
      emblaApi.scrollTo(currentSlide, false);
      
      setIsInitialized(true);
    }, 50);
  }, [emblaApi]);

  // Pre-initialize all tabs' heights
  useEffect(() => {
    if (!emblaApi || isInitialized) return;
    
    // Initial height calculation on first mount
    scanAllSlides();
    
    // Additional height recalculation after a longer delay to ensure all content is loaded
    const delayedReInit = setTimeout(() => {
      if (emblaApi) {
        emblaApi.reInit();
      }
    }, 300);
    
    return () => {
      clearTimeout(delayedReInit);
    };
  }, [emblaApi, scanAllSlides, isInitialized]);

  // Handle tab change - both from tab clicks and swipe
  const handleTabChange = useCallback((index: number) => {
    prevActiveTabRef.current = activeTabIndex;
    setActiveTabIndex(index);
    
    if (emblaApi) {
      // Scroll to target slide with animation
      emblaApi.scrollTo(index, true);
      
      // Force height recalculation after slide change
      setTimeout(() => {
        emblaApi.reInit();
      }, 50);
    }
    
    if (onTabChange) {
      onTabChange(index);
    }
  }, [emblaApi, onTabChange, activeTabIndex]);

  // Sync carousel changes with tabs
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      if (index !== activeTabIndex) {
        prevActiveTabRef.current = activeTabIndex;
        setActiveTabIndex(index);
        
        // Force height recalculation after slide change
        setTimeout(() => {
          emblaApi.reInit();
        }, 50);
        
        if (onTabChange) {
          onTabChange(index);
        }
      }
    };

    emblaApi.on('select', onSelect);
    
    // Initial scroll to ensure proper tab selection (without animation)
    emblaApi.scrollTo(activeTabIndex, false);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onTabChange, activeTabIndex]);

  // Extra effect to handle drag start and stop
  useEffect(() => {
    if (!emblaApi) return;
    
    const onDragStart = () => {
      document.documentElement.classList.add('dragging-active');
    };
    
    const onDragEnd = () => {
      document.documentElement.classList.remove('dragging-active');
    };
    
    emblaApi.on('pointerDown', onDragStart);
    emblaApi.on('pointerUp', onDragEnd);
    
    return () => {
      emblaApi.off('pointerDown', onDragStart);
      emblaApi.off('pointerUp', onDragEnd);
    };
  }, [emblaApi]);

  // Prevent browser back/forward navigation when interacting with carousel
  useEffect(() => {
    if (!emblaApi || !isMobile) return;
    
    const viewport = emblaApi.rootNode();
    if (!viewport) return;
    
    // Prevent ALL horizontal swipe navigation (not just when dragging)
    const preventAllNavigation = (e: TouchEvent) => {
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        // Prevent horizontal scroll (which causes overscroll)
        if (deltaX > deltaY && deltaX > 5) {
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
    
    // Add event listener with passive: false to allow preventDefault
    viewport.addEventListener('touchstart', preventAllNavigation, { passive: false });
    
    return () => {
      viewport.removeEventListener('touchstart', preventAllNavigation);
    };
  }, [emblaApi, isMobile]);

  // Effect to handle resize and reinitialize carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onResize = () => {
      requestAnimationFrame(() => {
        emblaApi.reInit();
      });
    };
    
    window.addEventListener('resize', onResize);
    
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [emblaApi]);

  // Add CSS classes for auto height
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .embla-container-with-auto-height {
        display: flex;
        flex-direction: column;
        min-height: 250px;
        -webkit-overflow-scrolling: touch; /* For iOS smooth scrolling */
      }
      
      .embla-slides-container {
        display: flex;
        align-items: flex-start;
        width: 100%;
        flex: 1;
        will-change: transform; /* Optimize for animations */
      }
      
      .embla-slide {
        flex: 0 0 100%;
        min-width: 0;
        width: 100%;
        height: auto !important;
        overflow: visible;
      }
      
      .embla-slide-content {
        width: 100%;
        height: auto !important;
        overflow: visible !important;
        opacity: 1 !important;
      }
      
      .embla-viewport {
        overflow-x: hidden;
        width: 100%;
        touch-action: pan-y pinch-zoom; /* Better touch behavior */
      }
      
      .prevent-overscroll-navigation {
        overscroll-behavior-x: none;
        -ms-scroll-chaining: none;
        touch-action: pan-y;
        -webkit-overflow-scrolling: touch;
        -webkit-tap-highlight-color: transparent;
      }
      
      /* Prevent overscroll during drag */
      html.dragging-active {
        overscroll-behavior-x: none;
        overflow-x: hidden;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
      
      {/* Swipeable content - with enhanced touch behavior */}
      <div 
        className={cn(
          "overflow-hidden prevent-overscroll-navigation embla-container-with-auto-height embla-viewport",
          !isMobile && "overflow-visible" // Remove overflow hidden on desktop
        )} 
        ref={emblaRef}
        style={{ 
          minHeight: "250px",
          WebkitOverflowScrolling: "touch" // For iOS
        }}
      >
        <div className={cn(
          "flex embla-slides-container",
          !isMobile && "!transform-none" // Prevent transform on desktop
        )}>
          {tabs.map((tab, index) => (
            <TabContent 
              key={tab.id}
              tab={tab}
              isActive={activeTabIndex === index}
              isMobile={isMobile}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 