'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';

interface SwipeableTabsProps {
  tabs: {
    id: string;
    label: string;
    content: React.ReactNode;
  }[];
  defaultTabIndex?: number;
  defaultValue?: string;
  className?: string;
  animationDuration?: number; // Animation duration in milliseconds
  onValueChange?: (tabId: string) => void;
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
    <div className="flex w-full border-l border-r border-b sticky top-0 bg-background z-10">
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

export function SwipeableTabs({
  tabs,
  defaultTabIndex = 0,
  defaultValue,
  className,
  animationDuration = 5, // Very low value for fast animation with minimal bouncing
  onValueChange,
}: SwipeableTabsProps) {
  // Find the initial tab index based on defaultValue if provided
  const initialTabIndex = defaultValue 
    ? tabs.findIndex(tab => tab.id === defaultValue) 
    : defaultTabIndex;
  
  // Use the found index or fallback to defaultTabIndex
  const startIndex = initialTabIndex !== -1 ? initialTabIndex : defaultTabIndex;
  
  const [selectedTab, setSelectedTab] = useState(startIndex);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([startIndex]));
  
  // Optimize carousel options for performance with faster animation and no bouncing
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    skipSnaps: false,
    startIndex: startIndex,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    duration: animationDuration, // Very low value for fast animation
  });

  // Sync tab selection with carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setSelectedTab(index);
      // Mark this tab as loaded once it's selected
      setLoadedTabs(prev => new Set([...prev, index]));
      
      // Call the onValueChange callback if provided
      if (onValueChange && tabs[index]) {
        onValueChange(tabs[index].id);
      }
    };
    
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onValueChange, tabs]);

  // Handle tab click with immediate snap (no animation) to prevent bouncing
  const handleTabClick = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      
      // Use scrollTo with immediate=true to skip animation completely
      emblaApi.scrollTo(index, true);
      setSelectedTab(index);
      // Mark this tab as loaded once it's clicked
      setLoadedTabs(prev => new Set([...prev, index]));
      
      // Call the onValueChange callback if provided
      if (onValueChange && tabs[index]) {
        onValueChange(tabs[index].id);
      }
    },
    [emblaApi, onValueChange, tabs]
  );

  return (
    <div className={cn('w-full h-full', className)}>
      {/* Tab Headers - Twitter/X style */}
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTab} 
        onTabClick={handleTabClick} 
      />

      {/* Swipeable Content */}
      <div 
        className="w-full overflow-hidden" 
        ref={emblaRef}
        style={{
          willChange: 'transform', // Optimize for animations
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        }}
      >
        <div className="flex">
          {tabs.map((tab, index) => (
            <div 
              key={tab.id} 
              className="min-w-0 flex-[0_0_100%]"
            >
              {/* Only render content if this tab has been loaded */}
              {loadedTabs.has(index) ? tab.content : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 