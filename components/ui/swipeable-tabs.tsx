'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo, startTransition } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import AutoHeight from 'embla-carousel-auto-height';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import type { SwipeableTabsProps } from '@/lib/types';
import { 
  useEdgeSafeMobileDetection, 
  useEmblaSetup, 
  useTabEventHandlers, 
  useEdgeSafeResizeObserver 
} from '@/hooks/useSwipeableTabsHooks';
import { useTabsState } from '@/hooks/useSwipeableTabsReducer';
import type { TabsAction } from '@/lib/types';

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
    <div 
      className="flex w-full sticky top-0 bg-background/85 backdrop-blur-md z-40 border-b"
      role="tablist"
      aria-label="Content tabs"
    >
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
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          tabIndex={selectedTab === index ? 0 : -1}
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
}, (prevProps, nextProps) => {
  // Enhanced memoization with deep comparison
  return (
    prevProps.selectedTab === nextProps.selectedTab &&
    prevProps.tabs.length === nextProps.tabs.length &&
    prevProps.tabs === nextProps.tabs // Reference equality first
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
      id={`tabpanel-${id}`}
      className={cn(
        "w-full tab-content", 
        { 
          "tab-content-active": isActive,
          "tab-content-inactive": !isActive
        }
      )}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
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
  // Use consolidated state with useReducer
  const { state, dispatch } = useTabsState(defaultTabIndex);
  const { selectedTab, isTransitioning, isInteracting } = state;
  
  // Use Edge-safe mobile detection hook
  const isMobile = useEdgeSafeMobileDetection();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Ref to track the last tab change to prevent duplicate events
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });
  
  // Refs for slides and heights
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]); // Ref to hold slide elements
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
  
  // Mobile detection is now handled by useEdgeSafeMobileDetection hook
  
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
  
  // Handlers for transition state
  const handleTransitionStart = useCallback(() => {
    if (!isMountedRef.current) return;
    dispatch({ type: 'SET_TRANSITIONING', payload: true });
  }, [dispatch]);
  
  const handleTransitionEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Add a small delay to ensure smooth transition
    setTimeout(() => {
      if (!isMountedRef.current) return;
      dispatch({ type: 'SET_TRANSITIONING', payload: false });
    }, 50);
  }, [dispatch]);
  
  // Interaction state handlers
  const handlePointerDown = useCallback(() => {
    if (!isMountedRef.current) return;
    dispatch({ type: 'SET_INTERACTING', payload: true });
  }, [dispatch]);
  
  const handleSettle = useCallback(() => {
    if (!isMountedRef.current) return;
    dispatch({ type: 'SET_INTERACTING', payload: false });
  }, [dispatch]);
  
  // Observer handlers are now provided by useEdgeSafeResizeObserver hook
  
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

  // Set up mounted ref
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handler to update selected tab
  const handleSelectedTabChange = useCallback((index: number) => {
    dispatch({ type: 'SET_SELECTED_TAB', payload: index });
  }, [dispatch]);

  // CRITICAL: Sync internal state with parent's defaultTabIndex changes
  const prevDefaultTabIndexRef = useRef(defaultTabIndex);
  useEffect(() => {
    // Only sync when parent's defaultTabIndex actually changes (controlled component behavior)
    if (prevDefaultTabIndexRef.current !== defaultTabIndex) {
      prevDefaultTabIndexRef.current = defaultTabIndex;
      
      // Update internal state to match parent
      if (selectedTab !== defaultTabIndex) {
        dispatch({ type: 'SET_SELECTED_TAB', payload: defaultTabIndex });
        
        // Also update Embla to match
        if (emblaApi) {
          emblaApi.scrollTo(defaultTabIndex, true);
        }
      }
    }
  }, [defaultTabIndex, selectedTab, emblaApi, dispatch]);

  // Use custom hooks
  useEmblaSetup(emblaApi, defaultTabIndex, isMobile, handleSelectedTabChange);
  
  const { isInstantJumpRef } = useTabEventHandlers(
    emblaApi,
    selectedTab,
    onTabChange,
    handleSelectedTabChange,
    handleTransitionStart,
    handleTransitionEnd,
    handlePointerDown,
    handleSettle
  );

  // Handle tab click (after hooks are initialized)
  const handleTabClick = useCallback(
    (index: number) => {
      if (!isMountedRef.current) return;
      
      if (!emblaApi || index === selectedTab) return;

      // Use React.startTransition for smooth UX
      startTransition(() => {
        // Signal that the next 'select' event is from an instant jump
        isInstantJumpRef.current = true; 

        // Reset scroll position to top when switching tabs
        if (typeof window !== 'undefined') {
          window.scrollTo(0, 0);
        }

        // Jump instantly
        emblaApi.scrollTo(index, true);
      });
    },
    [emblaApi, selectedTab, isInstantJumpRef]
  );

  // Use ResizeObserver hook
  const { disableObserver, enableObserver } = useEdgeSafeResizeObserver(
    emblaApi,
    selectedTab,
    slideRefs,
    measureSlideHeights,
    onTransitionStart,
    onTransitionEnd
  );

  // Observer pause/resume during interaction
  useEffect(() => {
    if (!emblaApi || !isMountedRef.current) return;

    emblaApi.on('pointerDown', disableObserver);
    emblaApi.on('pointerUp', enableObserver);
    emblaApi.on('settle', enableObserver);

    return () => {
      emblaApi.off('pointerDown', disableObserver);
      emblaApi.off('pointerUp', enableObserver);
      emblaApi.off('settle', enableObserver);
    };
  }, [emblaApi, disableObserver, enableObserver]);

  // Keyboard navigation for tablist
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!emblaApi) return;
      
      // Only handle keyboard events when focus is on tab buttons
      const activeElement = document.activeElement;
      const isTabButton = activeElement?.getAttribute('role') === 'tab';
      
      if (!isTabButton) return;
      
      let newIndex = selectedTab;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = selectedTab > 0 ? selectedTab - 1 : tabs.length - 1; // Wrap to end
          break;
        case 'ArrowRight':
          e.preventDefault();
          newIndex = selectedTab < tabs.length - 1 ? selectedTab + 1 : 0; // Wrap to start
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = tabs.length - 1;
          break;
        default:
          return;
      }
      
      emblaApi.scrollTo(newIndex);
      
      // Focus the new tab button
      setTimeout(() => {
        const newTabButton = document.getElementById(`tab-${tabs[newIndex]?.id}`);
        newTabButton?.focus();
      }, 0);
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [emblaApi, selectedTab, tabs]);

  return (
    <div 
      className={cn('w-full', className)}
    >
      {/* ARIA live region for screen readers */}
      <div aria-live="polite" className="sr-only">
        {`Tab ${selectedTab + 1} of ${tabs.length}: ${tabs[selectedTab]?.label}`}
      </div>

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
                role="tabpanel"
                aria-labelledby={`tab-${tab.id}`}
                id={`tabpanel-${tab.id}`}
                aria-hidden={!isActive}
                tabIndex={isActive ? 0 : -1}
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
                {/* REACT BEST PRACTICE: Always render tab content to preserve state */}
                {/* Use isActive prop to control component behavior instead of conditional rendering */}
                {renderTab()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Export memoized component with custom comparison
export const SwipeableTabs = memo(SwipeableTabsComponent, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  if (
    prevProps.defaultTabIndex !== nextProps.defaultTabIndex ||
    prevProps.className !== nextProps.className ||
    prevProps.animationDuration !== nextProps.animationDuration ||
    prevProps.onTabChange !== nextProps.onTabChange
  ) {
    return false;
  }

  // Deep comparison for tabs array
  if (prevProps.tabs.length !== nextProps.tabs.length) {
    return false;
  }

  // Compare tab structure and content
  for (let i = 0; i < prevProps.tabs.length; i++) {
    const prevTab = prevProps.tabs[i];
    const nextTab = nextProps.tabs[i];
    
    if (
      prevTab.id !== nextTab.id ||
      prevTab.label !== nextTab.label ||
      prevTab.component !== nextTab.component
    ) {
      return false;
    }
  }

  return true; // Props are equal, skip re-render
}); 