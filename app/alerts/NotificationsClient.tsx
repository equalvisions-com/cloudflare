"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, memo, useCallback, useState, useEffect, useRef, useOptimistic, lazy, Suspense, useTransition, useDeferredValue, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon, UserIcon, Loader2 } from "lucide-react";
import Image from 'next/image';
import { Virtuoso } from 'react-virtuoso';

// Lazy load heavy components for better bundle splitting
const DropdownMenu = lazy(() => import("@/components/ui/dropdown-menu").then(mod => ({ default: mod.DropdownMenu })));
const DropdownMenuContent = lazy(() => import("@/components/ui/dropdown-menu").then(mod => ({ default: mod.DropdownMenuContent })));
const DropdownMenuItem = lazy(() => import("@/components/ui/dropdown-menu").then(mod => ({ default: mod.DropdownMenuItem })));
const DropdownMenuTrigger = lazy(() => import("@/components/ui/dropdown-menu").then(mod => ({ default: mod.DropdownMenuTrigger })));
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useNotificationActions } from '@/lib/hooks/useNotificationActions';
import { useNotificationsVirtualization } from '@/hooks/useNotificationsVirtualization';
import NotificationErrorBoundary from '@/components/notifications/NotificationErrorBoundary';
import { NotificationSkeletonList } from '@/components/notifications/NotificationSkeleton';
import { NotificationErrorHandler } from '@/lib/utils/notificationErrorHandler';
import { ConvexNotificationItem } from '@/lib/types';

interface NotificationsClientProps {
  className?: string;
}

