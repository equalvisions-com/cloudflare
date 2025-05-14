'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import AutoHeight from 'embla-carousel-auto-height'; // Re-add AutoHeight
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { useBFCacheRestore } from '@/lib/useBFCacheRestore'; // Moved import to top

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
  return (
    <div className="flex w-full sticky top-0 bg-background/85 backdrop-blur-md z-40 border-b">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(index)}
          className={cn(
            'flex-1 py-3 text-center font-bold text-[15px] transition-colors relative',
            selectedTab === index 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-primary/80'
          )}
          role="tab"
          aria-selected={selectedTab === index}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
        >
          {tab.label}
          
          {/* Indicator directly in the button - only shows for selected tab */}
          {selectedTab === index && (
            <div 
              className="absolute left-0 bottom-[-0.5px] w-full h-[1px] bg-primary transition-all duration-200"
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

// Main SwipeableTabs component implementation
const SwipeableTabsComponent = ({
  tabs,
  defaultTabIndex = 0,
  className,
  animationDuration = 20,
  onTabChange,
}: SwipeableTabsProps) => {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
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
  
  // Refs for slides and observer
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]); // Ref to hold slide elements
  const observerRef = useRef<ResizeObserver | null>(null); // Ref to store the observer instance
  const tabHeightsRef = useRef<Record<number, number>>({});
  
  // session-storage keys
  const KEY_TAB   = 'feed.activeTab';
  const KEY_SCROLL= 'feed.scroll.';

  // restore on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = Number(sessionStorage.getItem(KEY_TAB));
      if (!Number.isNaN(saved)) setSelectedTab(saved);
    }
  }, []);

  // store whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(KEY_TAB, String(selectedTab));
    }
  }, [selectedTab]);

  // wrap your existing scroll save / restore:
  const saveScroll = (idx:number) => {
    if (typeof window !== 'undefined') {
      scrollPositionsRef.current[idx] = window.scrollY;
      sessionStorage.setItem(KEY_SCROLL + idx, String(window.scrollY));
    }
  };
  const loadScroll = (idx:number) => {
    if (typeof window !== 'undefined') {
      return Number(sessionStorage.getItem(KEY_SCROLL + idx)) || 0;
    }
    return 0;
  }
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Function for mobile detection
  const checkMobile = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsMobile(window.innerWidth < 768);
  }, []);
  
  // Memoize carousel options for better performance
  const carouselOptions = useMemo(() => {
    return isMobile 
      ? { 
          loop: false,
          skipSnaps: false,
          startIndex: defaultTabIndex,
          align: 'start' as const,
          containScroll: 'trimSnaps' as const,
          dragFree: false,
          duration: animationDuration,
          dragThreshold: 20,
          axis: 'x' as const,
        }
      : {
          loop: false,
          skipSnaps: false,
          startIndex: defaultTabIndex,
          align: 'start' as const,
          containScroll: 'trimSnaps' as const,
          duration: animationDuration,
          axis: 'x' as const,
        };
  }, [isMobile, defaultTabIndex, animationDuration]);

  // Initialize the Embla carousel with memoized options
  const [emblaRef, emblaApi] = useEmblaCarousel(
    carouselOptions, 
    [
      AutoHeight(),
      ...(isMobile ? [WheelGesturesPlugin()] : [])
    ]
  );
  
  // Memoize the plugins array as well, similar to carouselOptions
  const emblaPlugins = useMemo(() => {
    return [
      AutoHeight(),
      ...(isMobile ? [WheelGesturesPlugin()] : [])
    ];
  }, [isMobile]);
  
  // Memoized function to measure slide heights
  const measureSlideHeights = useCallback(() => {
    if (!isMountedRef.current) return;
    
    slideRefs.current.forEach((slide, index) => {
      if (slide && slide.offsetHeight > 0) {
        tabHeightsRef.current[index] = slide.offsetHeight;
      }
    });
  }, []);
  
  // Function to handle tab change with debouncing
  const handleTabChangeWithDebounce = useCallback((index: number) => {
    if (!isMountedRef.current) return;
    
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
    if (!isMountedRef.current) return;
    
    // Set flag to prevent scroll events during restoration
    isRestoringScrollRef.current = true;
    
    // Get saved position (default to 0 if not set)
    const savedPosition = loadScroll(index);
    
    // Always use requestAnimationFrame for smoothness
    requestAnimationFrame(() => {
      if (!isMountedRef.current) return;
      
      window.scrollTo(0, savedPosition);
      // Reset flag after a short delay
      setTimeout(() => {
        if (!isMountedRef.current) return;
        isRestoringScrollRef.current = false;
      }, 100);
    });
  }, []);
  
  // Handle tab click
  const handleTabClick = useCallback(
    (index: number) => {
      if (!isMountedRef.current) return;
      
      if (!emblaApi || index === selectedTab) return;

      // Save current scroll position before jumping
      saveScroll(selectedTab);

      // Signal that the next 'select' event is from an instant jump
      isInstantJumpRef.current = true; 

      // Jump instantly
      emblaApi.scrollTo(index, true);
    },
    [emblaApi, selectedTab]
  );
  
  // Handlers for transition state
  const handleTransitionStart = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsTransitioning(true);
  }, []);
  
  const handleTransitionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Add a small delay to ensure smooth transition
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsTransitioning(false);
    }, 50);
  }, []);
  
  // Interaction state handlers
  const handlePointerDown = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsInteracting(true);
  }, []);
  
  const handleSettle = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsInteracting(false);
  }, []);
  
  // Observer handlers
  const disableObserver = useCallback(() => {
    if (!isMountedRef.current) return;
    observerRef.current?.disconnect();
  }, []);
  
  const enableObserver = useCallback(() => {
    if (!observerRef.current || typeof window === 'undefined' || !isMountedRef.current) return;
    
    if (!emblaApi) return;

    // Wait a bit before reconnecting to avoid interrupting animation
    setTimeout(() => {
      if (!isMountedRef.current) return;
      
      // Get the CURRENT selected index directly from emblaApi
      const currentSelectedIndex = emblaApi.selectedScrollSnap();
      const activeSlideNode = slideRefs.current[currentSelectedIndex];

      if (activeSlideNode && observerRef.current) {
        // Ensure we don't observe multiple times if events fire closely
        observerRef.current.disconnect(); 
        observerRef.current.observe(activeSlideNode);
      }
    }, 250); // Wait 250ms after settle/pointerUp before re-enabling height adjustment
  }, [emblaApi]);
  
  // Transition handlers for ResizeObserver effect
  const onTransitionStart = useCallback(() => {
    if (!isMountedRef.current) return;
    
    if (!emblaApi) return;
    
    // Apply fixed height to container during animation
    const emblaContainer = emblaApi.containerNode();
    const targetHeight = tabHeightsRef.current[emblaApi.selectedScrollSnap()];
    if (emblaContainer && targetHeight) {
      emblaContainer.style.height = `${targetHeight}px`;
      emblaContainer.style.transition = 'none';
    }
  }, [emblaApi]);
  
  const onTransitionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    
    if (!emblaApi) return;
    
    // After transition completes, let AutoHeight take over again
    const emblaContainer = emblaApi.containerNode();
    if (emblaContainer) {
      setTimeout(() => {
        if (!isMountedRef.current || !emblaContainer) return;
        
        // First, add a smooth transition for height
        emblaContainer.style.transition = 'height 200ms ease-out';
        
        // Get the next tab's height
        const targetHeight = tabHeightsRef.current[emblaApi.selectedScrollSnap()];
        if (targetHeight) {
          // Apply the exact target height with a transition
          emblaContainer.style.height = `${targetHeight}px`;
          
          // After transition completes, remove fixed height and let AutoHeight take over
          setTimeout(() => {
            if (!isMountedRef.current || !emblaContainer) return;
            
            emblaContainer.style.height = '';
            emblaContainer.style.transition = '';
            emblaApi.reInit();
            // Remeasure heights
            measureSlideHeights();
          }, 200); // Match the increased transition duration
        } else {
          // Fallback if height not available
          emblaContainer.style.height = '';
          emblaContainer.style.transition = '';
          emblaApi.reInit();
          // Remeasure heights
          measureSlideHeights();
        }
      }, 50); // Short delay after animation
    }
  }, [emblaApi, measureSlideHeights]);
  
  // Handlers for preventing navigation
  const preventWheelNavigation = useCallback((e: WheelEvent) => {
    if (!isMountedRef.current) return;
    
    if (!emblaApi) return;
    
    const internalEngine = (emblaApi as any).internalEngine?.();
    if (!internalEngine || !internalEngine.dragHandler || !internalEngine.dragHandler.pointerDown?.()) {
      return;
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && internalEngine.dragHandler.pointerDown()) {
      e.preventDefault();
    }
  }, [emblaApi]);
  
  // Create memoized component renderers
  const memoizedTabRenderers = useMemo(() => {
    return tabs.map((tab) => {
      // This function is stable across renders
      const TabRenderer = () => {
        const TabComponent = tab.component;
        return <TabComponent />;
      };
      // Add display name to satisfy the linter
      TabRenderer.displayName = `TabRenderer_${tab.id}`;
      return TabRenderer;
    });
  }, [tabs]); // Only recreate if tabs array changes
  
  // Initialize scroll positions for all tabs to 0
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    tabs.forEach((_, index) => {
      if (scrollPositionsRef.current[index] === undefined) {
        scrollPositionsRef.current[index] = 0;
      }
    });
  }, [tabs]);
  
  // Add effect to check screen size and update isMobile state
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [checkMobile]);

  // Ensure we initialize with the default tab
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;
    
    // This is needed to ensure proper initial selection
    emblaApi.scrollTo(defaultTabIndex, true);
    // Ensure proper selected tab state matches Embla's state
    setSelectedTab(emblaApi.selectedScrollSnap());
  }, [emblaApi, defaultTabIndex]);

  // Disable all touch and pointer events on desktop - REVISED LOGIC
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;

    const viewportElement = emblaApi.rootNode();
    if (!viewportElement) return;

    // ALWAYS allow vertical panning and pinch zoom on the container
    viewportElement.style.touchAction = 'pan-y pinch-zoom';
    
    // Clean up touch-action if needed (though unlikely)
    return () => {
      if (viewportElement) {
        viewportElement.style.touchAction = ''; // Reset on cleanup
      }
    };
  }, [emblaApi, isMobile]); // Keep isMobile dependency for potential future refinements

  // Save scroll position when user scrolls
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const handleScroll = () => {
      // Only save scroll position if we're not in the middle of restoring
      if (!isRestoringScrollRef.current) {
        saveScroll(selectedTab);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [selectedTab]);

  // Prevent browser back/forward navigation when interacting with the slider
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;
    
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
        if (!isMountedRef.current) return;
        
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
  }, [emblaApi, preventWheelNavigation]);

  // --- Effect to SETUP the ResizeObserver ---
  useEffect(() => {
    if (!emblaApi || typeof window === 'undefined' || !isMountedRef.current) return;

    const activeSlideNode = slideRefs.current[selectedTab];
    if (!activeSlideNode) return;

    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let isInTransition = false;
    let delayedReInitTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Call initially
    measureSlideHeights();
    
    // Add transition listeners
    emblaApi.on('settle', onTransitionEnd);
    emblaApi.on('select', onTransitionStart);

    // Create the observer instance
    const resizeObserver = new ResizeObserver(() => {
      if (!isMountedRef.current) return;
      
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        // Wrap reInit in requestAnimationFrame
        window.requestAnimationFrame(() => {
          if (!isMountedRef.current || !emblaApi) return;
          
          // If in transition, delay reInit
          if (isInTransition) {
            // If animating, delay reInit until animation completes with a much longer buffer
            if (delayedReInitTimeout) {
              clearTimeout(delayedReInitTimeout);
            }
            // Use a much longer delay (300ms) to ensure animation is truly complete
            delayedReInitTimeout = setTimeout(() => {
              if (!isMountedRef.current || !emblaApi) return;
              emblaApi.reInit();
            }, 300); // Buffer after animation to prevent visible snapping
          } else {
            emblaApi.reInit();
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
      resizeObserver.disconnect();
      observerRef.current = null; // Clear the ref
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (delayedReInitTimeout) clearTimeout(delayedReInitTimeout);
      emblaApi.off('settle', onTransitionEnd);
      emblaApi.off('select', onTransitionStart);
    };
  }, [emblaApi, selectedTab, animationDuration, measureSlideHeights, onTransitionStart, onTransitionEnd]);

  // --- Effect to PAUSE/RESUME observer during interaction ---
  useEffect(() => {
    if (!emblaApi || !observerRef || !isMountedRef.current) return;

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
  }, [emblaApi, disableObserver, enableObserver]);

  // Sync tab selection with carousel
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;
    
    const onSelect = () => {
      if (!isMountedRef.current) return;
      
      const index = emblaApi.selectedScrollSnap();
      
      if (selectedTab !== index) {
        // For non-instant jumps (swipes), save the scroll position
        if (!isInstantJumpRef.current && !isRestoringScrollRef.current) {
          saveScroll(selectedTab);
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
  }, [emblaApi, selectedTab, handleTabChangeWithDebounce, restoreScrollPosition]);

  // When component mounts, ensure scroll position is at 0 for the initial tab
  useEffect(() => {
    if (!isMountedRef.current || typeof window === 'undefined') return;
    
    window.scrollTo(0, 0);
    scrollPositionsRef.current[defaultTabIndex] = 0;
    if (typeof window !== 'undefined') {
        sessionStorage.setItem(KEY_SCROLL + defaultTabIndex, '0'); // Also save initial scroll to session storage
    }
  }, [defaultTabIndex]);

  // Add effect to track interaction state, linked to animation completion
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;

    emblaApi.on('pointerDown', handlePointerDown);
    emblaApi.on('settle', handleSettle); // Use settle event

    return () => {
      emblaApi.off('pointerDown', handlePointerDown);
      emblaApi.off('settle', handleSettle);
    };
  }, [emblaApi, handlePointerDown, handleSettle]);

  // Update transition state handling
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;

    emblaApi.on('settle', handleTransitionEnd);
    emblaApi.on('select', handleTransitionStart);

    return () => {
      emblaApi.off('settle', handleTransitionEnd);
      emblaApi.off('select', handleTransitionStart);
    };
  }, [emblaApi, handleTransitionStart, handleTransitionEnd]);

  useBFCacheRestore(() => {
    requestAnimationFrame(() => { 
      if (!isMountedRef.current || !emblaApi) return; // Ensure emblaApi exists
      
      // Align sessionStorage with the position Safari actually chose
      if (typeof window !== 'undefined') {
        const currentTabForScrollSync = emblaApi.selectedScrollSnap();
        scrollPositionsRef.current[currentTabForScrollSync] = window.scrollY;
        saveScroll(currentTabForScrollSync); 
      }

      // Re-initialize Embla with its current options and plugins
      emblaApi.reInit(carouselOptions, emblaPlugins);
      
      measureSlideHeights(); // Re-enable this call
    });
  });

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
          "w-full overflow-hidden embla__swipeable_tabs"
        )}
        ref={emblaRef}
        style={{ 
          willChange: 'transform',
          WebkitPerspective: '1000',
          WebkitBackfaceVisibility: 'hidden',
          touchAction: 'pan-y pinch-zoom'
        }}
      >
        <div className="flex items-start"
          style={{
            minHeight: tabHeightsRef.current[selectedTab] ? `${tabHeightsRef.current[selectedTab]}px` : undefined,
            willChange: 'transform',
            transition: isMobile ? `transform ${animationDuration}ms linear` : 'none'
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
                ref={(el: HTMLDivElement | null) => { slideRefs.current[index] = el; }}
                aria-hidden={!isActive}
                style={{
                  willChange: 'transform', 
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  // Hide inactive tabs instantly during interaction
                  opacity: !isActive && isInteracting ? 0 : 1,
                  transition: 'opacity 0s',
                  // Make slide content interactive even on desktop
                  pointerEvents: isActive ? 'auto' : 'none',
                  // Explicitly allow vertical panning on the slide itself
                  touchAction: 'pan-y' 
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
};

// Export memoized component
export const SwipeableTabs = memo(SwipeableTabsComponent); 