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
}

// Memoized tab header component to prevent re-renders
const TabHeaders = React.memo(({ 
  tabs, 
  selectedTab, 
  onTabClick,
  isVisible
}: { 
  tabs: SwipeableTabsProps['tabs'], 
  selectedTab: number, 
  onTabClick: (index: number) => void,
  isVisible: boolean
}) => {
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [, forceUpdate] = useState({});
  const headerHeight = 44; // Approximate height of the header in pixels

  // Force re-render when selected tab changes to ensure indicator width updates
  useEffect(() => {
    forceUpdate({});
  }, [selectedTab]);

  return (
    <div 
      className={cn(
        "flex w-full border-l border-r border-b sticky top-0 bg-background z-10 header-transition",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
      style={{ height: `${headerHeight}px` }}
    >
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
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([defaultTabIndex]));
  
  // Store scroll positions for each tab
  const scrollPositionsRef = useRef<Record<number, number>>({});
  
  // Flag to prevent scroll events during tab switching
  const isRestoringScrollRef = useRef(false);
  
  // Add state for header visibility
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollThreshold = 10; // Minimum scroll amount to trigger header visibility change
  const headerHeight = 44; // Approximate height of the header in pixels
  
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

  // Handle scroll events to show/hide header
  useEffect(() => {
    const handleScroll = () => {
      // Only handle scroll events if we're not restoring scroll position
      if (!isRestoringScrollRef.current) {
        const currentScrollY = window.scrollY;
        
        // Save current scroll position for the active tab
        scrollPositionsRef.current[selectedTab] = currentScrollY;
        
        // Determine if we should show/hide the header based on scroll direction
        if (Math.abs(currentScrollY - lastScrollYRef.current) > scrollThreshold) {
          // Scrolling down - hide header
          if (currentScrollY > lastScrollYRef.current && currentScrollY > headerHeight) {
            setIsHeaderVisible(false);
          } 
          // Scrolling up - show header
          else if (currentScrollY < lastScrollYRef.current) {
            setIsHeaderVisible(true);
          }
          
          // Update last scroll position
          lastScrollYRef.current = currentScrollY;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [selectedTab, scrollThreshold, headerHeight]);

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
        
        // Update last scroll position to match the restored position
        lastScrollYRef.current = savedPosition;
        
        // Show header when switching tabs
        setIsHeaderVisible(true);
      }, 100);
    });
  }, []);

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
        
        // Restore scroll position
        restoreScrollPosition(index);
      }
    };
    
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, selectedTab, restoreScrollPosition]);

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
      
      // Restore scroll position
      restoreScrollPosition(index);
    },
    [emblaApi, selectedTab, restoreScrollPosition]
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
    lastScrollYRef.current = 0;
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
        isVisible={isHeaderVisible}
      />

      {/* All tab contents are rendered but only the selected one is visible */}
      <div className={cn(
        "w-full content-padding-adjustment",
        !isHeaderVisible && "pt-0"
      )}>
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