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

// Memoized stable content for each tab - ensures content is only rendered once
const StableTabContent = React.memo(({ 
  children 
}: { 
  children: React.ReactNode;
}) => {
  return <>{children}</>;
}, () => true); // Always return true to prevent re-rendering

StableTabContent.displayName = 'StableTabContent';

// Memoized tab content to prevent re-rendering
const TabContent = React.memo(({ 
  tab, 
  isActive,
  isMobile,
  id
}: { 
  tab: Tab;
  isActive: boolean;
  isMobile: boolean;
  id: string;
}) => {
  // Use a reference to track if this tab has been rendered before
  const hasRendered = useRef(false);
  
  // Mark as rendered on first render
  useEffect(() => {
    hasRendered.current = true;
  }, []);
  
  // Only use display:none on desktop to hide inactive tabs
  return (
    <div 
      className={cn(
        "flex-[0_0_100%] min-w-0 embla-slide",
        !isMobile && !isActive && "hidden" // Hide when not active on desktop
      )}
      id={`tab-content-${id}`}
      data-active={isActive ? "true" : "false"}
    >
      <div className="embla-slide-content w-full">
        {/* Wrap tab content in StableTabContent to prevent re-rendering */}
        <StableTabContent>
          {tab.content}
        </StableTabContent>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render when active state changes
  return prevProps.isActive === nextProps.isActive && prevProps.isMobile === nextProps.isMobile;
});

TabContent.displayName = 'TabContent';

export function SwipeablePanels({
  tabs,
  className,
  defaultTabIndex = 0,
  onTabChange
}: SwipeablePanelsProps) {
  // Store rendered tabs in a mutable ref to preserve across renders
  const renderedTabsRef = useRef<Record<string, React.ReactNode>>({});
  
  // Use refs for any values that should not trigger re-renders when they change
  const activeTabIndexRef = useRef(defaultTabIndex);
  const [activeTabIndex, setActiveTabIndex] = useState(defaultTabIndex);
  const [isMobile, setIsMobile] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const prevActiveTabRef = useRef(defaultTabIndex);
  const isDraggingRef = useRef(false);
  
  // Store slide heights separately from embla's auto height
  const slideHeights = useRef<Record<number, number>>({});
  
  // Store scroll positions for each tab
  const scrollPositions = useRef<Record<number, number>>({});
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pre-render all tabs initially to improve switching performance
  useEffect(() => {
    // Cache all tab contents on first render
    tabs.forEach(tab => {
      if (!renderedTabsRef.current[tab.id]) {
        renderedTabsRef.current[tab.id] = tab.content;
      }
    });
  }, [tabs]);
  
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
  // Match settings from CategorySliderWrapper exactly
  const carouselOptions = useMemo(() => 
    isMobile ? {
      align: 'start' as const,
      skipSnaps: false,
      dragFree: true, // Allow free dragging for smoother feel
      containScroll: 'trimSnaps' as const,
      loop: false,
      duration: 10, // Faster duration works better with CSS transitions
      inViewThreshold: 0.7 // Helps with smoother snapping
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

  // Helper function to toggle dragging state
  const setDragging = useCallback((isDragging: boolean) => {
    isDraggingRef.current = isDragging;
    if (containerRef.current) {
      if (isDragging) {
        containerRef.current.classList.add('is-dragging');
        containerRef.current.classList.add('is-animating');
      } else {
        containerRef.current.classList.remove('is-dragging');
        // Keep is-animating a bit longer to ensure smooth transition
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.classList.remove('is-animating');
          }
        }, 300); // Match the CSS transition duration
      }
    }
  }, []);

  // Save scroll position when tab changes
  const saveScrollPosition = useCallback((index: number) => {
    if (typeof window !== 'undefined') {
      scrollPositions.current[index] = window.scrollY;
    }
  }, []);

  // Restore scroll position for a tab
  const restoreScrollPosition = useCallback((index: number) => {
    if (typeof window !== 'undefined') {
      // Use requestAnimationFrame to ensure the scroll happens after the DOM updates
      requestAnimationFrame(() => {
        // Check if we have a saved position for this tab
        if (scrollPositions.current[index] !== undefined) {
          window.scrollTo(0, scrollPositions.current[index]);
        } else {
          // If no saved position, scroll to the top of the content
          if (mainContainerRef.current) {
            const tabTop = mainContainerRef.current.getBoundingClientRect().top + window.scrollY;
            // Add a small offset to account for the tab buttons height
            window.scrollTo(0, tabTop - 60);
          }
        }
      });
    }
  }, []);

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
    
    return () => {};
  }, [emblaApi, scanAllSlides, isInitialized]);

  // Handle tab change - both from tab clicks and swipe
  const handleTabChange = useCallback((index: number) => {
    // Start animation
    setDragging(true);
    
    // Save scroll position of current tab before switching
    saveScrollPosition(activeTabIndexRef.current);
    
    prevActiveTabRef.current = activeTabIndexRef.current;
    activeTabIndexRef.current = index;
    setActiveTabIndex(index);
    
    if (emblaApi) {
      // Scroll to target slide with animation
      emblaApi.scrollTo(index, true);
      
      // Force height recalculation after slide change
      setTimeout(() => {
        emblaApi.reInit();
        // Restore scroll position for the newly active tab
        restoreScrollPosition(index);
      }, 50);
    }
    
    if (onTabChange) {
      onTabChange(index);
    }
  }, [emblaApi, onTabChange, saveScrollPosition, restoreScrollPosition, setDragging]);

  // Sync carousel changes with tabs
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      if (index !== activeTabIndexRef.current) {
        // Start animation
        setDragging(true);
        
        // Save scroll position of current tab before switching
        saveScrollPosition(activeTabIndexRef.current);
        
        prevActiveTabRef.current = activeTabIndexRef.current;
        activeTabIndexRef.current = index;
        setActiveTabIndex(index);
        
        // Force height recalculation after slide change
        setTimeout(() => {
          emblaApi.reInit();
          // Restore scroll position for the newly active tab
          restoreScrollPosition(index);
        }, 50);
        
        if (onTabChange) {
          onTabChange(index);
        }
      }
    };

    emblaApi.on('select', onSelect);
    
    // Initial scroll to ensure proper tab selection (without animation)
    emblaApi.scrollTo(activeTabIndex, false);
    
    // Restore scroll position for the initial tab
    restoreScrollPosition(activeTabIndex);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onTabChange, activeTabIndex, saveScrollPosition, restoreScrollPosition, setDragging]);

  // Ensure height is re-calculated after tab slides
  useEffect(() => {
    if (!emblaApi) return;
    
    // Run this on select to better handle height transition
    const onSelect = () => {
      // Re-initialize to recalculate heights after selection
      setTimeout(() => {
        emblaApi.reInit();
      }, 100);
    };
    
    // Run this on settle to make sure height is final
    const onSettled = () => {
      // Re-initialize to recalculate heights after animation completes
      emblaApi.reInit();
      
      // No longer dragging when settled
      setDragging(false);
    };

    // Listen for both events
    emblaApi.on('select', onSelect);
    emblaApi.on('settle', onSettled);
    
    // Add listener for resize
    const onResize = () => emblaApi.reInit();
    window.addEventListener('resize', onResize);
    
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('settle', onSettled);
      window.removeEventListener('resize', onResize);
    };
  }, [emblaApi, setDragging]);

  // Save scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        // Save current scroll position for the active tab
        scrollPositions.current[activeTabIndexRef.current] = window.scrollY;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);  // Removing activeTabIndex dependency to prevent re-adding listeners

  // Extra effect to handle drag start and stop
  useEffect(() => {
    if (!emblaApi) return;
    
    const onDragStart = () => {
      document.documentElement.classList.add('dragging-active');
      
      // Ensure we are in dragging mode during drag
      setDragging(true);
    };
    
    const onDragEnd = () => {
      document.documentElement.classList.remove('dragging-active');
      
      // Small delay before removing dragging class to allow transitions to start
      setTimeout(() => {
        setDragging(false);
      }, 10);
    };
    
    emblaApi.on('pointerDown', onDragStart);
    emblaApi.on('pointerUp', onDragEnd);
    
    return () => {
      emblaApi.off('pointerDown', onDragStart);
      emblaApi.off('pointerUp', onDragEnd);
    };
  }, [emblaApi, setDragging]);

  // Monitor carousel scroll to set dragging state
  useEffect(() => {
    if (!emblaApi) return;
    
    const onScroll = () => {
      if (!isDraggingRef.current) {
        setDragging(true);
      }
    };
    
    const onSettle = () => {
      // When animation completes - allow CSS transitions to take effect
      setDragging(false);
    };
    
    emblaApi.on('scroll', onScroll);
    emblaApi.on('settle', onSettle);
    
    return () => {
      emblaApi.off('scroll', onScroll);
      emblaApi.off('settle', onSettle);
    };
  }, [emblaApi, setDragging]);

  // Prevent browser back/forward navigation when interacting with carousel
  useEffect(() => {
    if (!emblaApi || !isMobile) return;
    
    const viewport = emblaApi.rootNode();
    if (!viewport) return;
    
    // Match CategorySliderWrapper exact touch handling
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
    
    // Match CategorySliderWrapper behavior for wheel/trackpad
    const preventWheelNavigation = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && emblaApi.internalEngine().dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault - match CategorySliderWrapper exactly
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
        min-height: 50px;
        position: relative;
        -webkit-overflow-scrolling: touch; /* For iOS smooth scrolling */
      }
      
      .embla-slides-container {
        display: flex;
        align-items: flex-start;
        width: 100%;
        flex: 1;
        will-change: transform; /* Optimize for animations */
        transition: transform 300ms cubic-bezier(0.2, 0.0, 0.2, 1) !important;
      }
      
      .is-dragging .embla-slides-container {
        transition: none !important; /* Remove transition during drag for better tracking */
      }
      
      .embla-slide {
        flex: 0 0 100%;
        min-width: 0;
        width: 100%;
        position: relative;
        overflow: visible;
        z-index: 0;
      }
      
      /* Make all slides visible during drag/animation */
      .is-animating .embla-slide {
        opacity: 1 !important;
        visibility: visible !important;
        z-index: 1 !important;
        display: block !important;
      }
      
      /* Active slide should be fully visible */
      .embla-slide[data-active="true"] {
        z-index: 2;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        height: auto !important;
        overflow: visible !important;
        pointer-events: auto !important;
      }
      
      /* Inactive slides should be hidden when not animating */
      .embla-slide[data-active="false"]:not(.is-animating *) {
        height: 0;
        overflow: hidden;
      }
      
      /* Mobile styles - match CategorySliderWrapper exactly */
      @media (max-width: ${MOBILE_BREAKPOINT}px) {
        .embla-slide {
          /* Essential for smooth sliding - don't use display:none during animation */
          position: relative;
          will-change: transform;
        }
                
        /* Slide content should transition smoothly */
        .embla-slide-content {
          width: 100%;
          will-change: transform;
          position: relative;
        }
      }
      
      /* Desktop styles */
      @media (min-width: ${MOBILE_BREAKPOINT + 1}px) {
        /* Hide inactive slides on desktop */
        .embla-slide[data-active="false"]:not(.is-animating *) {
          display: none;
        }
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
    <div className={cn("w-full", className)} ref={mainContainerRef}>
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
          WebkitOverflowScrolling: "touch" // For iOS
        }}
      >
        <div 
          className={cn(
            "flex embla-slides-container relative",
            !isMobile && "!transform-none" // Prevent transform on desktop
          )}
          ref={containerRef}
        >
          {tabs.map((tab, index) => (
            <TabContent 
              key={tab.id}
              tab={tab}
              isActive={activeTabIndex === index}
              isMobile={isMobile}
              id={tab.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 