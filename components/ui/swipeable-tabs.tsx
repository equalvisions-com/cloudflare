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
  // Add state to track dragging
  const [isDragging, setIsDragging] = useState(false);
  
  // Store scroll positions for each tab
  const scrollPositionsRef = useRef<Record<number, number>>({});
  
  // Flag to prevent scroll events during tab switching
  const isRestoringScrollRef = useRef(false);
  
  // Ref to hold the scroll position during transitions to "lock" it
  const transitionScrollLockRef = useRef<number | null>(null);
  
  // Ref to track if we've already pre-scrolled a target during the current drag
  const preScrolledIndexRef = useRef<number>(-1); 
  
  // Ref to track the last tab change to prevent duplicate events
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });
  
  // Create memoized component renderers
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
  
  // Add refs for content wrappers to manage visibility during scroll restoration
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  
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
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    skipSnaps: false,
    startIndex: defaultTabIndex,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    duration: 20, // Fast but smooth scroll like CategorySliderWrapper
  }, [AutoHeight()]); // Re-add AutoHeight plugin

  // Save scroll position when user scrolls
  useEffect(() => {
    const handleScroll = () => {
      // Only save scroll position if:
      // 1. We are NOT currently restoring scroll programmatically.
      // 2. We are NOT actively locking the scroll during a transition.
      if (!isRestoringScrollRef.current && transitionScrollLockRef.current === null) {
        scrollPositionsRef.current[selectedTab] = window.scrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [selectedTab]); // Depend only on selectedTab, refs don't need to be dependencies

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

  // Handle tab click - PRE-SCROLL before animating and LOCK scroll
  const handleTabClick = useCallback(
    (index: number) => {
      if (!emblaApi || index === selectedTab) return;
      
      // 1. Save current scroll position for the outgoing tab
      const outgoingScrollY = window.scrollY;
      if (!isRestoringScrollRef.current) {
        scrollPositionsRef.current[selectedTab] = outgoingScrollY;
      }
      
      // 2. Set the scroll lock position
      transitionScrollLockRef.current = outgoingScrollY;

      // 3. Get target scroll position for the incoming tab
      const targetScrollPosition = scrollPositionsRef.current[index] ?? 0;

      // 4. Set flag and IMMEDIATELY scroll to the target position BEFORE embla scrolls
      isRestoringScrollRef.current = true;
      window.scrollTo(0, targetScrollPosition);
      
      // 5. Tell Embla to scroll to the new tab (animation starts here)
      emblaApi.scrollTo(index, false);
      
      // 6. Update selected tab state 
      setSelectedTab(index); 
      
      // 7. Handle tab change callback
      handleTabChangeWithDebounce(index);
      
      // 8. Reset flags after a delay
      setTimeout(() => {
        isRestoringScrollRef.current = false;
        transitionScrollLockRef.current = null; // Release lock after click transition likely done
      }, 50); 
    },
    [emblaApi, selectedTab, handleTabChangeWithDebounce]
  );

  // --- Effect to PAUSE/RESUME observer and LOCK SCROLL during interaction ---
  useEffect(() => {
    if (!emblaApi || !observerRef) return; 

    let isTransitioning = false;
    
    const preventScroll = (e: Event) => {
      if (isTransitioning && transitionScrollLockRef.current !== null) {
        window.scrollTo(0, transitionScrollLockRef.current);
        e.preventDefault();
      }
    };
    
    const startTransition = (currentScrollY: number) => {
      setIsDragging(true); // Set dragging state TRUE
      isTransitioning = true;
      transitionScrollLockRef.current = currentScrollY; 
      preScrolledIndexRef.current = -1; 
      window.addEventListener('scroll', preventScroll, { passive: false });
    };
    
    const endTransition = () => {
      setIsDragging(false); // Set dragging state FALSE
      isTransitioning = false;
      window.removeEventListener('scroll', preventScroll);
      transitionScrollLockRef.current = null; 
      preScrolledIndexRef.current = -1; 
    };

    const disableObserver = () => {
        const currentScrollY = window.scrollY;
        if (!isRestoringScrollRef.current) {
          scrollPositionsRef.current[emblaApi.selectedScrollSnap()] = currentScrollY;
        }
        observerRef.current?.disconnect();
        startTransition(currentScrollY); 
    };

    const enableObserver = () => {
        if (!emblaApi || !observerRef.current || typeof window === 'undefined') return;
        const currentSelectedIndex = emblaApi.selectedScrollSnap();
        setTimeout(() => {
          const activeSlideNode = slideRefs.current[currentSelectedIndex];
          if (activeSlideNode && observerRef.current) {
            observerRef.current.disconnect(); 
            observerRef.current.observe(activeSlideNode);
          }
          endTransition(); // Calls setIsDragging(false)
        }, 250); 
    };

    emblaApi.on('pointerDown', disableObserver);
    emblaApi.on('pointerUp', enableObserver); 
    emblaApi.on('settle', enableObserver); 

    return () => {
      emblaApi.off('pointerDown', disableObserver);
      emblaApi.off('pointerUp', enableObserver);
      emblaApi.off('settle', enableObserver); 
      window.removeEventListener('scroll', preventScroll); // Ensure cleanup
      transitionScrollLockRef.current = null; // Ensure lock is released on unmount
    };
  }, [emblaApi]); // Removed observerRef dependency as it's handled internally

  // --- Refined Effect for Pre-Scrolling during Swipe (no visibility change) --- 
  useEffect(() => {
    if (!emblaApi) return;

    const onScroll = () => {
      const engine = emblaApi.internalEngine();
      if (!engine.dragHandler.pointerDown()) return; 

      const progress = emblaApi.scrollProgress();
      const slidesInView = emblaApi.slidesInView(); 
      const location = engine.location.get(); 
      const target = engine.target.get(); 
      const direction = Math.sign(target - location); 
      
      let potentialTargetIndex = -1;
      const currentIndex = emblaApi.selectedScrollSnap(); 

      if (direction > 0 && currentIndex < tabs.length - 1) {
        potentialTargetIndex = currentIndex + 1;
      } else if (direction < 0 && currentIndex > 0) {
        potentialTargetIndex = currentIndex - 1;
      }
      
      let isPotentialTargetVisible = false;
      if (potentialTargetIndex !== -1 && slidesInView.includes(potentialTargetIndex)) {
         const progressRelativeToPotential = Math.abs(progress - potentialTargetIndex);
         if (progressRelativeToPotential < 0.80) { 
            isPotentialTargetVisible = true;
         }
      }
            
      // Check: Valid target? Sufficiently visible? Haven't pre-scrolled?
      if (
        potentialTargetIndex !== -1 &&
        isPotentialTargetVisible && 
        potentialTargetIndex !== preScrolledIndexRef.current
      ) {
        const targetScrollPosition = scrollPositionsRef.current[potentialTargetIndex] ?? 0;
        const incomingContentEl = contentRefs.current[potentialTargetIndex]; // Get ref

        if (incomingContentEl && window.scrollY !== targetScrollPosition) {
           // Only apply scroll position silently
           window.scrollTo(0, targetScrollPosition);
           preScrolledIndexRef.current = potentialTargetIndex;
        }
      }
    };

    emblaApi.on('scroll', onScroll);

    return () => {
      emblaApi.off('scroll', onScroll);
    };
  }, [emblaApi, tabs.length]); 

  // When tab changes (slider select event), apply final scroll (NO visibility change here)
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const previousIndex = selectedTab; 
      const index = emblaApi.selectedScrollSnap();

      if (previousIndex !== index) {
        const targetScrollPosition = scrollPositionsRef.current[index] ?? 0;

        isRestoringScrollRef.current = true;

        requestAnimationFrame(() => {
          window.scrollTo(0, targetScrollPosition); // Apply final scroll
          transitionScrollLockRef.current = null; // Release lock

          requestAnimationFrame(() => {
            setTimeout(() => { 
              isRestoringScrollRef.current = false; // Reset flag
            }, 0); 
          });
        });

        setSelectedTab(index);
        handleTabChangeWithDebounce(index);
      }
    };

    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, selectedTab, handleTabChangeWithDebounce]);

  // Function to restore scroll position
  const restoreScrollPosition = useCallback((index: number) => {
    // Set flag to prevent scroll events during restoration
    isRestoringScrollRef.current = true;
    
    // Get saved position (default to 0 if not set)
    const savedPosition = scrollPositionsRef.current[index] ?? 0;
    
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      // Set scroll position
      window.scrollTo(0, savedPosition);
      
      // Reset flag after a short delay
      setTimeout(() => {
        isRestoringScrollRef.current = false;
      }, 100);
    });
  }, []);

  // When component mounts, ensure scroll position is at 0 for the initial tab
  useEffect(() => {
    window.scrollTo(0, 0);
    scrollPositionsRef.current[defaultTabIndex] = 0;
  }, [defaultTabIndex]);

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
            
            // Use the memoized renderer for this tab
            const renderTab = memoizedTabRenderers[index];
            // Determine visibility based on dragging state and active status
            const isVisible = !isDragging || isActive; 

            return (
              <div 
                key={`carousel-${tab.id}`} 
                className="min-w-0 flex-[0_0_100%] transform-gpu" 
                ref={(el: HTMLDivElement | null) => { slideRefs.current[index] = el; }} // Correct ref assignment
                aria-hidden={!isActive} 
                style={{ 
                  willChange: 'transform', 
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden'
                }}
              >
                {/* Apply visibility style directly based on state */}
                <div 
                  ref={(instance: HTMLDivElement | null) => { contentRefs.current[index] = instance; }}
                  style={{ visibility: isVisible ? 'visible' : 'hidden' }}
                >
                   {renderTab(isActive)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 