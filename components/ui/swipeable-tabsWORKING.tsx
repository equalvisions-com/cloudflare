'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
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
  
  // Removed: isInstantJumpRef - no longer needed with settle-based approach
  
  // State to track user interaction (dragging)
  const [isInteracting, setIsInteracting] = useState(false);
  
  // Ref to track the last tab change to prevent duplicate events
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });
  
  // Add a ref to track the current tab to prevent stale closures
  const currentTabRef = useRef(defaultTabIndex);
  
  // Refs for slides and observer
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]); // Ref to hold slide elements
  const observerRef = useRef<ResizeObserver | null>(null); // Ref to store the observer instance
  const tabHeightsRef = useRef<Record<number, number>>({});
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Keep current tab ref in sync
  useEffect(() => {
    currentTabRef.current = selectedTab;
  }, [selectedTab]);
  
  // Function for mobile detection
  const checkMobile = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsMobile(window.innerWidth < 768);
  }, []);
  
  // Memoize carousel options for better performance
  const carouselOptions = useMemo(() => {
    // Use similar config for both mobile and desktop, but with different drag sensitivity
    const baseConfig = {
      loop: false,
      skipSnaps: false,
      startIndex: defaultTabIndex,
      align: 'start' as const,
      containScroll: 'trimSnaps' as const,
      dragFree: false,
      duration: animationDuration,
      axis: 'x' as const,
    };
    
    return isMobile 
      ? { 
          ...baseConfig,
          dragThreshold: 20, // More sensitive on mobile
        }
      : {
          ...baseConfig,
          dragThreshold: 50, // Less sensitive on desktop, but still enabled
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
  
  // Function to save current scroll position
  const persistCurrentScroll = useCallback(() => {
    if (!isMountedRef.current) return;
    const currentScroll = window.scrollY;
    const currentTab = currentTabRef.current;
    scrollPositionsRef.current[currentTab] = currentScroll;
  }, []);
  
  // Function to restore scroll position (used by handleTabClick)
  const restoreScrollPosition = useCallback((index: number) => {
    if (!isMountedRef.current) return;
    
    // Set flag to prevent scroll events during restoration
    isRestoringScrollRef.current = true;
    
    // Get saved position (default to 0 if not set)
    const savedPosition = scrollPositionsRef.current[index] ?? 0;
    
    // Restore scroll position immediately to prevent flash
    window.scrollTo(0, savedPosition);
    
    // Reset flag after a delay to account for lazy loading and layout changes
    setTimeout(() => {
      if (!isMountedRef.current) return;
      isRestoringScrollRef.current = false;
    }, 600);
  }, []);
  
  // Handle tab click
  const handleTabClick = useCallback(
    (index: number) => {
      if (!isMountedRef.current) return;
      
      if (!emblaApi || index === selectedTab) return;

      // Save current scroll position before jumping
      persistCurrentScroll();

      // Hide content immediately to prevent flash
      setIsContentVisible(false);

      // Update state immediately for instant visual feedback
      const prevIndex = currentTabRef.current;
      currentTabRef.current = index;
      setSelectedTab(index);
      
      // Jump instantly and handle scroll restoration manually since settle might not fire
      emblaApi.scrollTo(index, true);
      
      // Manually trigger what settle would do since instant jumps might not settle
      setTimeout(() => {
        if (!isMountedRef.current) return;
        
        // Get saved position for the new tab
        const savedPosition = scrollPositionsRef.current[index] ?? 0;
        
        // Function to check if scroll position is correct and show content when ready
        const checkScrollPosition = () => {
          if (!isMountedRef.current) return;
          
          // Apply scroll position
          window.scrollTo({
            top: savedPosition,
            left: 0,
            behavior: 'instant'
          });
          
          // Wait a frame to let the scroll settle
          requestAnimationFrame(() => {
            if (!isMountedRef.current) return;
            
            // Check if we're at the correct position after scroll has settled
            const actualPosition = window.scrollY;
            const isCorrectPosition = Math.abs(actualPosition - savedPosition) <= 1; // Stricter tolerance
            
            if (isCorrectPosition) {
              // Wait one more frame to ensure everything is stable
              requestAnimationFrame(() => {
                if (!isMountedRef.current) return;
                
                // Double-check the position is still correct
                const finalPosition = window.scrollY;
                const isFinallyCorrect = Math.abs(finalPosition - savedPosition) <= 1;
                
                if (isFinallyCorrect) {
                  // Show content and clear restoration flag
                  setIsContentVisible(true);
                  isRestoringScrollRef.current = false;
                } else {
                  // Position changed, try again
                  checkScrollPosition();
                }
              });
            } else {
              // Try again on next frame if position is not correct
              requestAnimationFrame(checkScrollPosition);
            }
          });
        };
        
        // Start checking scroll position
        isRestoringScrollRef.current = true;
        requestAnimationFrame(checkScrollPosition);
        
        handleTabChangeWithDebounce(index);
      }, 50); // Small delay to ensure DOM updates
    },
    [emblaApi, selectedTab, persistCurrentScroll, handleTabChangeWithDebounce]
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
  
  // Simplified height management - let AutoHeight handle most of the work
  const onTransitionStart = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsTransitioning(true);
  }, []);

  const onTransitionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    
    if (!emblaApi) return;
    
    // Minimal intervention - just remeasure heights and let AutoHeight work
    setTimeout(() => {
      if (!isMountedRef.current || !emblaApi) return;
      measureSlideHeights();
    }, 50);
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

  // FIXED: Sync with parent's defaultTabIndex changes (controlled component behavior)
  // Only sync when parent's defaultTabIndex changes, not when internal selectedTab changes
  const prevDefaultTabIndexRef = useRef(defaultTabIndex);
  useEffect(() => {
    // Only act if defaultTabIndex prop actually changed (parent-initiated change)
    if (prevDefaultTabIndexRef.current !== defaultTabIndex) {
      prevDefaultTabIndexRef.current = defaultTabIndex;
      
      if (!emblaApi || !isMountedRef.current) return;
      
      // Parent wants to change the active tab - save current scroll first
      if (!isRestoringScrollRef.current) {
        scrollPositionsRef.current[currentTabRef.current] = window.scrollY;
      }
      
      // Update state to match parent
      setSelectedTab(defaultTabIndex);
      currentTabRef.current = defaultTabIndex;
      
      // Scroll to the new tab and restore its position
      emblaApi.scrollTo(defaultTabIndex, true);
      
      // Restore scroll position for the new tab (async)
      if (!isRestoringScrollRef.current) {
        restoreScrollPosition(defaultTabIndex);
      }
    }
  }, [defaultTabIndex, emblaApi, restoreScrollPosition]); // Removed selectedTab dependency

  // Disable all touch and pointer events on desktop - REVISED LOGIC
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;

    const viewportElement = emblaApi.rootNode();
    if (!viewportElement) return;

    // Allow both horizontal and vertical panning, plus pinch zoom
    viewportElement.style.touchAction = 'pan-x pan-y pinch-zoom';
    
    // Clean up touch-action if needed (though unlikely)
    return () => {
      if (viewportElement) {
        viewportElement.style.touchAction = ''; // Reset on cleanup
      }
    };
  }, [emblaApi, isMobile]); // Keep isMobile dependency for potential future refinements

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

  // --- Effect to SETUP the ResizeObserver --- (simplified)
  useEffect(() => {
    if (!emblaApi || typeof window === 'undefined' || !isMountedRef.current) return;

    const activeSlideNode = slideRefs.current[selectedTab];
    if (!activeSlideNode) return;

    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Call initially
    measureSlideHeights();

    // Create the observer instance (simplified - removed complex reInit logic)
    const resizeObserver = new ResizeObserver(() => {
      if (!isMountedRef.current) return;
      
      // Don't trigger reInit during scroll restoration to prevent blinks
      if (isRestoringScrollRef.current) {
        return;
      }
      
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        if (!isMountedRef.current || !emblaApi) return;
        
        // Double-check we're not in restoration mode
        if (isRestoringScrollRef.current) {
          return;
        }
        // Simple reInit without complex transition handling
        emblaApi.reInit();
        measureSlideHeights();
      }, 250);
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
    };
  }, [emblaApi, selectedTab, measureSlideHeights]);

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

  // State to track content visibility during scroll restoration
  const [isContentVisible, setIsContentVisible] = useState(true);
  
  // FIXED: Use 'select' event since 'settle' doesn't fire reliably for swipes
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;
    
    const onSelect = () => {
      if (!isMountedRef.current) return;
      
      const newIndex = emblaApi.selectedScrollSnap();
      const prevIndex = currentTabRef.current;
      
      // Save scroll position of the previous tab before changing
      if (newIndex !== prevIndex) {
        persistCurrentScroll();
        currentTabRef.current = newIndex;
        
        // Handle tab change callback with slight delay to avoid rapid firing
        setTimeout(() => {
          if (!isMountedRef.current) return;
          handleTabChangeWithDebounce(newIndex);
        }, 50);
      }
      
      // Get saved position for the new tab
      const savedPosition = scrollPositionsRef.current[newIndex] ?? 0;
      
      // Set flag to prevent scroll events during restoration
      isRestoringScrollRef.current = true;
      
      // Hide content immediately to prevent flash
      setIsContentVisible(false);
      
      // Update state first to trigger content rendering
      if (selectedTab !== newIndex) {
        setSelectedTab(newIndex);
      }
      
      // Function to check if scroll position is correct and show content when ready
      const checkScrollPosition = () => {
        if (!isMountedRef.current) return;
        
        // Apply scroll position
        window.scrollTo({
          top: savedPosition,
          left: 0,
          behavior: 'instant'
        });
        
        // Wait a frame to let the scroll settle
        requestAnimationFrame(() => {
          if (!isMountedRef.current) return;
          
          // Check if we're at the correct position after scroll has settled
          const actualPosition = window.scrollY;
          const isCorrectPosition = Math.abs(actualPosition - savedPosition) <= 1; // Stricter tolerance
          
          if (isCorrectPosition) {
            // Wait one more frame to ensure everything is stable
            requestAnimationFrame(() => {
              if (!isMountedRef.current) return;
              
              // Double-check the position is still correct
              const finalPosition = window.scrollY;
              const isFinallyCorrect = Math.abs(finalPosition - savedPosition) <= 1;
              
              if (isFinallyCorrect) {
                // Wait for interaction to completely finish before showing content
                setTimeout(() => {
                  if (!isMountedRef.current) return;
                  // Show content and clear restoration flag
                  setIsContentVisible(true);
                  isRestoringScrollRef.current = false;
                }, 16); // One frame delay to ensure settle event has fired
              } else {
                // Position changed, try again
                checkScrollPosition();
              }
            });
          } else {
            // Try again on next frame if position is not correct
            requestAnimationFrame(checkScrollPosition);
          }
        });
      };
      
      // Start checking scroll position after a brief delay for layout
      requestAnimationFrame(() => {
        requestAnimationFrame(checkScrollPosition);
      });
    };
    
    // Use 'select' event since settle doesn't fire reliably
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, persistCurrentScroll, handleTabChangeWithDebounce, selectedTab]);

  // When component mounts, ensure scroll position is at 0 for the initial tab (only once)
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Only scroll to 0 on the very first mount, not on defaultTabIndex changes
    window.scrollTo(0, 0);
    scrollPositionsRef.current[defaultTabIndex] = 0;
  }, []); // Empty dependency array - only run once

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

  // SIMPLIFIED: Update transition state handling (removed complex height locking)
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;

    emblaApi.on('settle', handleTransitionEnd);
    emblaApi.on('select', handleTransitionStart);

    return () => {
      emblaApi.off('settle', handleTransitionEnd);
      emblaApi.off('select', handleTransitionStart);
    };
  }, [emblaApi, handleTransitionStart, handleTransitionEnd]);

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
          // Add class to freeze all animations during scroll restoration
          !isContentVisible && "freeze-animations"
        )}
        ref={emblaRef}
        style={{ 
          willChange: !isContentVisible ? 'auto' : 'transform',
          WebkitPerspective: '1000',
          WebkitBackfaceVisibility: 'hidden',
          touchAction: 'pan-x pan-y pinch-zoom' // Allow horizontal swiping
        }}
      >
        <div className={cn(
          "flex items-start",
          !isContentVisible && "freeze-animations"
        )}
          style={{
            minHeight: tabHeightsRef.current[selectedTab] ? `${tabHeightsRef.current[selectedTab]}px` : undefined,
            willChange: !isContentVisible ? 'auto' : 'transform'
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
                  willChange: !isContentVisible ? 'auto' : 'transform', 
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  // Simple opacity control: hide only during interaction OR content restoration
                  opacity: (!isActive && isInteracting) || !isContentVisible ? 0 : 1,
                  transition: 'none', // No transitions to prevent blinking
                  // Pointer events control: disable during restoration or for inactive tabs
                  pointerEvents: !isContentVisible || !isActive ? 'none' : 'auto',
                  // Allow both horizontal and vertical panning on slides
                  touchAction: 'pan-x pan-y' 
                }}
              >
                {/* Always render all tabs to preserve scroll context */}
                <div style={{
                  position: isActive ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  pointerEvents: isActive ? 'auto' : 'none',
                  zIndex: isActive ? 1 : -1
                }}>
                  {renderTab()}
                </div>
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