import React from 'react';
import Link, { LinkProps } from 'next/link';

// Add a consistent logging utility
const logger = {
  debug: (message: string, data?: unknown) => {
    // Debug logging removed for production
  },
  info: (message: string, data?: unknown) => {
    // Info logging removed for production
  },
  warn: (message: string, data?: unknown) => {
    // Warning logging removed for production
  },
  error: (message: string, error?: unknown) => {
    // Error logging removed for production
  }
};

// Prevent focus wrapper for interactive elements
export function NoFocusWrapper({
  onClick,
  className,
  children,
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={className}
      onMouseDown={(e) => e.preventDefault()}   // kill focus
      onClick={onClick}
    >
      {children}                               
    </div>
  );
}

// For wrapping links with divs
export function NoFocusLinkWrapper({
  onClick,
  className,
  children,
  onTouchStart,
}: {
  onClick?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className}
      onMouseDown={(e) => e.preventDefault()}  // kill focus
      onClick={onClick}
      onTouchStart={onTouchStart}
    >
      {children}  
    </div>
  );
}

// Setup standard document handlers for focus prevention
export function useFeedFocusPrevention(isActive = true, containerSelector = '.feed-container') {
  // Add a ref to track the previous state of isActive to detect changes
  const isActiveRef = React.useRef(isActive);

  React.useEffect(() => {
    // Log state changes for debugging
    if (isActiveRef.current !== isActive) {
      logger.debug(`Focus prevention ${isActive ? 'enabled' : 'disabled'}`);
      isActiveRef.current = isActive;
    }

    // Early return if not active - important for cleanup
    if (!isActive) return;
    
    // Define handler for mousedown events - capture in the capture phase before focus can happen
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if the target is in a drawer content or is a text input/textarea
      const isInDrawer = target.closest('[data-drawer-content]') || 
                         target.closest('[role="dialog"]');
      const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
                         
      // Check if element is a comment input
      const isCommentInput = target.closest('[data-comment-input]');
                         
      // Skip focus prevention for drawer content, input fields, or comment inputs
      if (isInDrawer || isInputField || isCommentInput) {
        return;
      }
      
      // If the target is inside our feed container, prevent focus behavior
      const isInFeed = target.closest(containerSelector);
      if (isInFeed) {
        // Prevent default focus behavior
        e.preventDefault();
        e.stopPropagation();
        
        // Actively remove focus from any element that might have received it
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    
    // Define a handler for all click events in the feed to prevent focus
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Skip focus prevention for drawer content, input fields, or comment inputs
      const isInDrawer = target.closest('[data-drawer-content]') || 
                         target.closest('[role="dialog"]');
      const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
      const isCommentInput = target.closest('[data-comment-input]');
                         
      if (isInDrawer || isInputField || isCommentInput) {
        return;
      }
      
      // Only apply to elements inside our list
      const isInFeed = target.closest(containerSelector);
      if (!isInFeed) return;
      
      // For any element in the feed, clear focus after click completes
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
    
    // Add passive scroll handler to improve performance
    const handleScroll = () => {
      // Check if focus prevention is still active before blurring
      // This helps with race conditions when the drawer opens
      if (!isActiveRef.current) return;

      // Clear any focus that might have been set during scroll
      if (document.activeElement instanceof HTMLElement && 
          document.activeElement.tagName !== 'BODY') {
        // Don't blur input elements, elements in drawers, or comment inputs
        const isInDrawer = document.activeElement.closest('[data-drawer-content]') || 
                           document.activeElement.closest('[role="dialog"]');
        const isInputField = document.activeElement.tagName === 'INPUT' || 
                           document.activeElement.tagName === 'TEXTAREA' || 
                           document.activeElement.isContentEditable;
        const isCommentInput = document.activeElement.closest('[data-comment-input]');
                           
        if (!isInDrawer && !isInputField && !isCommentInput) {
          document.activeElement.blur();
        }
      }
    };
    
    // Use capture phase to intercept before default browser behavior
    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    document.addEventListener('click', handleDocumentClick, true);
    // Passive event listener improves scroll performance
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      // Always clean up event listeners
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [isActive, containerSelector]); // Both dependencies are important
}

// Setup intersection observer with standard 1-second delay
export function useDelayedIntersectionObserver(
  ref: React.RefObject<HTMLElement | null>,
  callback: () => void,
  options: {
    enabled: boolean;
    isLoading: boolean;
    hasMore: boolean;
    delay?: number;
    rootMargin?: string;
    threshold?: number;
  }
) {
  // IMPROVED: Increased rootMargin from 300px to 800px to trigger loading much earlier
  // This prevents the user from seeing the bottom of the content before new items load
  const { enabled, isLoading, hasMore, delay = 1000, rootMargin = '800px', threshold = 0.1 } = options;
  
  // CRITICAL FIX: Move endReachedCalledRef outside the effect so it persists across observer recreations
  const endReachedCalledRef = React.useRef(false);
  
  // CRITICAL FIX: Use refs for hasMore and isLoading to avoid stale closures in intersection callback
  const hasMoreRef = React.useRef(hasMore);
  const isLoadingRef = React.useRef(isLoading);
  
  // Update refs synchronously during render (React best practice)
  hasMoreRef.current = hasMore;
  isLoadingRef.current = isLoading;
  
  // Reset the endReachedCalled flag when dependencies change
  React.useEffect(() => {
    endReachedCalledRef.current = false;
  }, [hasMore, isLoading, callback]);
  
  React.useEffect(() => {
    if (!ref.current || !enabled || !hasMore || isLoading) {
      return;
    }
    
    // CRITICAL FIX: Reset the flag when setting up a new observer
    // This ensures we don't carry over the flag state from previous observer instances
    if (endReachedCalledRef.current) {
      endReachedCalledRef.current = false;
    }
    
    // Add a significant delay before setting up the intersection observer
    // This prevents the initial load from triggering pagination
    const timer = setTimeout(() => {
      // Store the reference to the DOM element to ensure it exists when observer runs
      const element = ref.current;
      
      // Skip if element no longer exists
      if (!element) {
        return;
      }
      
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          
          if (entry.isIntersecting) {
            // CRITICAL FIX: Use refs to avoid stale closure values
            const currentHasMore = hasMoreRef.current;
            const currentIsLoading = isLoadingRef.current;
            const currentEndReached = endReachedCalledRef.current;
            
            if (!currentHasMore || currentIsLoading || currentEndReached) {
              return;
            }
            
            endReachedCalledRef.current = true;
            callback();
          }
        },
        { rootMargin, threshold }
      );
      
      // Safe to observe now that we've checked it exists
      observer.observe(element);
      
      return () => {
        observer.disconnect();
      };
    }, delay); // Universal 1-second delay to prevent initial page load triggering
    
    return () => {
      clearTimeout(timer);
    };
  }, [ref, enabled, hasMore, isLoading, callback, delay, rootMargin, threshold]);
} 