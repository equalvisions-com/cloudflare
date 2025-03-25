'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import AutoHeight from 'embla-carousel-auto-height';
import './swipeable-tabs.css';

interface SwipeableTabsProps {
  tabs: {
    id: string;
    label: string;
    content: React.ReactNode;
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
    <div className="sticky-header flex w-full">
      
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(index)}
          className={cn(
            'flex-1 py-3 text-center font-medium text-sm relative transition-colors',
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
  animationDuration = 0, // Set to 0 for immediate animation with no transition
  onTabChange,
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([defaultTabIndex]));
  
  // Store scroll positions for each tab
  const scrollPositionsRef = useRef<Record<number, number>>({});
  
  // Flag to prevent scroll events during tab switching
  const isRestoringScrollRef = useRef(false);
  
  // Ref to track the last tab change to prevent duplicate events
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });
  
  // Initialize scroll positions for all tabs to 0
  useEffect(() => {
    tabs.forEach((_, index) => {
      if (scrollPositionsRef.current[index] === undefined) {
        scrollPositionsRef.current[index] = 0;
      }
    });
  }, [tabs]);
  
  // Use the AutoHeight plugin with default options
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    skipSnaps: false,
    startIndex: defaultTabIndex,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    duration: animationDuration,
  }, [AutoHeight()]);

  // Add CSS to the document for tab content transitions
  useEffect(() => {
    // Create a style element
    const style = document.createElement('style');
    style.innerHTML = `
      .tab-content {
        display: block;
      }
      .tab-content-active {
        display: block;
      }
      .tab-content-inactive {
        display: none;
      }
    `;
    document.head.appendChild(style);
    
    // Clean up
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
  
  // Sync tab selection with carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      
      if (selectedTab !== index) {
        // Save current scroll position
        if (!isRestoringScrollRef.current) {
          scrollPositionsRef.current[selectedTab] = window.scrollY;
        }
        
        // Mark this tab as visited
        setVisitedTabs(prev => new Set([...prev, index]));
        
        // Update selected tab
        setSelectedTab(index);
        
        // Handle tab change with debounce
        handleTabChangeWithDebounce(index);
        
        // Restore scroll position
        restoreScrollPosition(index);
      }
    };
    
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, selectedTab, restoreScrollPosition, handleTabChangeWithDebounce]);

  // Handle tab click
  const handleTabClick = useCallback(
    (index: number) => {
      if (!emblaApi || index === selectedTab) return;
      
      // Save current scroll position
      if (!isRestoringScrollRef.current) {
        scrollPositionsRef.current[selectedTab] = window.scrollY;
      }
      
      // Mark this tab as visited
      setVisitedTabs(prev => new Set([...prev, index]));
      
      // Use scrollTo with immediate=true to skip animation
      emblaApi.scrollTo(index, true);
      
      // Update selected tab
      setSelectedTab(index);
      
      // Handle tab change with debounce
      handleTabChangeWithDebounce(index);
      
      // Restore scroll position
      restoreScrollPosition(index);
    },
    [emblaApi, selectedTab, restoreScrollPosition, handleTabChangeWithDebounce]
  );

  // Pre-render all tab contents but keep them hidden when not active
  const renderedTabs = useMemo(() => {
    return tabs.map((tab, index) => (
      <TabContent 
        key={`tab-content-${tab.id}`} 
        id={tab.id}
        content={visitedTabs.has(index) ? tab.content : null} 
        isActive={index === selectedTab}
      />
    ));
  }, [tabs, selectedTab, visitedTabs]);

  // When component mounts, ensure scroll position is at 0 for the initial tab
  useEffect(() => {
    window.scrollTo(0, 0);
    scrollPositionsRef.current[defaultTabIndex] = 0;
  }, [defaultTabIndex]);

  return (
    <div 
      className={cn('w-full h-full', className)}
    >
      {/* Tab Headers */}
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTab} 
        onTabClick={handleTabClick} 
      />

      {/* All tab contents are rendered but only the selected one is visible */}
      <div className="w-full">
        {renderedTabs}
      </div>

      {/* Hidden carousel for tab switching - not visible but controls tab selection */}
      <div 
        className="w-full h-0 overflow-hidden" 
        ref={emblaRef}
        aria-hidden="true"
      >
        <div className="flex">
          {tabs.map((tab) => (
            <div 
              key={`carousel-${tab.id}`} 
              className="min-w-0 flex-[0_0_100%]"
              style={{ minHeight: '1px' }} // Ensure content has minimum height
            >
              {/* Empty div just for carousel control */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 