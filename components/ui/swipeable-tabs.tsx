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
  animationDuration = 400,
  onTabChange,
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  
  // Store scroll positions for each tab
  const scrollPositionsRef = useRef<Record<number, number>>({});
  
  // Flag to prevent scroll events during tab switching
  const isRestoringScrollRef = useRef(false);
  
  // Flag to block Embla transitions during pre-loading
  const isPreparingTransitionRef = useRef(false);
  
  // Ref to track the last tab change to prevent duplicate events
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });
  
  // Keep track of rendered tabs
  const [renderedTabs, setRenderedTabs] = useState<Record<number, boolean>>({
    [defaultTabIndex]: true
  });
  
  // References to tab container elements
  const tabContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  
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
  
  // Initialize scroll positions for all tabs to 0
  useEffect(() => {
    tabs.forEach((_, index) => {
      if (scrollPositionsRef.current[index] === undefined) {
        scrollPositionsRef.current[index] = 0;
      }
    });
  }, [tabs]);
  
  // Use the AutoHeight plugin with default options
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
    watchResize: false,  // Disable automatic resize to give us more control
  }, [AutoHeight()]); 

  // Save scroll position when user scrolls
  useEffect(() => {
    const handleScroll = () => {
      // Only save scroll position if we're not in the middle of restoring
      if (!isRestoringScrollRef.current) {
        // Save for the currently selected tab only
        scrollPositionsRef.current[selectedTab] = window.scrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [selectedTab]);

  // Pre-render tabs for smoother transitions - RENDER ALL TABS ON MOUNT
  useEffect(() => {
    // Render ALL tabs immediately to ensure smooth transitions
    setRenderedTabs(
      tabs.reduce((obj, _, index) => {
        obj[index] = true;
        return obj;
      }, {} as Record<number, boolean>)
    );
    
    // Pre-measure ALL tab heights immediately on mount after a short delay
    const measureAllHeightsTimeout = setTimeout(() => {
      slideRefs.current.forEach((slide, index) => {
        if (slide && slide.offsetHeight > 0) {
          tabHeightsRef.current[index] = slide.offsetHeight;
        }
      });
    }, 100);
    return () => clearTimeout(measureAllHeightsTimeout);
  }, [selectedTab, tabs.length]);
  
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
    
    // Function to track transition state AND perform instant adjustments
    const onTransitionStart = () => {
      isInTransition = true;
      
      // Get target index immediately
      const targetIndex = emblaApi.selectedScrollSnap();

      // Use the functional update pattern to avoid accessing renderedTabs directly
      setRenderedTabs(prev => {
        // Only update if this tab isn't already rendered
        if (prev[targetIndex]) return prev;
        return { ...prev, [targetIndex]: true };
      });

      // Apply fixed height to container instantly
      const emblaContainer = emblaApi.containerNode();
      const targetHeight = tabHeightsRef.current[targetIndex];
      if (emblaContainer && targetHeight) {
        emblaContainer.style.height = `${targetHeight}px`;
        emblaContainer.style.transition = 'none';
      }
      
      // --- Immediate Scroll Restoration --- 
      isRestoringScrollRef.current = true;
      const savedPosition = scrollPositionsRef.current[targetIndex] ?? 0;
      
      // Scroll immediately before animation starts
      window.scrollTo(0, savedPosition);
      
      // Reset flag slightly later to allow scroll events to potentially settle
      requestAnimationFrame(() => {
        setTimeout(() => {
          isRestoringScrollRef.current = false;
        }, 50); // Short delay is usually sufficient
      });
      // --- End Immediate Scroll Restoration ---

      // Clear any pending reInit timeout
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
  
  // Sync tab selection with carousel (Simplified)
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      
      if (selectedTab !== index) {
        // Save current scroll position BEFORE state update
        if (!isRestoringScrollRef.current) {
          scrollPositionsRef.current[selectedTab] = window.scrollY;
        }
        
        // Update selected tab state
        setSelectedTab(index);
        
        // Handle tab change callback with debounce
        handleTabChangeWithDebounce(index);
        
        // Scroll restoration is now handled by the 'select' listener via onTransitionStart
      }
    };
    
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
    // Removed restoreScrollPosition from dependencies
  }, [emblaApi, selectedTab, handleTabChangeWithDebounce]); 

  // Function to preload and prepare a tab for transition
  const prepareTabTransition = useCallback((targetIndex: number) => {
    // Set flag to block other transitions
    isPreparingTransitionRef.current = true;
    
    // Save current position if not already being restored
    if (!isRestoringScrollRef.current) {
      // Use a local copy to avoid closure over selectedTab which might change
      const currentTab = selectedTab;
      scrollPositionsRef.current[currentTab] = window.scrollY;
    }
    
    // Pre-render the target tab to ensure content is ready
    setRenderedTabs(prev => ({
      ...prev,
      [targetIndex]: true
    }));
    
    // Give React a chance to render
    return new Promise<void>(resolve => {
      // Force microtask to complete render cycle
      setTimeout(() => {
        // FORCE a full render cycle before continuing
        requestAnimationFrame(() => {
          // Measure the height of the target tab if we don't have it yet
          const targetSlide = slideRefs.current[targetIndex];
          if (targetSlide && (!tabHeightsRef.current[targetIndex] || tabHeightsRef.current[targetIndex] === 0)) {
            tabHeightsRef.current[targetIndex] = targetSlide.offsetHeight;
          }
          
          // Apply height to both the container AND to all slides for consistency
          if (emblaApi && tabHeightsRef.current[targetIndex]) {
            const emblaContainer = emblaApi.containerNode();
            if (emblaContainer) {
              // Immediately set height to match the target slide's height
              emblaContainer.style.height = `${tabHeightsRef.current[targetIndex]}px`;
              emblaContainer.style.transition = 'none';
              
              // Also fix heights of all slides to this height to prevent any jumps
              slideRefs.current.forEach((slide) => {
                if (slide) {
                  slide.style.height = `${tabHeightsRef.current[targetIndex]}px`;
                  slide.style.minHeight = `${tabHeightsRef.current[targetIndex]}px`;
                }
              });
            }
          }
          
          // Now preload the scroll position
          isRestoringScrollRef.current = true;
          window.scrollTo(0, scrollPositionsRef.current[targetIndex] || 0);
          
          // Small delay to let scroll settle
          setTimeout(() => {
            isRestoringScrollRef.current = false;
            isPreparingTransitionRef.current = false;
            resolve();
          }, 100); // Longer delay to ensure everything is ready
        });
      }, 0);
    });
  }, [emblaApi, selectedTab]);

  // Handle tab click with enhanced preloading
  const handleTabClick = useCallback(async (index: number) => {
    if (!emblaApi || index === selectedTab || isPreparingTransitionRef.current) return;
    
    // Block further transitions during preparation
    isPreparingTransitionRef.current = true;
    
    // Capture current scroll position
    if (!isRestoringScrollRef.current) {
      scrollPositionsRef.current[selectedTab] = window.scrollY;
    }
    
    // IMMEDIATE setup: Directly set the container and slide heights now
    const targetHeight = tabHeightsRef.current[index];
    if (emblaApi && targetHeight) {
      const emblaContainer = emblaApi.containerNode();
      if (emblaContainer) {
        // Apply target height with no transition
        emblaContainer.style.transition = 'none';
        emblaContainer.style.height = `${targetHeight}px`;
        
        // Force browser to acknowledge the height change
        void emblaContainer.offsetHeight; // This triggers a reflow
      }
      
      // Pre-set scroll position before animation starts
      isRestoringScrollRef.current = true;
      window.scrollTo(0, scrollPositionsRef.current[index] || 0);
    }

    // Force browser to apply these changes before proceeding
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Now trigger the actual transition
    emblaApi.scrollTo(index, true);
    setSelectedTab(index);
    
    // Reset flag after a short delay
    setTimeout(() => {
      isRestoringScrollRef.current = false;
      isPreparingTransitionRef.current = false;
    }, 50);
    
    // Notify of tab change
    if (Date.now() - lastTabChangeRef.current.time > 300 || index !== lastTabChangeRef.current.index) {
      lastTabChangeRef.current = { index, time: Date.now() };
      onTabChange?.(index);
    }
  }, [emblaApi, selectedTab, prepareTabTransition, onTabChange]);

  // Preload tabs on mount and when selected tab changes
  useEffect(() => {
    // Preload the currently selected tab first
    setRenderedTabs(prev => ({
      ...prev,
      [selectedTab]: true
    }));
    
    // Then preload adjacent tabs to improve perceived performance
    const timer = setTimeout(() => {
      const nextTab = selectedTab + 1 < tabs.length ? selectedTab + 1 : null;
      const prevTab = selectedTab - 1 >= 0 ? selectedTab - 1 : null;
      
      setRenderedTabs(prev => {
        const newState = { ...prev };
        if (nextTab !== null) newState[nextTab] = true;
        if (prevTab !== null) newState[prevTab] = true;
        return newState;
      });
      
      // Also measure their heights while we're at it
      [nextTab, prevTab].forEach(tabIndex => {
        if (tabIndex === null) return;
        const slide = slideRefs.current[tabIndex];
        if (slide && slide.offsetHeight > 0) {
          tabHeightsRef.current[tabIndex] = slide.offsetHeight;
        }
      });
    }, 300);
    
    return () => clearTimeout(timer);
  }, [selectedTab, tabs.length]);

  // For swipe gestures, intercept Embla's built-in transitions
  useEffect(() => {
    if (!emblaApi) return;
    
    // Handle initial pointer down to prepare for possible swipe
    const handlePointerDown = () => {
      // Immediately capture the current scroll position
      if (!isRestoringScrollRef.current) {
        scrollPositionsRef.current[selectedTab] = window.scrollY;
      }
      
      // Get indices of possible next slides
      const currentIndex = emblaApi.selectedScrollSnap();
      const nextIndex = currentIndex + 1 < tabs.length ? currentIndex + 1 : null;
      const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : null;
      
      // Pre-set the heights of adjacent slides to this height
      const currentHeight = tabHeightsRef.current[currentIndex] || 0;
      if (currentHeight) {
        [nextIndex, prevIndex].forEach(index => {
          if (index === null) return;
          
          const slide = slideRefs.current[index];
          if (slide) {
            slide.style.height = `${currentHeight}px`;
            slide.style.minHeight = `${currentHeight}px`;
          }
        });
      }
    };
    
    const handleSelect = async () => {
      // Skip if we're already in the middle of a managed transition
      if (isPreparingTransitionRef.current) return;
      
      const nextIndex = emblaApi.selectedScrollSnap();
      if (nextIndex === selectedTab) return;
      
      // Save scroll position for current tab
      if (!isRestoringScrollRef.current) {
        scrollPositionsRef.current[selectedTab] = window.scrollY;
      }
      
      // IMMEDIATELY apply the target height before animation starts
      const targetHeight = tabHeightsRef.current[nextIndex];
      if (targetHeight && emblaApi) {
        const emblaContainer = emblaApi.containerNode();
        if (emblaContainer) {
          emblaContainer.style.transition = 'none';
          emblaContainer.style.height = `${targetHeight}px`;
          
          // Force browser to acknowledge the height change
          void emblaContainer.offsetHeight; // This triggers a reflow
        }
      }
      
      // Update the selected tab
      setSelectedTab(nextIndex);
      
      // Restore scroll position for new tab
      isRestoringScrollRef.current = true;
      window.scrollTo(0, scrollPositionsRef.current[nextIndex] || 0);
      
      // Reset the flag after scroll is restored
      setTimeout(() => {
        isRestoringScrollRef.current = false;
      }, 50);
      
      // Use a local value for comparison rather than the ref which might change
      const lastChangeTime = lastTabChangeRef.current.time;
      const lastChangeIndex = lastTabChangeRef.current.index;
      if (Date.now() - lastChangeTime > 300 || nextIndex !== lastChangeIndex) {
        lastTabChangeRef.current = { index: nextIndex, time: Date.now() };
        onTabChange?.(nextIndex);
      }
    };
    
    // Register for both the pointerDown event (to prepare) and select event
    emblaApi.on('select', handleSelect);
    emblaApi.on('pointerDown', handlePointerDown);
    
    return () => {
      emblaApi.off('select', handleSelect);
      emblaApi.off('pointerDown', handlePointerDown);
    };
  }, [emblaApi, selectedTab, onTabChange, tabs.length]);

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
        className="w-full overflow-hidden embla__swipeable_tabs"
        ref={emblaRef}
        style={{ 
          willChange: 'transform',
          WebkitPerspective: '1000',
          WebkitBackfaceVisibility: 'hidden',
          // Set fixed height at container level
          height: tabHeightsRef.current[selectedTab] ? `${tabHeightsRef.current[selectedTab]}px` : undefined,
          // Disable transitions on the container to prevent height animation
          transition: 'none'
        }}
      >
        <div className="flex items-start"> 
          {tabs.map((tab, index) => {
            const isActive = index === selectedTab;
            const isRendered = renderedTabs[index] === true;
            
            // Use the memoized renderer for this tab
            const renderTab = memoizedTabRenderers[index];

            return (
              <div 
                key={`carousel-${tab.id}`} 
                className={cn(
                  "min-w-0 flex-[0_0_100%] transform-gpu",
                  !isActive && "opacity-0" // Keep rendered but invisible while inactive
                )}
                ref={(el: HTMLDivElement | null) => { 
                  slideRefs.current[index] = el;
                  tabContainerRefs.current[index] = el;
                }} 
                aria-hidden={!isActive} 
                style={{ 
                  willChange: 'transform', 
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  // Set all slides to the current tab's height to prevent jumps during transition
                  height: tabHeightsRef.current[selectedTab] ? `${tabHeightsRef.current[selectedTab]}px` : undefined,
                  minHeight: tabHeightsRef.current[selectedTab] ? `${tabHeightsRef.current[selectedTab]}px` : undefined,
                  // Add overflow hidden to prevent content from affecting height
                  overflow: 'hidden'
                }}
              >
                {/* Always keep content in DOM once rendered to maintain scroll positions */}
                {isRendered && renderTab(isActive)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 