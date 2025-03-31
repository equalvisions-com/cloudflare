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
  
  // Track the last drag position to avoid excessive updates
  const lastDragPositionRef = useRef<number | null>(null);
  
  // Track if we're currently in a long-press drag operation
  const isDraggingRef = useRef(false);
  
  // Track tabs that should be visually hidden during drag
  const [hiddenDuringDragTabs, setHiddenDuringDragTabs] = useState<Record<number, boolean>>({});
  
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

  // Pre-render tabs for smoother transitions
  useEffect(() => {
    // Add this to the rendered tabs
    setRenderedTabs(prev => ({
      ...prev,
      [selectedTab]: true
    }));
    
    // Use timeout to pre-render the adjacent tabs after a short delay
    const preRenderTimeout = setTimeout(() => {
      const nextIndex = selectedTab + 1 < tabs.length ? selectedTab + 1 : null;
      const prevIndex = selectedTab - 1 >= 0 ? selectedTab - 1 : null;
      
      // Use functional update to avoid dependency on renderedTabs
      setRenderedTabs(prev => {
        const updated = { ...prev };
        if (nextIndex !== null) updated[nextIndex] = true;
        if (prevIndex !== null) updated[prevIndex] = true;
        return updated;
      });
    }, 500);
    
    return () => clearTimeout(preRenderTimeout);
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
        // Measure the height of the target tab if we don't have it yet
        const targetSlide = slideRefs.current[targetIndex];
        if (targetSlide && (!tabHeightsRef.current[targetIndex] || tabHeightsRef.current[targetIndex] === 0)) {
          tabHeightsRef.current[targetIndex] = targetSlide.offsetHeight;
        }
        
        // Apply the height to the container immediately
        if (emblaApi && tabHeightsRef.current[targetIndex]) {
          const emblaContainer = emblaApi.containerNode();
          if (emblaContainer) {
            // Immediately set height to match the target slide's height
            emblaContainer.style.height = `${tabHeightsRef.current[targetIndex]}px`;
            emblaContainer.style.transition = 'none';
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
        }, 50);
      }, 0);
    });
  }, [emblaApi, selectedTab]);

  // Handle tab click with enhanced preloading
  const handleTabClick = useCallback(async (index: number) => {
    if (!emblaApi || index === selectedTab || isPreparingTransitionRef.current) return;
    
    // Block further transitions during preparation
    isPreparingTransitionRef.current = true;
    
    // Prepare the tab (preload, adjust height, set scroll position)
    await prepareTabTransition(index);
    
    // Now trigger the actual transition
    emblaApi.scrollTo(index, true);
    setSelectedTab(index);
    
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
    
    // When a slide transition is initiated, intercept it for preparation
    const handleSelect = async () => {
      // Skip if we're already in the middle of a managed transition
      if (isPreparingTransitionRef.current) return;
      
      const nextIndex = emblaApi.selectedScrollSnap();
      if (nextIndex === selectedTab) return;
      
      // Save scroll position for current tab
      if (!isRestoringScrollRef.current) {
        scrollPositionsRef.current[selectedTab] = window.scrollY;
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
    const handlePointerDown = () => {
      // When user starts dragging, preload adjacent tabs
      const currentIndex = emblaApi.selectedScrollSnap();
      const nextIndex = currentIndex + 1 < tabs.length ? currentIndex + 1 : null;
      const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : null;
      
      [nextIndex, prevIndex].forEach(index => {
        if (index === null) return;
        
        // Batch setState calls to reduce renders
        const targetIndex = index; // Create stable reference
        requestAnimationFrame(() => {
          setRenderedTabs(prev => {
            // Skip update if already rendered
            if (prev[targetIndex]) return prev;
            return { ...prev, [targetIndex]: true };
          });
        });
        
        // Measure heights preemptively
        const slide = slideRefs.current[index];
        if (slide && slide.offsetHeight > 0) {
          tabHeightsRef.current[index] = slide.offsetHeight;
        }
      });
    };
    
    // Handle scroll event during drag to update height in real-time
    const handleScroll = () => {
      // Only handle if we're actually dragging (not during programmatic animations)
      const internalEngine = (emblaApi as any).internalEngine?.();
      if (!internalEngine?.dragHandler?.pointerDown()) return;
      
      // Get current scroll progress and determine the likely snap target
      const scrollProgress = emblaApi.scrollProgress();
      const slideCount = emblaApi.slideNodes().length;
      
      // Calculate which slide we're closest to based on scroll position
      // This gives us a float value representing position between slides
      const positionFloat = scrollProgress * (slideCount - 1);
      
      // Integer position (which slide we're closest to)
      const intPosition = Math.round(positionFloat);
      
      // Skip if we're at the same position as last time to avoid continuous updates
      if (lastDragPositionRef.current === intPosition) return;
      lastDragPositionRef.current = intPosition;
      
      // Ensure the tab is rendered
      if (intPosition >= 0 && intPosition < tabs.length) {
        // Only update if the current slide is pre-rendered
        if (renderedTabs[intPosition]) {
          // Update the height in real-time during the drag
          const emblaContainer = emblaApi.containerNode();
          if (emblaContainer && tabHeightsRef.current[intPosition]) {
            emblaContainer.style.height = `${tabHeightsRef.current[intPosition]}px`;
            emblaContainer.style.transition = 'height 120ms ease-out'; // Smooth height change during drag
          }
          
          // Restore scroll position for the new tab we're dragging to,
          // but only when we're close enough to that tab (over 50% dragged to it)
          // This makes long-press behavior feel more natural
          const floatDiff = Math.abs(positionFloat - intPosition);
          if (floatDiff < 0.3 && !isRestoringScrollRef.current) {
            // Save current scroll position for the tab we're leaving
            if (selectedTab !== intPosition) {
              scrollPositionsRef.current[selectedTab] = window.scrollY;
            }
            
            // Smoothly restore scroll position for the tab we're dragging to
            const targetScrollY = scrollPositionsRef.current[intPosition] || 0;
            
            // Only restore if significantly different (avoid subtle jumps)
            if (Math.abs(window.scrollY - targetScrollY) > 20) {
              isRestoringScrollRef.current = true;
              
              // Use smooth scrolling during drag for better UX
              window.scrollTo({
                top: targetScrollY,
                behavior: 'smooth'
              });
              
              // Reset flag after scrolling completes
              setTimeout(() => {
                isRestoringScrollRef.current = false;
              }, 300);
            }
          }
          
          // Set the current target as hidden during drag
          if (intPosition !== selectedTab) {
            setHiddenDuringDragTabs(prev => ({
              ...prev,
              [intPosition]: true
            }));
          }
        } else {
          // If not rendered yet, mark it as rendered and let React update
          setRenderedTabs(prev => {
            if (prev[intPosition]) return prev;
            return { ...prev, [intPosition]: true };
          });
          
          // Hide the tab during drag
          if (intPosition !== selectedTab) {
            setHiddenDuringDragTabs(prev => ({
              ...prev,
              [intPosition]: true
            }));
          }
          
          // We'll need a short delay to get the height after rendering
          setTimeout(() => {
            const slide = slideRefs.current[intPosition];
            if (slide && slide.offsetHeight > 0) {
              tabHeightsRef.current[intPosition] = slide.offsetHeight;
              
              // Now adjust height
              const emblaContainer = emblaApi.containerNode();
              if (emblaContainer) {
                emblaContainer.style.height = `${tabHeightsRef.current[intPosition]}px`;
                emblaContainer.style.transition = 'height 120ms ease-out';
              }
            }
          }, 50);
        }
      }
    };
    
    // Handle when a drag starts to reset tracking and mark drag active
    const handleDragStart = () => {
      lastDragPositionRef.current = null;
      isDraggingRef.current = true;
      
      // Immediately hide all non-active tabs to prevent them from showing during drag
      const currentIndex = emblaApi.selectedScrollSnap();
      const hiddenTabs: Record<number, boolean> = {};
      
      // Hide both adjacent tabs immediately
      const nextIndex = currentIndex + 1 < tabs.length ? currentIndex + 1 : null;
      const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : null;
      
      if (nextIndex !== null) hiddenTabs[nextIndex] = true;
      if (prevIndex !== null) hiddenTabs[prevIndex] = true;
      
      // Apply the hidden state immediately
      setHiddenDuringDragTabs(hiddenTabs);
    };
    
    // Handle when a drag ends, we should reveal all tabs
    const handleDragEnd = () => {
      isDraggingRef.current = false;
      
      // After drag ends, show all tabs that were hidden
      // We delay this slightly to ensure we're showing tabs only after
      // settling to the final position
      setTimeout(() => {
        setHiddenDuringDragTabs({});
      }, 50);
    };
    
    // Track mouse position to preemptively hide tabs when near the edges
    const handlePointerMove = (event: PointerEvent) => {
      if (isDraggingRef.current) return; // Skip if already dragging
      
      const viewport = emblaApi.rootNode();
      if (!viewport) return;
      
      const rect = viewport.getBoundingClientRect();
      const x = event.clientX - rect.left; // x position within the element
      const width = rect.width;
      
      // Calculate proximity to edge (20% of width is considered "edge")
      const edgeThreshold = width * 0.2;
      const currentIndex = emblaApi.selectedScrollSnap();
      
      // Clear hidden state if we're not near edges
      if (x > edgeThreshold && x < (width - edgeThreshold)) {
        setHiddenDuringDragTabs({});
        return;
      }
      
      // Near left edge, hide left tab (if any)
      if (x < edgeThreshold && currentIndex > 0) {
        setHiddenDuringDragTabs({ [currentIndex - 1]: true });
      }
      // Near right edge, hide right tab (if any)
      else if (x > (width - edgeThreshold) && currentIndex < (tabs.length - 1)) {
        setHiddenDuringDragTabs({ [currentIndex + 1]: true });
      }
    };
    
    emblaApi.on('select', handleSelect);
    emblaApi.on('pointerDown', handlePointerDown);
    emblaApi.on('scroll', handleScroll);
    emblaApi.on('pointerDown', handleDragStart);
    emblaApi.on('pointerUp', handleDragEnd);
    emblaApi.on('settle', handleDragEnd);
    
    // Add pointer move tracking for edge detection
    const viewport = emblaApi.rootNode();
    if (viewport) {
      viewport.addEventListener('pointermove', handlePointerMove);
    }
    
    return () => {
      emblaApi.off('select', handleSelect);
      emblaApi.off('pointerDown', handlePointerDown);
      emblaApi.off('scroll', handleScroll);
      emblaApi.off('pointerDown', handleDragStart);
      emblaApi.off('pointerUp', handleDragEnd);
      emblaApi.off('settle', handleDragEnd);
      
      // Remove pointer move tracking
      const viewport = emblaApi.rootNode();
      if (viewport) {
        viewport.removeEventListener('pointermove', handlePointerMove);
      }
    };
  }, [emblaApi, selectedTab, onTabChange, tabs.length, renderedTabs]);

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
            const isRendered = renderedTabs[index] === true;
            const isHiddenDuringDrag = hiddenDuringDragTabs[index] === true;
            
            // Use the memoized renderer for this tab
            const renderTab = memoizedTabRenderers[index];

            return (
            <div 
              key={`carousel-${tab.id}`} 
                className={cn(
                  "min-w-0 flex-[0_0_100%] transform-gpu",
                  !isRendered && "invisible", // Hide unrendered tabs but keep their space
                  isHiddenDuringDrag && "opacity-0 pointer-events-none" // Hide content during drag but keep dimensions
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
                  transition: isHiddenDuringDrag ? 'none' : 'opacity 250ms ease-in', // Fade in after drag is complete
                  height: isRendered ? undefined : tabHeightsRef.current[index] ? `${tabHeightsRef.current[index]}px` : undefined
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