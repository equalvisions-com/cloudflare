import { useRef, useCallback } from 'react';

/**
 * Custom hook for managing memory leaks and cleanup in RSS Entries Display
 * Follows React best practices - no useEffect for non-external synchronization
 */
export const useRSSEntriesMemoryManagement = () => {
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Memory leak prevention - store active timeouts for cleanup
  const activeTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  
  // Helper function to create managed timeouts
  const createManagedTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      activeTimeoutsRef.current.delete(timeoutId);
      if (isMountedRef.current) {
        callback();
      }
    }, delay);
    
    activeTimeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);
  
  // Helper function to clear managed timeout
  const clearManagedTimeout = useCallback((timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    activeTimeoutsRef.current.delete(timeoutId);
  }, []);

  // Cleanup function to be called by parent component
  const cleanup = useCallback(() => {
    isMountedRef.current = false;
    
    // Clear all active timeouts to prevent memory leaks
    activeTimeoutsRef.current.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    activeTimeoutsRef.current.clear();
  }, []);

  return {
    isMountedRef,
    createManagedTimeout,
    clearManagedTimeout,
    cleanup,
  };
}; 