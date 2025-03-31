'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSwipeableTabs } from './swipeable-tabs';
import { cn } from '@/lib/utils';

interface FeedSwipeableWrapperProps {
  children: React.ReactNode;
  className?: string;
  isVisible?: boolean;
}

const MOBILE_BREAKPOINT = 768;
const SWIPE_THRESHOLD = 50; // Minimum pixels to trigger a tab change
const SWIPE_FACTOR = 0.3; // Percentage of screen width to trigger tab change

/**
 * Wrapper component that adds horizontal swipe gestures to feed content
 * to trigger tab changes in the parent SwipeableTabs component.
 */
export function FeedSwipeableWrapper({
  children,
  className,
  isVisible = true,
}: FeedSwipeableWrapperProps) {
  const { scrollToTab, selectedTab, totalTabs } = useSwipeableTabs();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Check for mobile viewport on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate the minimum swipe distance based on screen width
  const getSwipeThreshold = useCallback(() => {
    if (!containerRef.current) return SWIPE_THRESHOLD;
    const width = containerRef.current.offsetWidth;
    return Math.max(SWIPE_THRESHOLD, width * SWIPE_FACTOR);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isVisible) return;
    
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, [isMobile, isVisible]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Prevent default only for horizontal swipes
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartXRef.current);
    const deltaY = Math.abs(touch.clientY - touchStartYRef.current);
    
    // If horizontal movement is significantly greater than vertical, prevent default
    if (deltaX > deltaY * 1.5 && deltaX > 10) {
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (
      !isMobile || 
      !isVisible || 
      touchStartXRef.current === null || 
      touchStartYRef.current === null
    ) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = Math.abs(touch.clientY - touchStartYRef.current);
    const threshold = getSwipeThreshold();
    
    // Only trigger tab change if horizontal movement is greater than threshold
    // and vertical movement is relatively small
    if (Math.abs(deltaX) > threshold && deltaY < threshold * 0.8) {
      if (deltaX < 0 && selectedTab < totalTabs - 1) {
        // Swipe left, go to next tab
        scrollToTab(selectedTab + 1);
      } else if (deltaX > 0 && selectedTab > 0) {
        // Swipe right, go to previous tab
        scrollToTab(selectedTab - 1);
      }
    }
    
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }, [isMobile, isVisible, selectedTab, totalTabs, scrollToTab, getSwipeThreshold]);

  // Skip event binding if not mobile or not visible
  if (!isMobile || !isVisible) {
    return (
      <div className={cn('feed-swipeable-container', className)} ref={containerRef}>
        {children}
      </div>
    );
  }

  return (
    <div 
      className={cn('feed-swipeable-container', className)} 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="feed-swipeable-content">
        {children}
      </div>
    </div>
  );
} 