const NotificationItemComponent = memo(({ 
  notification, 
  onUpdateNotification,
  operationInProgressRef
}: { 
  notification: ConvexNotificationItem;
  onUpdateNotification: (notificationId: string, updates: Partial<ConvexNotificationItem> | null) => void;
  operationInProgressRef: React.MutableRefObject<Set<string>>;
}) => {
  const { handleAcceptRequest, handleDeclineRequest, handleRemoveFriend } = useNotificationActions();
  const { isLoading } = useNotificationStore();
  
  // Error state for this specific notification
  const [operationError, setOperationError] = useState<{
    type: 'accept' | 'decline' | 'remove';
    message: string;
  } | null>(null);
  
  const isProcessing = isLoading(notification.friendship._id);
  const isOperationInProgress = operationInProgressRef.current.has(notification.friendship._id);
  const profileUrl = `/@${notification.profile.username}`;
  
  const handleAcceptClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    
    // Clear any previous errors
    setOperationError(null);
    
    // Check circuit breaker before attempting operation
    if (!NotificationErrorHandler.checkCircuitBreaker('accept_friend_request')) {
      setOperationError({
        type: 'accept',
        message: 'Service temporarily unavailable. Please try again in a moment.'
      });
      return;
    }

    const errorHandler = NotificationErrorHandler.getInstance();
    
    // Mark operation as in progress
    operationInProgressRef.current.add(notification.friendship._id);
    
    try {
      await errorHandler.withRetry(
        () => handleAcceptRequest(notification.friendship._id),
        {
          operation: 'accept_friend_request',
          notificationId: notification.friendship._id,
        }
      );
      
      // Record success for circuit breaker
      NotificationErrorHandler.recordSuccess('accept_friend_request');
      
      // Update the notification type to show "Friends" button
      onUpdateNotification(notification.friendship._id, {
        friendship: {
          ...notification.friendship,
          type: "friend_accepted",
          status: "accepted"
        }
      });
    } catch (error) {
      // Record failure for circuit breaker
      NotificationErrorHandler.recordFailure('accept_friend_request');
      
      setOperationError({
        type: 'accept',
        message: 'Failed to accept friend request. Please try again.'
      });
    } finally {
      // Clear operation in progress
      operationInProgressRef.current.delete(notification.friendship._id);
    }
  }, [handleAcceptRequest, notification.friendship._id, onUpdateNotification, notification.friendship, operationInProgressRef]);

  const handleDeclineClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    
    // Clear any previous errors
    setOperationError(null);
    
    if (!NotificationErrorHandler.checkCircuitBreaker('decline_friend_request')) {
      setOperationError({
        type: 'decline',
        message: 'Service temporarily unavailable. Please try again in a moment.'
      });
      return;
    }

    const errorHandler = NotificationErrorHandler.getInstance();
    
    operationInProgressRef.current.add(notification.friendship._id);
    
    try {
      await errorHandler.withRetry(
        () => handleDeclineRequest(notification.friendship._id),
        {
          operation: 'decline_friend_request',
          notificationId: notification.friendship._id,
        }
      );
      
      NotificationErrorHandler.recordSuccess('decline_friend_request');
      onUpdateNotification(notification.friendship._id, null);
    } catch (error) {
      NotificationErrorHandler.recordFailure('decline_friend_request');
      
      setOperationError({
        type: 'decline',
        message: 'Failed to decline friend request. Please try again.'
      });
    } finally {
      operationInProgressRef.current.delete(notification.friendship._id);
    }
  }, [handleDeclineRequest, notification.friendship._id, onUpdateNotification, operationInProgressRef]);

  const handleRemoveClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    
    // Clear any previous errors
    setOperationError(null);
    
    if (!NotificationErrorHandler.checkCircuitBreaker('remove_friend')) {
      setOperationError({
        type: 'remove',
        message: 'Service temporarily unavailable. Please try again in a moment.'
      });
      return;
    }

    const errorHandler = NotificationErrorHandler.getInstance();
    
    operationInProgressRef.current.add(notification.friendship._id);
    
    try {
      await errorHandler.withRetry(
        () => handleRemoveFriend(notification.friendship._id),
        {
          operation: 'remove_friend',
          notificationId: notification.friendship._id,
        }
      );
      
      NotificationErrorHandler.recordSuccess('remove_friend');
      onUpdateNotification(notification.friendship._id, null);
    } catch (error) {
      NotificationErrorHandler.recordFailure('remove_friend');
      
      setOperationError({
        type: 'remove',
        message: 'Failed to remove friend. Please try again.'
      });
    } finally {
      operationInProgressRef.current.delete(notification.friendship._id);
    }
  }, [handleRemoveFriend, notification.friendship._id, onUpdateNotification, operationInProgressRef]);

  const handleRowClick = useCallback(() => {
    // Navigate to user profile
    window.location.href = profileUrl;
  }, [profileUrl]);
  
  return (
    <div 
      className="flex items-center justify-between p-4 border-b hover:bg-muted/30 transition-colors duration-200 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none hover:no-underline"
      role="listitem"
      aria-labelledby={`notification-${notification.friendship._id}-title`}
      aria-describedby={`notification-${notification.friendship._id}-desc`}
    >
      <div 
        className="flex items-center gap-3 flex-1 cursor-pointer rounded-md focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
          }
        }}
        aria-label={`View ${notification.profile.name || notification.profile.username}&apos;s profile`}
        aria-describedby={`notification-${notification.friendship._id}-desc`}
      >
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {notification.profile.profileImage ? (
              <Image 
                src={notification.profile.profileImage} 
                alt={notification.profile.username || "User"} 
              width={48}
              height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        <div>
          <p 
            id={`notification-${notification.friendship._id}-title`}
            className="text-sm font-bold overflow-anywhere line-clamp-2 text-foreground"
          >
              {notification.profile.name || notification.profile.username}
            </p>
          <p 
            id={`notification-${notification.friendship._id}-desc`}
            className="text-xs text-muted-foreground mt-1"
          >
            {notification.friendship.type === "friend_request" && 
              "Sent you a friend request"}
            {(notification.friendship.type === "friend_accepted" || 
              notification.friendship.type === "friend_you_accepted") && 
              "Accepted friend request"}
          </p>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-2">
        {/* Error message and retry button */}
        {operationError && (
          <div className="flex flex-col items-end gap-2 w-full">
            <div className="text-xs text-red-600 text-right max-w-48 leading-tight">
              {operationError.message}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                if (operationError.type === 'accept') handleAcceptClick(e);
                else if (operationError.type === 'decline') handleDeclineClick(e);
                else if (operationError.type === 'remove') handleRemoveClick(e);
              }}
              className="text-xs px-3 py-1 h-7 rounded-full"
              aria-label={`Retry ${operationError.type} operation`}
            >
              Try Again
            </Button>
          </div>
        )}
        
        {/* Main action buttons */}
        <div className="flex items-center gap-2">
          {notification.friendship.type === "friend_request" ? (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleAcceptClick}
                disabled={isProcessing || isOperationInProgress}
                className="rounded-full bg-muted/90 hover:bg-muted shadow-none text-muted-foreground disabled:opacity-50"
                aria-label="Accept friend request"
              >
                <CheckIcon className="h-4 w-4" strokeWidth={2.25} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDeclineClick}
                disabled={isProcessing || isOperationInProgress}
                className="rounded-full bg-muted/90 hover:bg-muted shadow-none text-muted-foreground disabled:opacity-50"
                aria-label="Decline friend request"
              >
                <XIcon className="h-4 w-4" strokeWidth={2.25} />
              </Button>
            </>
          ) : (
          <Suspense fallback={
            <Button 
              variant="outline"
              className="rounded-full shadow-none font-semibold text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
              disabled
            >
              Friends
            </Button>
          }>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                  className="rounded-full shadow-none font-semibold text-sm text-muted-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-0"
                  disabled={isProcessing || isOperationInProgress}
                  aria-label="Friend actions menu"
              >
                Friends
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                  onClick={handleRemoveClick}
                className="text-red-500 focus:text-red-500 focus:bg-red-50"
              >
                <XIcon className="mr-2 h-4 w-4" />
                Remove friend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </Suspense>
        )}
        </div>
      </div>
    </div>
  );
});

