'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import AutoHeight from 'embla-carousel-auto-height';
import './swipeable-tabs.css';
import { Virtuoso } from 'react-virtuoso';

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
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={cn(
        "w-full",
        isActive ? "block" : "hidden"
      )}
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
  animationDuration = 0,
  onTabChange,
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([defaultTabIndex]));
  const [isMobile, setIsMobile] = useState(false);
  const virtuosoRef = useRef(null);
  
  // Store scroll positions for each tab
  const scrollPositionsRef = useRef<Record<number, number>>({});
  const isRestoringScrollRef = useRef(false);
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: defaultTabIndex, 
    time: Date.now() 
  });

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Function to restore scroll position
  const restoreScrollPosition = useCallback((index: number) => {
    isRestoringScrollRef.current = true;
    const savedPosition = scrollPositionsRef.current[index] ?? 0;
    
    requestAnimationFrame(() => {
      window.scrollTo(0, savedPosition);
      setTimeout(() => {
        isRestoringScrollRef.current = false;
      }, 100);
    });
  }, []);

  // Function to handle tab change with debouncing
  const handleTabChangeWithDebounce = useCallback((index: number) => {
    const now = Date.now();
    if (
      index === lastTabChangeRef.current.index || 
      (now - lastTabChangeRef.current.time < 300)
    ) {
      return;
    }
    
    lastTabChangeRef.current = { index, time: now };
    if (onTabChange) {
      onTabChange(index);
    }
  }, [onTabChange]);

  // Handle tab click
  const handleTabClick = useCallback((index: number) => {
    if (index === selectedTab) return;
    
    if (!isRestoringScrollRef.current) {
      scrollPositionsRef.current[selectedTab] = window.scrollY;
    }
    
    // Only add to visitedTabs if we haven't been there before
    if (!visitedTabs.has(index)) {
      setVisitedTabs(prev => new Set([...prev, index]));
    }
    
    setSelectedTab(index);
    handleTabChangeWithDebounce(index);
    restoreScrollPosition(index);
  }, [selectedTab, handleTabChangeWithDebounce, restoreScrollPosition, visitedTabs]);

  return (
    <div className={cn('w-full h-full', className)}>
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTab} 
        onTabClick={handleTabClick} 
      />

      <div className="w-full">
        {isMobile ? (
          <Virtuoso
            ref={virtuosoRef}
            useWindowScroll
            totalCount={1}
            itemContent={() => (
              <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                {tabs.map((tab, index) => (
                  <div 
                    key={`tab-content-${tab.id}`}
                    className="flex-[0_0_100%] min-w-0 snap-start"
                  >
                    <div className="w-full">
                      {tab.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
            style={{ minHeight: '100vh' }}
          />
        ) : (
          tabs.map((tab, index) => (
            <div 
              key={`tab-content-${tab.id}`}
              className={cn(
                "w-full",
                selectedTab === index ? "block" : "hidden"
              )}
            >
              {visitedTabs.has(index) && tab.content}
            </div>
          ))
        )}
      </div>
    </div>
  );
} 