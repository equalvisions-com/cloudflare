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
    component: React.ComponentType; // No longer expects isActive prop
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Store scroll positions for each tab
  const scrollPositionsRef = useRef<Record<number, number>>({});
  
  // Flag to prevent scroll events during tab switching
  const isRestoringScrollRef = useRef(false);
  
  // Flag to indicate if the current selection change is from an instant jump (click)
  const isInstantJumpRef = useRef(false);
  
  // State to track user interaction (dragging)
  const [isInteracting, setIsInteracting] = useState(false);
  
  // Ref to track the last tab change to prevent duplicate events
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });
  
  // Create memoized component renderers
  const memoizedTabRenderers = useMemo(() => {
    return tabs.map((tab) => {
      // This function is stable across renders
      const TabRenderer = () => { // Removed isActive parameter
        const TabComponent = tab.component;
        return <TabComponent />; // Removed isActive prop
      };
      // Add display name to satisfy the linter
      TabRenderer.displayName = `TabRenderer_${tab.id}`;
      return TabRenderer;
    });
  }, [tabs]); // Only recreate if tabs array changes
  
  // Initialize scroll positions for all tabs to 0
  useEffect(() => {
    tabs.forEach((_, index) => {
      if (scrollPositionsRef.current[index] === undefined) {
        scrollPositionsRef.current[index] = 0;
      }
    });
  }, [tabs]);
  
  // Use the AutoHeight plugin with default options - REMOVED AutoHeight
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]); // Ref to hold slide elements
  const observerRef = useRef<ResizeObserver | null>(null); // Ref to store the observer instance
  const tabHeightsRef = useRef<Record<number, number>>({});
  
  // Add effect to check screen size and update isMobile state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    isMobile 
      ? { 
          loop: false,
          skipSnaps: false,
          startIndex: defaultTabIndex,
          align: 'start',
          containScroll: 'trimSnaps',
          dragFree: false, // Changed back to false for snappier navigation
          duration: animationDuration,
          dragThreshold: 2,
          axis: 'x'
        }
      : {
          loop: false,
          skipSnaps: false,
          startIndex: defaultTabIndex,
          align: 'start',
          containScroll: 'trimSnaps',
          duration: animationDuration,
          axis: 'x',
        }, 
    [
      AutoHeight(),
      ...(isMobile ? [WheelGesturesPlugin()] : [])
    ]
  ); 

  // Disable all touch and pointer events on desktop
  useEffect(() => {
    if (!emblaApi) return;

    const viewportElement = emblaApi.rootNode();
    if (!viewportElement) return;

    const disableAllInteractions = (e: Event) => {
      if (!isMobile) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    if (!isMobile) {
      viewportElement.style.pointerEvents = 'none';
      viewportElement.style.touchAction = 'none';
      viewportElement.addEventListener('pointerdown', disableAllInteractions, { capture: true });
      viewportElement.addEventListener('touchstart', disableAllInteractions, { capture: true });
    } else {
      viewportElement.style.pointerEvents = '';
      viewportElement.style.touchAction = 'pan-y pinch-zoom';
      viewportElement.removeEventListener('pointerdown', disableAllInteractions, { capture: true });
      viewportElement.removeEventListener('touchstart', disableAllInteractions, { capture: true });
    }

    return () => {
      if (viewportElement) {
        viewportElement.removeEventListener('pointerdown', disableAllInteractions, { capture: true });
        viewportElement.removeEventListener('touchstart', disableAllInteractions, { capture: true });
      }
    };
  }, [emblaApi, isMobile]);

  // Save scroll position when user scrolls
  useEffect(() => {
    const handleScroll = () => {
      // Only save scroll position if we're not in the middle of restoring
      if (!isRestoringScrollRef.current) {
        scrollPositionsRef.current[selectedTab] = window.scrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [selectedTab]);

  // Prevent browser back/forward navigation when interacting with the slider
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

  // --- Effect to SETUP the ResizeObserver ---
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
            emblaContainer.style.transition = 'height 200ms ease-out';
            
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
              }, 200); // Match the increased transition duration
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

  // --- Effect to PAUSE/RESUME observer during interaction ---
  useEffect(() => {
    if (!emblaApi || !observerRef) return; // Need emblaApi and the observerRef

    const disableObserver = () => {
        // console.log('Pointer Down: Disconnecting observer'); // Debug log
        observerRef.current?.disconnect();
    };

    const enableObserver = () => {
        // console.log('Pointer Up / Settle: Attempting to reconnect observer'); // Debug log
        if (!emblaApi || !observerRef.current || typeof window === 'undefined') return;

        // Wait a bit before reconnecting to avoid interrupting animation
        setTimeout(() => {
          // Get the CURRENT selected index directly from emblaApi
          const currentSelectedIndex = emblaApi.selectedScrollSnap();
          const activeSlideNode = slideRefs.current[currentSelectedIndex];

          if (activeSlideNode && observerRef.current) {
            // console.log('Reconnecting observer to tab', currentSelectedIndex); // Debug log
            // Ensure we don't observe multiple times if events fire closely
            observerRef.current.disconnect(); 
            observerRef.current.observe(activeSlideNode);
          } else {
            // console.log('Could not find active slide node for index', currentSelectedIndex); // Debug log
          }
        }, 250); // Wait 250ms after settle/pointerUp before re-enabling height adjustment
    };

    // Add listeners
    emblaApi.on('pointerDown', disableObserver);
    emblaApi.on('pointerUp', enableObserver);
    emblaApi.on('settle', enableObserver); // Handles programmatic scrolls and snaps

    // Cleanup listeners
    return () => {
      emblaApi.off('pointerDown', disableObserver);
      emblaApi.off('pointerUp', enableObserver);
      emblaApi.off('settle', enableObserver);
    };
    // Only depends on emblaApi itself, enableObserver has its own logic to find the right node
  }, [emblaApi]);

  // Function to handle tab change with debouncing
  const handleTabChangeWithDebounce = useCallback((index: number) => {
    // Skip if it's the same tab or if the change happened too recently (within 300ms)
    const now = Date.now();
    if (
      index === lastTabChangeRef.current.index || 
      (now - lastTabChangeRef.current.time < 300 && index !== selectedTab)
    ) {
      return;
    }
    
    // Update the last tab change ref
    lastTabChangeRef.current = { index, time: now };
    
    // Call the onTabChange callback if provided
    if (onTabChange) {
      onTabChange(index);
    }
  }, [onTabChange, selectedTab]);
  
  // Function to restore scroll position (always async)
  const restoreScrollPosition = useCallback((index: number) => {
    // Set flag to prevent scroll events during restoration
    isRestoringScrollRef.current = true;
    
    // Get saved position (default to 0 if not set)
    const savedPosition = scrollPositionsRef.current[index] ?? 0;
    
    // Always use requestAnimationFrame for smoothness
    requestAnimationFrame(() => {
      window.scrollTo(0, savedPosition);
      // Reset flag after a short delay
      setTimeout(() => {
        isRestoringScrollRef.current = false;
      }, 100);
    });
  }, []);

  // Handle tab click
  const handleTabClick = useCallback(
    (index: number) => {
      if (!emblaApi || index === selectedTab) return;

      // Save current scroll position before jumping
      scrollPositionsRef.current[selectedTab] = window.scrollY;

      // Signal that the next 'select' event is from an instant jump
      isInstantJumpRef.current = true; 

      // Jump instantly
      emblaApi.scrollTo(index, true);
    },
    [emblaApi, selectedTab]
  );

  // Sync tab selection with carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      
      if (selectedTab !== index) {
        // For non-instant jumps (swipes), save the scroll position
        if (!isInstantJumpRef.current && !isRestoringScrollRef.current) {
          scrollPositionsRef.current[selectedTab] = window.scrollY;
        }

        // Call restoreScrollPosition - it runs async via requestAnimationFrame
        restoreScrollPosition(index); 

        // Reset instant jump flag after restoration starts
        if (isInstantJumpRef.current) {
          isInstantJumpRef.current = false;
        }
        
        // Update state
        setSelectedTab(index);
        handleTabChangeWithDebounce(index);
      }
    };
    
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, selectedTab, handleTabChangeWithDebounce]); 

  // When component mounts, ensure scroll position is at 0 for the initial tab
  useEffect(() => {
    window.scrollTo(0, 0);
    scrollPositionsRef.current[defaultTabIndex] = 0;
  }, [defaultTabIndex]);

  // Add effect to track interaction state, linked to animation completion
  useEffect(() => {
    if (!emblaApi) return;

    // No need to clear timeouts anymore
    // const clearInteractionTimeout = () => { ... };

    const handlePointerDown = () => {
      // clearInteractionTimeout(); -- REMOVED
      setIsInteracting(true);
    };

    // REMOVED scheduleInteractionEnd function
    // const scheduleInteractionEnd = () => { ... };

    // Set interacting to false ONLY when the animation settles
    const handleSettle = () => {
      setIsInteracting(false);
    };

    emblaApi.on('pointerDown', handlePointerDown);
    // No longer need to listen to pointerUp for this logic
    // emblaApi.on('pointerUp', scheduleInteractionEnd);
    emblaApi.on('settle', handleSettle); // Use settle event

    return () => {
      // clearInteractionTimeout(); -- REMOVED
      emblaApi.off('pointerDown', handlePointerDown);
      // emblaApi.off('pointerUp', scheduleInteractionEnd);
      emblaApi.off('settle', handleSettle);
    };
  }, [emblaApi]);

  // Update transition state handling
  useEffect(() => {
    if (!emblaApi) return;

    const handleTransitionStart = () => {
      setIsTransitioning(true);
    };

    const handleTransitionEnd = () => {
      // Add a small delay to ensure smooth transition
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    };

    emblaApi.on('settle', handleTransitionEnd);
    emblaApi.on('select', handleTransitionStart);

    return () => {
      emblaApi.off('settle', handleTransitionEnd);
      emblaApi.off('select', handleTransitionStart);
    };
  }, [emblaApi]);

  return (
    <div 
      className={cn('w-full', className)}
    >
      {/* Tab Headers */}
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTab} 
        onTabClick={handleTabClick} 
      />

      {/* Carousel container is now visible and holds the actual content */}
      <div 
        className={cn(
          "w-full overflow-hidden embla__swipeable_tabs",
          !isMobile && "pointer-events-none" // Disable pointer events on desktop
        )}
        ref={emblaRef}
        style={{ 
          willChange: 'transform',
          WebkitPerspective: '1000',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0,0,0)',
          WebkitOverflowScrolling: 'touch',
          touchAction: isMobile ? 'pan-y pinch-zoom' : 'none' // Adjust touch action based on device
        }}
      >
        <div 
          className="flex items-start"
          style={{
            minHeight: tabHeightsRef.current[selectedTab] ? `${tabHeightsRef.current[selectedTab]}px` : undefined,
            willChange: 'transform',
            WebkitTransform: 'translate3d(0,0,0)',
            WebkitBackfaceVisibility: 'hidden',
            transition: 'transform 0.2s cubic-bezier(0.1, 0, 0.3, 1)'
          }}
        > 
          {tabs.map((tab, index) => {
            const isActive = index === selectedTab;
            
            // Use the memoized renderer for this tab
            const renderTab = memoizedTabRenderers[index];

            return (
              <div 
                key={`carousel-${tab.id}`} 
                className={cn(
                  "min-w-0 flex-[0_0_100%] transform-gpu embla-slide",
                  isTransitioning && "transitioning"
                )}
                ref={(el: HTMLDivElement | null) => { slideRefs.current[index] = el; }} // Correct ref assignment
                aria-hidden={!isActive} // Add aria-hidden for accessibility
                style={{
                  willChange: 'transform, opacity',
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  // Hide inactive tabs instantly during interaction
                  opacity: !isActive && isInteracting ? 0 : 1,
                  transition: 'transform 0.2s cubic-bezier(0.1, 0, 0.3, 1)'
                }}
              >
                {/* The renderer function is stable, only the isActive prop changes */}
                {renderTab()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 