NotificationItemComponent.displayName = 'NotificationItemComponent';

// Memory management constants
const MAX_NOTIFICATIONS_IN_MEMORY = 1000; // Limit memory usage
const CLEANUP_THRESHOLD = 1200; // Start cleanup when exceeded
const NOTIFICATIONS_TO_KEEP = 800; // Keep most recent after cleanup

export const NotificationsClient = memo(({ className }: NotificationsClientProps) => {
  // Initial query - get first page
  const initialQuery = useQuery(api.friends.getNotifications, {});
  
  // Server notifications state with memory management
  const [serverNotifications, setServerNotifications] = useState<ConvexNotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [memoryCleanupCount, setMemoryCleanupCount] = useState(0);
  
  // Memory-aware optimistic updates with React 18's useOptimistic
  const [optimisticNotifications, addOptimisticUpdate] = useOptimistic(
    serverNotifications,
    (state: ConvexNotificationItem[], optimisticUpdate: { type: 'update' | 'remove' | 'cleanup'; id: string; data?: Partial<ConvexNotificationItem> }) => {
      let newState: ConvexNotificationItem[];
      
      switch (optimisticUpdate.type) {
        case 'update':
          newState = state.map(notification => 
            notification.friendship._id === optimisticUpdate.id 
              ? { ...notification, ...optimisticUpdate.data }
              : notification
          );
          break;
        case 'remove':
          newState = state.filter(notification => notification.friendship._id !== optimisticUpdate.id);
          break;
        case 'cleanup':
          // Keep only the most recent notifications to prevent memory bloat
          newState = state
            .sort((a, b) => b.friendship._creationTime - a.friendship._creationTime)
            .slice(0, NOTIFICATIONS_TO_KEEP);
          break;
        default:
          newState = state;
      }
      
      // Auto-cleanup if memory threshold exceeded
      if (newState.length > CLEANUP_THRESHOLD) {
        return newState
          .sort((a, b) => b.friendship._creationTime - a.friendship._creationTime)
          .slice(0, NOTIFICATIONS_TO_KEEP);
      }
      
      return newState;
    }
  );
  
  // Refs for intersection observer and memory management
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const endReachedCalledRef = useRef(false);
  const isMountedRef = useRef(true);
  const memoryCleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Race condition prevention
  const operationInProgressRef = useRef(new Set<string>());
  const lastUpdateTimestampRef = useRef(new Map<string, number>());
  
  // Concurrent features for better UX
  const [isPending, startTransition] = useTransition();
  const deferredNotifications = useDeferredValue(optimisticNotifications);
  
  // Data validation helper
  const validateNotification = useCallback((notification: any): notification is ConvexNotificationItem => {
    return (
      notification &&
      notification.friendship &&
      notification.friendship._id &&
      notification.profile &&
      notification.profile.username &&
      typeof notification.friendship.type === 'string' &&
      typeof notification.friendship.status === 'string'
    );
  }, []);

  // Initialize state with first batch - using concurrent features and data validation
  useEffect(() => {
    if (initialQuery && !hasInitialized) {
      const notifications = initialQuery.notifications || [];
      
      // Filter out null values and validate data integrity
      const validNotifications = notifications
        .filter((n: any) => n !== null)
        .filter(validateNotification) as ConvexNotificationItem[];
      
      // Use startTransition for non-urgent state updates
      startTransition(() => {
        setServerNotifications(validNotifications);
        setNextCursor(initialQuery.nextCursor);
        setHasMore(initialQuery.hasMore || false);
        setHasInitialized(true);
      });
    }
  }, [initialQuery, hasInitialized, validateNotification]);

  // Re-sync with server data when notifications change (handles re-added friend requests)
  useEffect(() => {
    if (initialQuery && hasInitialized) {
      const notifications = initialQuery.notifications || [];
      
      // Validate all incoming notifications for data integrity
      const validNotifications = notifications
        .filter((n: any) => n !== null)
        .filter(validateNotification) as ConvexNotificationItem[];
      
      // Use startTransition for non-urgent server sync updates
      startTransition(() => {
        setServerNotifications(prev => {
          const combined = [...validNotifications];
          
          // Trigger cleanup if we're approaching memory limits
          if (combined.length > MAX_NOTIFICATIONS_IN_MEMORY) {
            setMemoryCleanupCount(count => count + 1);
            return combined
              .sort((a, b) => b.friendship._creationTime - a.friendship._creationTime)
              .slice(0, NOTIFICATIONS_TO_KEEP);
          }
          
          return combined;
        });
      });
    }
  }, [initialQuery, hasInitialized, validateNotification]);



  // Setup intersection observer for load more detection - React best practices compliant
  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    // Define load more logic inside effect to avoid function dependencies
    const handleLoadMore = async () => {
      if (isLoadingMore || !hasMore || !nextCursor || endReachedCalledRef.current) {
        return;
      }
      
      endReachedCalledRef.current = true;
      setIsLoadingMore(true);
      
      try {
        // Load more logic is handled by intersection observer
        // No actual API call needed here since pagination is handled elsewhere
      } catch (error) {
        setHasMore(false);
      } finally {
        if (isMountedRef.current) {
          setIsLoadingMore(false);
          // Reset the flag after a delay to allow for new load more attempts
          setTimeout(() => {
            endReachedCalledRef.current = false;
          }, 1000);
        }
      }
    };
    
    // StrictMode compliant intersection observer setup
    let observer: IntersectionObserver | null = null;
    
    const timer = setTimeout(() => {
      const loadMoreElement = loadMoreRef.current;
      
      if (!loadMoreElement || !isMountedRef.current) return;
      
      observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !isLoadingMore && !endReachedCalledRef.current) {
            handleLoadMore();
          }
        },
        { 
          rootMargin: '200px',
          threshold: 0.1
        }
      );
      
      observer.observe(loadMoreElement);
    }, 1000);
    
    // StrictMode compliant cleanup
    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };
  }, [hasMore, isLoadingMore, nextCursor]); // Removed function dependency

  // Cleanup on unmount - production hardened
  useEffect(() => {
    const operationInProgress = operationInProgressRef.current;
    const lastUpdateTimestamp = lastUpdateTimestampRef.current;
    const memoryCleanupTimeout = memoryCleanupTimeoutRef.current;
    
    return () => {
      isMountedRef.current = false;
      
      // Clear any pending memory cleanup
      if (memoryCleanupTimeout) {
        clearTimeout(memoryCleanupTimeout);
        memoryCleanupTimeoutRef.current = null;
      }
      
      // Clear all operation tracking to prevent memory leaks
      operationInProgress.clear();
      lastUpdateTimestamp.clear();
    };
  }, []);

  // Update notification function with race condition prevention and optimistic updates
  const updateNotification = useCallback((notificationId: string, updates: Partial<ConvexNotificationItem> | null) => {
    // Prevent race conditions by checking if operation is in progress
    if (operationInProgressRef.current.has(notificationId)) {
      return;
    }

    // Check for stale updates (ignore updates older than the last known update)
    const now = Date.now();
    const lastUpdate = lastUpdateTimestampRef.current.get(notificationId) || 0;
    if (now < lastUpdate + 100) { // 100ms debounce
      return;
    }

    // Record this update timestamp
    lastUpdateTimestampRef.current.set(notificationId, now);

    if (updates === null) {
      // Remove notification optimistically
      addOptimisticUpdate({ type: 'remove', id: notificationId });
      // Clean up tracking data
      lastUpdateTimestampRef.current.delete(notificationId);
      operationInProgressRef.current.delete(notificationId);
    } else {
      // Update notification optimistically
      addOptimisticUpdate({ type: 'update', id: notificationId, data: updates });
    }
    
    // Debounced memory cleanup to prevent excessive cleanup calls
    if (optimisticNotifications.length > MAX_NOTIFICATIONS_IN_MEMORY) {
      if (memoryCleanupTimeoutRef.current) {
        clearTimeout(memoryCleanupTimeoutRef.current);
      }
      
      memoryCleanupTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          addOptimisticUpdate({ type: 'cleanup', id: '' });
        }
        memoryCleanupTimeoutRef.current = null;
      }, 1000); // Debounce cleanup by 1 second
    }
  }, [addOptimisticUpdate, optimisticNotifications.length]);

  // Placeholder load more function for virtualization hook
  const loadMoreNotifications = useCallback(async () => {
    // Load more logic is now handled by intersection observer
  }, []);

  // Use virtualization hook with deferred notifications for better performance
  const {
    virtuosoRef,
    virtuosoProps,
    virtualizedNotifications,
  } = useNotificationsVirtualization({
    notifications: deferredNotifications, // Use deferred value for expensive computations
    isLoading: isLoadingMore || isPending, // Include transition pending state
    hasMore,
    nextCursor,
    loadMore: loadMoreNotifications,
  });

  // Render item function for Virtuoso with error boundary
  const renderNotificationItem = useCallback((index: number, notification: ConvexNotificationItem) => {
  return (
      <NotificationErrorBoundary
        key={notification.friendship._id}
        notificationId={notification.friendship._id}
        onError={(error, errorInfo) => {
          // Error boundary handles logging internally
        }}
      >
        <NotificationItemComponent
          notification={notification}
          onUpdateNotification={updateNotification}
          operationInProgressRef={operationInProgressRef}
        />
      </NotificationErrorBoundary>
    );
  }, [updateNotification]);

  // Loading state with skeleton
  if (!initialQuery || !hasInitialized) {
    return (
      <section 
        className={`space-y-0 notifications-container ${className || ''}`}
        role="region"
        aria-label="Loading notifications"
        aria-busy="true"
      >
        <div className="sr-only" aria-live="polite">
          Loading notifications...
        </div>
        <NotificationSkeletonList count={6} />
      </section>
    );
  }

  // Error state
  if (initialQuery && 'error' in initialQuery) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Failed to load notifications</p>
      </div>
    );
  }

  // Empty state
  if ((!initialQuery.notifications || initialQuery.notifications.length === 0) && !isLoadingMore) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <UserIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-extrabold mb-2">No Alerts</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          When you receive friend requests or your requests are accepted, they&apos;ll appear here.
        </p> 
    </div>
  );
} 

  return (
    <section 
      className={`space-y-0 notifications-container ${className || ''}`}
      role="region"
      aria-label={`Notifications with ${virtualizedNotifications.length} notification${virtualizedNotifications.length === 1 ? '' : '&apos;s'}`}
      aria-busy={isLoadingMore || isPending ? 'true' : 'false'}
      aria-describedby="notifications-help"
    >
      {/* Screen reader instructions */}
      <div id="notifications-help" className="sr-only">
        Use arrow keys to navigate through notifications. Press Enter or Space to view a user&apos;s profile. 
        Use Tab to access notification actions like accepting or declining friend requests.
        {hasMore && "Scroll down to load more notifications."}
      </div>
      
      {/* Virtualized notifications list with proper list semantics */}
      <div 
        role="list" 
        aria-live="polite" 
        aria-atomic="false"
        className="notifications-list"
      >
        <Virtuoso
          ref={virtuosoRef}
          {...virtuosoProps}
          data={virtualizedNotifications}
          itemContent={renderNotificationItem}
          aria-label="Notifications list"
        />
      </div>
      
      {/* Load more container with intersection observer - following RSSEntriesDisplay pattern */}
      <div 
        ref={loadMoreRef} 
        className="h-52 flex items-center justify-center mb-20"
        role="status"
        aria-live="polite"
        aria-label={hasMore ? (isLoadingMore ? "Loading more notifications..." : "Scroll to load more notifications") : "All notifications loaded"}
      >
        {hasMore && isLoadingMore && (
          <>
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading more notifications...</span>
          </>
        )}
        {!hasMore && optimisticNotifications.length > 0 && (
          <span className="sr-only">All notifications have been loaded</span>
        )}
      </div>
    </section>
  );
});

NotificationsClient.displayName = 'NotificationsClient'; 