'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import AutoHeight from 'embla-carousel-auto-height'; // Re-add AutoHeight
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';

interface SwipeableTabsProps {
  tabs: {
    id: string;
    label: string;
    component: React.ComponentType<{ isActive: boolean }>; // Expect a component type
  }[];
  defaultTabIndex?: number;
  className?: string;
  animationDuration?: number; // Animation duration in milliseconds
  onTabChange?: (index: number) => void; // Callback when tab changes
}

// Memoized tab header component to prevent re-renders
const TabHeaders = React.memo(({ 
  tabs, 
  selectedTab, 
  onTabClick 
}: { 
  tabs: SwipeableTabsProps['tabs'], 
  selectedTab: number, 
  onTabClick: (index: number) => void 
}) => {
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [, forceUpdate] = useState({});

  // Force re-render when selected tab changes to ensure indicator width updates
  useEffect(() => {
    forceUpdate({});
  }, [selectedTab]);

  return (
    <div className="flex w-full sticky top-0 bg-background/85 backdrop-blur-md z-50 border-b">
      
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(index)}
          className={cn(
            'flex-1 py-3 text-center font-bold text-sm relative transition-colors',
            selectedTab === index 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-primary/80'
          )}
          role="tab"
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
        >
          <span ref={(el) => { labelRefs.current[index] = el; }}>{tab.label}</span>
          {selectedTab === index && (
            <div 
              className="absolute bottom-0 h-1 bg-primary rounded-full" 
              style={{ 
                width: labelRefs.current[index]?.offsetWidth || 'auto',
                left: '50%',
                transform: 'translateX(-50%)'
              }} 
            />
          )}
        </button>
      ))}
    </div>
  );
});
TabHeaders.displayName = 'TabHeaders';

// Memoized tab content component to prevent re-renders
const TabContent = React.memo(({ 
  content, 
  isActive,
  id
}: { 
  content: React.ReactNode, 
  isActive: boolean,
  id: string
}) => {
  return (
    <div 
      id={`tab-content-${id}`}
      className={cn(
        "w-full tab-content", 
        { 
          "tab-content-active": isActive,
          "tab-content-inactive": !isActive
        }
      )}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
    >
      {content}
    </div>
  );
});
TabContent.displayName = 'TabContent';

