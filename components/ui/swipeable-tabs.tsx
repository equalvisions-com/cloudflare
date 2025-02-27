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
}

// Memoized tab header component to prevent re-renders
const TabHeaders = React.memo(({ 
  tabs, 
  selectedTab, 
  scrollProgress,
  onTabClick 
}: { 
  tabs: SwipeableTabsProps['tabs'], 
  selectedTab: number, 
  scrollProgress: number,
  onTabClick: (index: number) => void 
}) => {
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const [tabWidths, setTabWidths] = useState<number[]>([]);
  const [tabPositions, setTabPositions] = useState<number[]>([]);
  const [, forceUpdate] = useState({});

  // Calculate tab widths and positions when tabs change or on resize
  useEffect(() => {
    if (!headerContainerRef.current) return;
    
    const calculateTabMetrics = () => {
      const containerWidth = headerContainerRef.current?.offsetWidth || 0;
      const tabWidth = containerWidth / tabs.length;
      
      const widths = labelRefs.current.map(ref => ref?.offsetWidth || 0);
      const positions = tabs.map((_, i) => i * tabWidth + (tabWidth / 2));
      
      setTabWidths(widths);
      setTabPositions(positions);
    };
    
    calculateTabMetrics();
    window.addEventListener('resize', calculateTabMetrics);
    
    return () => {
      window.removeEventListener('resize', calculateTabMetrics);
    };
  }, [tabs]);

  // Force re-render when selected tab changes to ensure indicator width updates
  useEffect(() => {
    forceUpdate({});
  }, [selectedTab]);

  // Calculate indicator position based on scroll progress
  const getIndicatorStyle = () => {
    if (tabWidths.length === 0 || tabPositions.length === 0) {
      return {
        width: labelRefs.current[selectedTab]?.offsetWidth || 'auto',
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }

    // Calculate the current position based on scroll progress
    const currentIndex = Math.floor(scrollProgress);
    const nextIndex = Math.min(currentIndex + 1, tabs.length - 1);
    const progressInCurrentTab = scrollProgress - currentIndex;
    
    // Interpolate between current and next tab positions
    const currentPos = tabPositions[currentIndex];
    const nextPos = tabPositions[nextIndex];
    const interpolatedPos = currentPos + (nextPos - currentPos) * progressInCurrentTab;
    
    // Interpolate between current and next tab widths
    const currentWidth = tabWidths[currentIndex];
    const nextWidth = tabWidths[nextIndex];
    const interpolatedWidth = currentWidth + (nextWidth - currentWidth) * progressInCurrentTab;
    
    return {
      width: `${interpolatedWidth}px`,
      left: `${interpolatedPos}px`,
      transform: 'translateX(-50%)',
      transition: 'none' // No transition during swipe
    };
  };

  return (
    <div 
      ref={headerContainerRef}
      className="flex w-full border-b sticky top-0 bg-background z-10"
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
        >
          <span ref={(el) => { labelRefs.current[index] = el; }}>{tab.label}</span>
        </button>
      ))}
      {/* Indicator that slides with swipe */}
      <div 
        className="absolute bottom-0 h-1 bg-primary rounded-full" 
        style={getIndicatorStyle()}
      />
    </div>
  );
});
TabHeaders.displayName = 'TabHeaders';

export function SwipeableTabs({
  tabs,
  defaultTabIndex = 0,
  className,
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([defaultTabIndex]));
  const [isUserSwiping, setIsUserSwiping] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(defaultTabIndex);
  
  // Optimize carousel options for performance with faster animation and no bouncing
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    skipSnaps: false, // Enable snaps for smooth sliding
    startIndex: defaultTabIndex,
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true, // Enable drag free for smoother sliding
    duration: 0, // Short animation duration for snappy feel
    breakpoints: {
      '(max-width: 768px)': { dragFree: true }
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

  // Track user interaction with the carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onPointerDown = () => setIsUserSwiping(true);
    const onPointerUp = () => setIsUserSwiping(false);
    
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);
    
    return () => {
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
    };
  }, [emblaApi]);

  // Track scroll progress for the indicator animation
  useEffect(() => {
    if (!emblaApi) return;
    
    const onScroll = () => {
      const progress = emblaApi.scrollProgress();
      const scrollProgress = progress * (tabs.length - 1);
      setScrollProgress(scrollProgress);
    };
    
    emblaApi.on('scroll', onScroll);
    
    // Initialize scroll progress
    onScroll();
    
    return () => {
      emblaApi.off('scroll', onScroll);
    };
  }, [emblaApi, tabs.length]);

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

  // Handle tab click with smooth animation
  const handleTabClick = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      
      // Use scrollTo with animation
      emblaApi.scrollTo(index);
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
        scrollProgress={scrollProgress}
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
        <div 
          className="flex" 
          style={{ 
            transition: isUserSwiping ? 'none' : 'transform 0ms ease',
            transform: 'translate3d(0, 0, 0)', // Force GPU acceleration
          }}
        >
          {tabs.map((tab, index) => (
            <div 
              key={tab.id} 
              className="min-w-0 flex-[0_0_100%]"
              style={{ 
                WebkitTapHighlightColor: 'transparent', // Remove tap highlight on mobile
                transform: 'translate3d(0, 0, 0)', // Force GPU acceleration
                backfaceVisibility: 'hidden', // Prevent flickering during animations
                willChange: 'transform', // Hint to browser to optimize
                imageRendering: 'auto', // Default image rendering
              }}
            >
              {/* Only render content if this tab is selected */}
              {loadedTabs.has(index) ? tab.content : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 