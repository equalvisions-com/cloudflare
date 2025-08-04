import { useCallback, useRef, useEffect } from 'react';

/**
 * Memory management hook optimized for Cloudflare Edge Runtime
 * 
 * Provides utilities for:
 * - Request cleanup and abortion
 * - Memory-efficient data caching
 * - Garbage collection optimization
 * - Edge Runtime specific optimizations
 */
export const useFeedTabsMemoryManagement = () => {
  // Track active requests for cleanup
  const activeRequestsRef = useRef<Set<AbortController>>(new Set());
  
  // Memory-efficient timeout management (Edge Runtime compatible)
  const timeoutsRef = useRef<Set<number>>(new Set());
  
  // Cache for preventing duplicate requests
  const requestCacheRef = useRef<Map<string, Promise<any>>>(new Map());

  /**
   * Create a managed AbortController that auto-cleans up
   */
  const createManagedAbortController = useCallback(() => {
    const controller = new AbortController();
    activeRequestsRef.current.add(controller);
    
    // Auto-cleanup when aborted
    controller.signal.addEventListener('abort', () => {
      activeRequestsRef.current.delete(controller);
    }, { once: true });
    
    return controller;
  }, []);

  /**
   * Create a managed timeout that auto-cleans up (Edge Runtime compatible)
   */
  const createManagedTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      timeoutsRef.current.delete(timeoutId as unknown as number);
      callback();
    }, delay) as unknown as number;
    
    timeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  /**
   * Clear a specific managed timeout (Edge Runtime compatible)
   */
  const clearManagedTimeout = useCallback((timeoutId: number) => {
    clearTimeout(timeoutId as unknown as NodeJS.Timeout);
    timeoutsRef.current.delete(timeoutId);
  }, []);

  /**
   * Deduplicate requests by caching promises
   */
  const deduplicateRequest = useCallback(<T>(
    key: string, 
    requestFn: () => Promise<T>
  ): Promise<T> => {
    // Check if request is already in progress
    const existingRequest = requestCacheRef.current.get(key);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }
    
    // Create new request and cache it
    const promise = requestFn().finally(() => {
      // Remove from cache when completed (success or error)
      requestCacheRef.current.delete(key);
    });
    
    requestCacheRef.current.set(key, promise);
    return promise;
  }, []);

  /**
   * Optimize data for Edge Runtime memory constraints
   */
  const optimizeDataForEdge = useCallback(<T extends { entries?: any[] }>(
    data: T, 
    maxEntries: number = 100
  ): T => {
    if (!data.entries || data.entries.length <= maxEntries) {
      return data;
    }
    
    // Keep only the most recent entries to prevent memory issues
    return {
      ...data,
      entries: data.entries.slice(0, maxEntries)
    };
  }, []);

  /**
   * Force garbage collection hint for Edge Runtime
   */
  const triggerGCHint = useCallback(() => {
    // In Edge Runtime, we can't force GC, but we can clear references
    // Clear old request cache entries
    if (requestCacheRef.current.size > 10) {
      requestCacheRef.current.clear();
    }
  }, []);

  /**
   * Cleanup all managed resources
   */
  const cleanup = useCallback(() => {
    // Abort all active requests
    activeRequestsRef.current.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    activeRequestsRef.current.clear();
    
    // Clear all timeouts
    timeoutsRef.current.forEach(timeoutId => {
      clearTimeout(timeoutId as unknown as NodeJS.Timeout);
    });
    timeoutsRef.current.clear();
    
    // Clear request cache
    requestCacheRef.current.clear();
    
    // Trigger GC hint
    triggerGCHint();
  }, [triggerGCHint]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Periodic cleanup for long-running sessions
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      triggerGCHint();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(cleanupInterval);
  }, [triggerGCHint]);

  return {
    createManagedAbortController,
    createManagedTimeout,
    clearManagedTimeout,
    deduplicateRequest,
    optimizeDataForEdge,
    triggerGCHint,
    cleanup
  };
}; 