export function SwipeableTabs({
  tabs,
  defaultTabIndex = 0,
  className,
  animationDuration = 400, // Increase default duration for slower animation
  onTabChange,
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const scrollPositionsRef = useRef<Record<number, number>>({});
  const isRestoringScrollRef = useRef(false);
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });
  const [isDragging, setIsDragging] = useState(false);
  const nextSlideRef = useRef<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<ResizeObserver | null>(null);
  const tabHeightsRef = useRef<Record<number, number>>({});

  // Initialize Embla first, as other hooks depend on emblaApi
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    skipSnaps: false,
    startIndex: defaultTabIndex,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    duration: 20,
  }, [AutoHeight()]);

  // --- Functions --- (Define these before useEffect hooks that use them)

  const restoreScrollPosition = useCallback((index: number) => {
    isRestoringScrollRef.current = true;
    const savedPosition = scrollPositionsRef.current[index] ?? 0;
    requestAnimationFrame(() => {
      window.scrollTo(0, savedPosition);
      setTimeout(() => { isRestoringScrollRef.current = false; }, 200);
    });
  }, []);

  const handleTabChangeWithDebounce = useCallback((index: number) => {
    const now = Date.now();
    if (
      index === lastTabChangeRef.current.index || 
      (now - lastTabChangeRef.current.time < 300 && index !== selectedTab)
    ) {
      return;
    }
    lastTabChangeRef.current = { index, time: now };
    if (onTabChange) { onTabChange(index); }
  }, [onTabChange, selectedTab]);

  const handleTabClick = useCallback(
    (index: number) => {
      if (!emblaApi || index === selectedTab) return;
      emblaApi.scrollTo(index, true);
      setSelectedTab(index);
      handleTabChangeWithDebounce(index);
      restoreScrollPosition(index); 
    },
    [emblaApi, selectedTab, handleTabChangeWithDebounce, restoreScrollPosition]
  );

  // --- Memoized Renderers ---
  const memoizedTabRenderers = useMemo(() => {
    return tabs.map((tab) => {
      // This function is stable across renders
      const TabRenderer = (isActive: boolean) => {
        const TabComponent = tab.component;
        return <TabComponent isActive={isActive} />;
      };
      // Add display name to satisfy the linter
      TabRenderer.displayName = `TabRenderer_${tab.id}`;
      return TabRenderer;
    });
  }, [tabs]); // Only recreate if tabs array changes
  
  // --- Effects ---

  // Initialize scroll positions
  useEffect(() => {
    tabs.forEach((_, index) => {
      if (scrollPositionsRef.current[index] === undefined) {
        scrollPositionsRef.current[index] = 0;
      }
    });
  }, [tabs]);
  
  // Save scroll position on global scroll
  useEffect(() => {
    const handleScroll = () => {
      // Only save scroll position if NOT currently restoring scroll (which now also covers transition)
      // AND NOT currently dragging
      if (!isRestoringScrollRef.current && !isDragging) { 
        scrollPositionsRef.current[selectedTab] = window.scrollY;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedTab, isDragging]); // Dependency remains correct

  // Prevent browser navigation gestures
  useEffect(() => {
    if (!emblaApi) return;
    
    const viewportElement = emblaApi.rootNode();
    if (!viewportElement) return;
    
    // Prevent horizontal swipe navigation only when actually dragging
    const preventNavigation = (e: TouchEvent) => {
      // Check if the drag handler exists and pointer is down
      const internalEngine = (emblaApi as any).internalEngine?.();
      if (!internalEngine || !internalEngine.dragHandler || !internalEngine.dragHandler.pointerDown?.()) {
         return;
      }

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      const handleTouchMove = (e: TouchEvent) => {
        const internalEngine = (emblaApi as any).internalEngine?.();
         if (!internalEngine || !internalEngine.dragHandler || !internalEngine.dragHandler.pointerDown?.()) {
           return;
        }
        
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
      const internalEngine = (emblaApi as any).internalEngine?.();
       if (!internalEngine || !internalEngine.dragHandler || !internalEngine.dragHandler.pointerDown?.()) {
         return;
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && internalEngine.dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault
    viewportElement.addEventListener('touchstart', preventNavigation, { passive: true });
    // Conditionally add wheel listener if WheelGesturesPlugin is used
    if (emblaApi.plugins()?.wheelGestures) {
       viewportElement.addEventListener('wheel', preventWheelNavigation, { passive: false });
    }
    
    return () => {
      viewportElement.removeEventListener('touchstart', preventNavigation);
      if (emblaApi.plugins()?.wheelGestures) {
         viewportElement.removeEventListener('wheel', preventWheelNavigation);
      }
    };
  }, [emblaApi]);

  // Resize Observer setup
  useEffect(() => {
    if (!emblaApi || typeof window === 'undefined') return;

    const activeSlideNode = slideRefs.current[selectedTab];
    if (!activeSlideNode) return;

    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let isInTransition = false;
    let delayedReInitTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Pre-measure slide heights to avoid layout shifts during animation
    const measureSlideHeights = () => {
      slideRefs.current.forEach((slide, index) => {
        if (slide && slide.offsetHeight > 0) {
          tabHeightsRef.current[index] = slide.offsetHeight;
        }
      });
    };
    
    // Call initially
    measureSlideHeights();
    
    // Function to track transition state
    const onTransitionStart = () => {
      isInTransition = true;
      
      // Apply fixed height to container during animation
      const emblaContainer = emblaApi.containerNode();
      const targetHeight = tabHeightsRef.current[emblaApi.selectedScrollSnap()];
      if (emblaContainer && targetHeight) {
        emblaContainer.style.height = `${targetHeight}px`;
        emblaContainer.style.transition = 'none';
      }
      
      // Clear any pending reInit when a new transition starts
      if (delayedReInitTimeout) {
        clearTimeout(delayedReInitTimeout);
        delayedReInitTimeout = null;
      }
    };
    
    const onTransitionEnd = () => {
      isInTransition = false;
      
      // After transition completes, let AutoHeight take over again
      const emblaContainer = emblaApi.containerNode();
      if (emblaContainer) {
        setTimeout(() => {
          if (emblaContainer) {
            // First, add a smooth transition for height
            emblaContainer.style.transition = 'height 150ms ease-out';
            
            // Get the next tab's height
            const targetHeight = tabHeightsRef.current[emblaApi.selectedScrollSnap()];
            if (targetHeight) {
              // Apply the exact target height with a transition
              emblaContainer.style.height = `${targetHeight}px`;
              
              // After transition completes, remove fixed height and let AutoHeight take over
      setTimeout(() => {
                if (emblaContainer) {
                  emblaContainer.style.height = '';
                  emblaContainer.style.transition = '';
                  emblaApi.reInit();
                  // Remeasure heights
                  measureSlideHeights();
                }
              }, 150); // Match the transition duration
            } else {
              // Fallback if height not available
              emblaContainer.style.height = '';
              emblaContainer.style.transition = '';
              emblaApi.reInit();
              // Remeasure heights
              measureSlideHeights();
            }
          }
        }, 50); // Short delay after animation
      }
    };
    
    // Add transition listeners
    emblaApi.on('settle', onTransitionEnd);
    emblaApi.on('select', onTransitionStart);

    // Create the observer instance
    const resizeObserver = new ResizeObserver(() => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        // Wrap reInit in requestAnimationFrame
        window.requestAnimationFrame(() => {
          if (emblaApi) {
            // If in transition, delay reInit
            if (isInTransition) {
              // If animating, delay reInit until animation completes with a much longer buffer
              if (delayedReInitTimeout) {
                clearTimeout(delayedReInitTimeout);
              }
              // Use a much longer delay (300ms) to ensure animation is truly complete
              delayedReInitTimeout = setTimeout(() => {
                if (emblaApi) emblaApi.reInit();
              }, 300); // Buffer after animation to prevent visible snapping
            } else {
              emblaApi.reInit();
            }
          }
        });
      }, 250); // Slightly longer debounce
    });

    // Observe the initially active node
    resizeObserver.observe(activeSlideNode);
    // Store the instance
    observerRef.current = resizeObserver;

    // Cleanup: disconnect the observer when tab changes or component unmounts
    return () => {
      // console.log('Disconnecting observer for tab', selectedTab); // Debug log
      resizeObserver.disconnect();
      observerRef.current = null; // Clear the ref
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (delayedReInitTimeout) clearTimeout(delayedReInitTimeout);
      emblaApi.off('settle', onTransitionEnd);
      emblaApi.off('select', onTransitionStart);
    };
  }, [emblaApi, selectedTab, animationDuration]); // Dependency on selectedTab ensures it observes the correct initial node

  // Pause/Resume observer and handle scroll restoration on settle/pointerUp
  useEffect(() => {
    if (!emblaApi || !observerRef) return; 

    const disableObserver = () => {
      observerRef.current?.disconnect();
      setIsDragging(true);
      tabs.forEach((_, index) => {
        scrollPositionsRef.current[index] = scrollPositionsRef.current[index] || 0;
      });
    };

    const enableObserver = (eventType: 'pointerUp' | 'settle') => {
        if (!emblaApi || !observerRef.current || typeof window === 'undefined') return;

        const currentSelectedIndex = emblaApi.selectedScrollSnap();

        // If the event is 'settle', the animation is complete.
        // Restore scroll position AFTER A SLIGHT DELAY to allow content (Virtuoso) to render.
        if (eventType === 'settle') {
            setTimeout(() => {
                // Check emblaApi still exists in case of rapid unmount
                if (emblaApi) {
                  restoreScrollPosition(currentSelectedIndex);
                }
            }, 50); // Short delay (50ms) for Virtuoso to potentially catch up
        }

        // Handle drag state ONLY on pointerUp
        if (eventType === 'pointerUp') {
            setIsDragging(false);
            nextSlideRef.current = null;
        }
        
        // Delay ONLY the observer reconnection (keep this separate)
        setTimeout(() => {
          if (!emblaApi || !observerRef.current) return; 
          const activeSlideNode = slideRefs.current[currentSelectedIndex];
          if (activeSlideNode) {
            observerRef.current.disconnect(); 
            observerRef.current.observe(activeSlideNode);
          }
        }, 250); // Keep delay for observer reconnection
    };

    const handlePointerUp = () => enableObserver('pointerUp');
    const handleSettle = () => enableObserver('settle');

    emblaApi.on('pointerDown', disableObserver);
    emblaApi.on('pointerUp', handlePointerUp);
    emblaApi.on('settle', handleSettle); 

    return () => {
      emblaApi.off('pointerDown', disableObserver);
      emblaApi.off('pointerUp', handlePointerUp);
      emblaApi.off('settle', handleSettle);
    };
  }, [emblaApi, tabs, restoreScrollPosition]); // Added restoreScrollPosition
  
  // Sync tab state with carousel selection
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      const previousIndex = selectedTab;
      if (previousIndex !== index) {
        // --- Start of Transition --- 
        // Set flag to disable global scroll listener saving during transition/restore
        isRestoringScrollRef.current = true; 
        
        setSelectedTab(index);
        handleTabChangeWithDebounce(index);
      }
    };
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, selectedTab, handleTabChangeWithDebounce]);

  // Initial scroll position on mount
  useEffect(() => {
    window.scrollTo(0, 0);
    scrollPositionsRef.current[defaultTabIndex] = 0;
  }, [defaultTabIndex]);

  // --- Return JSX ---
  return (
    <div 
      className={cn('w-full', className)}
    >
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTab} 
        onTabClick={handleTabClick} 
      />
      {/* Carousel container is now visible and holds the actual content */}
      <div 
        className="w-full overflow-hidden embla__swipeable_tabs" // Make container visible, remove h-0
        ref={emblaRef}
        style={{ 
          willChange: 'transform',
          WebkitPerspective: '1000',
          WebkitBackfaceVisibility: 'hidden'
        }}
      >
        <div className="flex items-start"
          style={{
            minHeight: tabHeightsRef.current[selectedTab] ? `${tabHeightsRef.current[selectedTab]}px` : undefined
          }}
        > 
          {tabs.map((tab, index) => {
            const isActive = index === selectedTab;
            // Determine if this is the slide we're transitioning to
            const isNextSlide = isDragging && nextSlideRef.current === index;
            
            // Use the memoized renderer for this tab
            const renderTab = memoizedTabRenderers[index];

            return (
            <div 
              key={`carousel-${tab.id}`} 
                className="min-w-0 flex-[0_0_100%] transform-gpu" 
                ref={(el: HTMLDivElement | null) => { slideRefs.current[index] = el; }}
                aria-hidden={!isActive}
                style={{ 
                  willChange: 'transform', 
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  // Simple toggle with no transition
                  opacity: isDragging && !isActive ? 0 : 1
                }}
              >
                {/* The renderer function is stable, only the isActive prop changes */}
                {renderTab(isActive)}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 