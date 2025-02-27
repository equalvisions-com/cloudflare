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
  className?: string;
  animationDuration?: number; // Animation duration in milliseconds
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
    <div className="flex w-full border-b sticky top-0 bg-background z-10">
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
  className,
  animationDuration = 5, // Very low value for fast animation with minimal bouncing
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([defaultTabIndex]));
  
  // Optimize carousel options for performance with faster animation and no bouncing
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    skipSnaps: false,
    startIndex: defaultTabIndex,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true, // Allow free-form dragging for more natural feel
    duration: 100, // Even shorter animation duration for faster slide-in
    breakpoints: {
      '(max-width: 768px)': { dragFree: true } // Ensure drag free on mobile
    }
  });

  // Add reinitialization function to optimize performance
  const reinitEmbla = useCallback(() => {
    if (emblaApi) {
      emblaApi.reInit();
    }
  }, [emblaApi]);

  // Optimize performance by reinitializing on window resize
  useEffect(() => {
    window.addEventListener('resize', reinitEmbla);
    return () => {
      window.removeEventListener('resize', reinitEmbla);
    };
  }, [reinitEmbla]);

  // Sync tab selection with carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setSelectedTab(index);
      // Mark this tab as loaded once it's selected
      setLoadedTabs(prev => new Set([...prev, index]));
    };
    
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // Handle tab click with immediate snap (no animation) to prevent bouncing
  const handleTabClick = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      
      // Use scrollTo with immediate=true to skip animation completely
      emblaApi.scrollTo(index, true);
      setSelectedTab(index);
      // Mark this tab as loaded once it's clicked
      setLoadedTabs(prev => new Set([...prev, index]));
    },
    [emblaApi]
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
          touchAction: 'pan-y', // Improve touch handling
        }}
      >
        <div className="flex" style={{ transition: 'transform 100ms cubic-bezier(0.2, 0, 0, 1)' }}>
          {tabs.map((tab, index) => (
            <div 
              key={tab.id} 
              className="min-w-0 flex-[0_0_100%]"
              style={{ 
                WebkitTapHighlightColor: 'transparent', // Remove tap highlight on mobile
                transform: 'translate3d(0, 0, 0)', // Force GPU acceleration
                backfaceVisibility: 'hidden', // Prevent flickering during animations
              }}
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