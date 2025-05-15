import React from 'react';
import Link, { LinkProps } from 'next/link';

// Add a consistent logging utility
const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📋 ${message}`, data !== undefined ? data : '');
    }
  },
  info: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`ℹ️ ${message}`, data !== undefined ? data : '');
    }
  },
  warn: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️ ${message}`, data !== undefined ? data : '');
    }
  },
  error: (message: string, error?: unknown) => {
    console.error(`❌ ${message}`, error !== undefined ? error : '');
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

// Setup intersection observer with standard 3-second delay
export function useDelayedIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
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
  const { enabled, isLoading, hasMore, delay = 3000, rootMargin = '800px', threshold = 0.1 } = options;
  const endReachedCalledRef = React.useRef(false);
  
  // Reset the endReachedCalled flag when dependencies change
  React.useEffect(() => {
    const wasEndReachedCalled = endReachedCalledRef.current;
    endReachedCalledRef.current = false;
    
    // Log when the flag is reset for better debugging
    if (wasEndReachedCalled) {
      logger.debug('🔄 Pagination flag reset - ready to load more content');
    }
  }, [hasMore, isLoading]);
  
  React.useEffect(() => {
    if (!ref.current || !enabled || !hasMore || isLoading) {
      if (!ref.current) logger.debug('⚠️ Intersection observer ref not available');
      if (!enabled) logger.debug('ℹ️ Intersection observer disabled');
      if (!hasMore) logger.debug('ℹ️ No more content to load');
      if (isLoading) logger.debug('ℹ️ Already loading content');
      return;
    }
    
    logger.debug('🔍 Setting up intersection observer with:', {
      rootMargin,
      threshold,
      delay,
      elementExists: !!ref.current
    });
    
    // Add a significant delay before setting up the intersection observer
    // This prevents the initial load from triggering pagination
    const timer = setTimeout(() => {
      // Store the reference to the DOM element to ensure it exists when observer runs
      const element = ref.current;
      
      // Skip if element no longer exists
      if (!element) {
        logger.debug('⚠️ Element no longer exists when setting up observer');
        return;
      }
      
      logger.debug('👁️ Observer active and monitoring visibility');
      
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          
          // Log intersection ratio for debugging
          logger.debug(`📊 Element intersection ratio: ${entry.intersectionRatio.toFixed(2)}`);
          
          if (entry.isIntersecting) {
            logger.debug('👁️ Load more element is now visible');
            
            if (!hasMore) {
              logger.debug('⚠️ No more content available to load');
              return;
            }
            
            if (isLoading) {
              logger.debug('⚠️ Already loading content, won\'t trigger again');
              return;
            }
            
            if (endReachedCalledRef.current) {
              logger.debug('⚠️ End reached already called, waiting for completion');
              return;
            }
            
            logger.debug('🚀 All conditions met! Triggering load more callback');
            endReachedCalledRef.current = true;
            callback();
          }
        },
        { rootMargin, threshold }
      );
      
      // Safe to observe now that we've checked it exists
      observer.observe(element);
      
      return () => {
        logger.debug('🧹 Cleaning up intersection observer');
        observer.disconnect();
      };
    }, delay); // 3 second delay to prevent initial page load triggering
    
    return () => {
      logger.debug('🧹 Clearing delayed observer timer');
      clearTimeout(timer);
    };
  }, [ref, enabled, hasMore, isLoading, callback, delay, rootMargin, threshold]);
} 