import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { 
  ConvexNotificationItem, 
  NotificationsVirtualizationConfig,
  UseNotificationsVirtualizationProps,
  UseNotificationsVirtualizationReturn
} from '@/lib/types';

// Optimized configuration for 100k users
const defaultConfig: NotificationsVirtualizationConfig = {
  itemHeight: 80,
  overscan: 10, // Increased for smoother scrolling with large lists
  scrollSeekConfiguration: {
    enter: (velocity) => Math.abs(velocity) > 150, // More aggressive scroll seeking
    exit: (velocity) => Math.abs(velocity) < 50,   // Better exit threshold
  },
  debounceMs: 50, // Reduced debounce for more responsive UX
};

export function useNotificationsVirtualization({
  notifications,
  isLoading,
  hasMore,
  nextCursor,
  loadMore,
  config = {},
}: UseNotificationsVirtualizationProps): UseNotificationsVirtualizationReturn {
  const mergedConfig = { ...defaultConfig, ...config };
  
  // Refs
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const endReachedCalledRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // State
  const [isPaginating, setIsPaginating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Reset pagination state when notifications reset
  useEffect(() => {
    if (notifications.length === 0) {
      setCurrentPage(1);
      endReachedCalledRef.current = false;
    }
  }, [notifications.length]);
  
  // Memoize virtualized notifications for performance
  const virtualizedNotifications = useMemo(() => {
    return notifications;
  }, [notifications]);
  

  
  // Setup intersection observer for automatic loading - StrictMode compliant
  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    // Define load more logic inside effect to avoid function dependencies
    const handleLoadMoreInternal = async () => {
      if (!hasMore || isLoading || isPaginating || endReachedCalledRef.current) {
        return;
      }
      
      endReachedCalledRef.current = true;
      setIsPaginating(true);
      
      try {
        await loadMore(nextCursor || undefined);
        setCurrentPage(prev => prev + 1);
      } catch (error) {
        // Error handling - could add error state here if needed
      } finally {
        if (isMountedRef.current) {
          setIsPaginating(false);
          // Reset the flag after a delay to allow for new load more attempts
          setTimeout(() => {
            endReachedCalledRef.current = false;
          }, 1000);
        }
      }
    };
    
    let observer: IntersectionObserver | null = null;
    
    observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading && !isPaginating && !endReachedCalledRef.current) {
          handleLoadMoreInternal();
        }
      },
      { 
        rootMargin: '200px',
        threshold: 0.1
      }
    );
    
    observer.observe(loadMoreRef.current);
    
    return () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };
  }, [hasMore, isLoading, isPaginating, nextCursor, loadMore]);
  
  // Navigation utilities
  const scrollToTop = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'smooth' });
  }, []);
  
  const scrollToNotification = useCallback((notificationId: string) => {
    const index = virtualizedNotifications.findIndex(
      (notification: ConvexNotificationItem) => notification.friendship._id === notificationId
    );
    if (index !== -1) {
      virtuosoRef.current?.scrollToIndex({ index, behavior: 'smooth' });
    }
  }, [virtualizedNotifications]);
  
  // Optimized Virtuoso configuration for large lists
  const virtuosoProps = useMemo(() => ({
    useWindowScroll: true,
    overscan: mergedConfig.overscan,
    increaseViewportBy: { top: 800, bottom: 800 }, // Increased for better performance
    scrollSeekConfiguration: mergedConfig.scrollSeekConfiguration,
    style: { 
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
      willChange: 'transform', // Optimize for scroll performance
    },
    className: "focus:outline-none focus-visible:outline-none",
    computeItemKey: (index: number, item: ConvexNotificationItem) => item.friendship._id,
    // Performance optimizations
    fixedItemHeight: mergedConfig.itemHeight,
    defaultItemHeight: mergedConfig.itemHeight,
  }), [mergedConfig.overscan, mergedConfig.scrollSeekConfiguration, mergedConfig.itemHeight]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  return {
    virtuosoRef,
    virtuosoProps,
    virtualizedNotifications,
    loadMoreRef,
    isPaginating,
    scrollToTop,
    scrollToNotification,
    totalCount: virtualizedNotifications.length,
    currentPage,
  };
} 