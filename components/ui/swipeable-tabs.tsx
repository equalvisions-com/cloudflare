'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Virtuoso } from 'react-virtuoso';
import './swipeable-tabs.css';

interface SwipeableTabsProps {
  tabs: {
    id: string;
    label: string;
    content: React.ReactNode;
  }[];
  defaultTabIndex?: number;
  className?: string;
  animationDuration?: number;
  onTabChange?: (index: number) => void;
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

export function SwipeableTabs({
  tabs,
  defaultTabIndex = 0,
  className,
  onTabChange,
}: SwipeableTabsProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTabIndex);
  const [isMobile, setIsMobile] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const lastTouchXRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartTimeRef = useRef(0);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((index: number) => {
    setSelectedTab(index);
    if (onTabChange) {
      onTabChange(index);
    }
  }, [onTabChange]);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isMobile) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
    lastTouchXRef.current = e.touches[0].clientX;
    isScrollingRef.current = false;
  }, [isMobile]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isMobile || isScrollingRef.current) return;
    
    const touchX = e.touches[0].clientX;
    const deltaX = touchX - lastTouchXRef.current;
    lastTouchXRef.current = touchX;

    if (Math.abs(deltaX) > Math.abs(e.touches[0].clientY - touchStartXRef.current)) {
      e.preventDefault();
    }
  }, [isMobile]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isMobile || isScrollingRef.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartXRef.current;
    const timeDelta = Date.now() - touchStartTimeRef.current;
    const velocity = Math.abs(deltaX) / timeDelta;

    if (Math.abs(deltaX) > 50 || velocity > 0.5) {
      if (deltaX > 0 && selectedTab > 0) {
        handleTabChange(selectedTab - 1);
      } else if (deltaX < 0 && selectedTab < tabs.length - 1) {
        handleTabChange(selectedTab + 1);
      }
    }
  }, [isMobile, selectedTab, tabs.length, handleTabChange]);

  // Add touch event listeners
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.addEventListener('touchstart', handleTouchStart);
    scroller.addEventListener('touchmove', handleTouchMove, { passive: false });
    scroller.addEventListener('touchend', handleTouchEnd);

    return () => {
      scroller.removeEventListener('touchstart', handleTouchStart);
      scroller.removeEventListener('touchmove', handleTouchMove);
      scroller.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div className={cn('w-full h-full', className)}>
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTab} 
        onTabClick={handleTabChange} 
      />

      <div ref={scrollerRef} className="w-full">
        {isMobile ? (
          <div className="swipeable-container">
            <div 
              className="swipeable-content" 
              style={{ transform: `translateX(-${selectedTab * 100}%)` }}
            >
              {tabs.map((tab, index) => (
                <div key={tab.id} className="swipeable-slide">
                  <Virtuoso
                    useWindowScroll
                    totalCount={1}
                    itemContent={() => tab.content}
                    overscan={200}
                    style={{ height: '100%', width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          tabs.map((tab, index) => (
            selectedTab === index && (
              <div key={tab.id} className="w-full">
                <Virtuoso
                  useWindowScroll
                  totalCount={1}
                  itemContent={() => tab.content}
                  overscan={200}
                />
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
} 