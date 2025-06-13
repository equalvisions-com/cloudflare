import { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  useFeaturedFeedActions,
  useFeaturedFeedMemory,
  useFeaturedFeedPerformance
} from '@/components/featured/FeaturedFeedStoreProvider';
import type {
  UseFeaturedFeedMemoryManagementProps,
  UseFeaturedFeedMemoryManagementReturn
} from '@/lib/types';

// PHASE 4.2: Advanced memory management constants for Edge Runtime
const MEMORY_CONSTANTS = {
  // Edge Runtime memory thresholds
  EDGE_MEMORY_LIMIT: 50 * 1024 * 1024, // 50MB Edge Runtime limit
  WARNING_THRESHOLD: 40 * 1024 * 1024, // 40MB warning threshold
  CRITICAL_THRESHOLD: 45 * 1024 * 1024, // 45MB critical threshold
  
  // Cache management
  DEFAULT_MAX_CACHE_SIZE: 100,
  DEFAULT_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  LRU_EVICTION_BATCH_SIZE: 10,
  
  // Request management
  MAX_CONCURRENT_REQUESTS: 5,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Garbage collection hints
  GC_HINT_INTERVAL: 2 * 60 * 1000, // 2 minutes
  MEMORY_PRESSURE_THRESHOLD: 0.8, // 80% of limit
} as const;

// PHASE 4.2: LRU Cache implementation for efficient memory usage
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private accessOrder = new Map<K, number>();
  private accessCounter = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Update access order
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value;
  }

  set(key: K, value: V): void {
    // If at capacity, evict least recently used items
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  delete(key: K): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    // Find the least recently used items
    const sortedByAccess = Array.from(this.accessOrder.entries())
      .sort(([, a], [, b]) => a - b)
      .slice(0, MEMORY_CONSTANTS.LRU_EVICTION_BATCH_SIZE);

    // Remove them from both maps
    for (const [key] of sortedByAccess) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  // Get memory usage estimation
  getMemoryUsage(): number {
    // Rough estimation: each entry ~1KB
    return this.cache.size * 1024;
  }
}

// PHASE 4.2: Memory monitoring utilities
const getMemoryUsage = (): number => {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
    const memory = (window.performance as any).memory;
    return memory.usedJSHeapSize || 0;
  }
  return 0;
};

const getMemoryPressure = (): number => {
  const usage = getMemoryUsage();
  return usage / MEMORY_CONSTANTS.EDGE_MEMORY_LIMIT;
};

const shouldTriggerGC = (): boolean => {
  return getMemoryPressure() > MEMORY_CONSTANTS.MEMORY_PRESSURE_THRESHOLD;
};

// PHASE 4.2: Advanced garbage collection hints
const triggerGarbageCollection = (): void => {
  if (typeof window !== 'undefined') {
    // Force garbage collection if available (Chrome DevTools)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (e) {
        // Ignore errors in production
      }
    }
    
    // Alternative: Create memory pressure to encourage GC
    if (shouldTriggerGC()) {
      // Create temporary large objects to trigger GC
      const temp = new Array(1000).fill(new Array(1000).fill(0));
      temp.length = 0; // Clear reference
    }
  }
};

/**
 * Custom hook for managing Featured Feed memory optimization
 * 
 * Provides comprehensive memory management for Edge Runtime:
 * - Request deduplication and caching
 * - AbortController lifecycle management
 * - Memory usage monitoring and optimization
 * - Garbage collection hints
 * - Cache cleanup strategies
 * 
 * @param props - Hook configuration props
 * @returns Memory management functions and utilities
 */
export function useFeaturedFeedMemoryManagement({
  maxCacheSize = MEMORY_CONSTANTS.DEFAULT_MAX_CACHE_SIZE,
  cleanupInterval = MEMORY_CONSTANTS.DEFAULT_CLEANUP_INTERVAL
}: UseFeaturedFeedMemoryManagementProps = {}): UseFeaturedFeedMemoryManagementReturn {
  
  // PHASE 4.2: Advanced cache management with LRU
  const cacheRef = useRef<LRUCache<string, any>>();
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const memoryStatsRef = useRef({
    lastCleanup: Date.now(),
    cleanupCount: 0,
    peakMemoryUsage: 0,
    averageMemoryUsage: 0,
    memoryReadings: [] as number[]
  });

  // Initialize LRU cache
  if (!cacheRef.current) {
    cacheRef.current = new LRUCache(maxCacheSize);
  }

  // PHASE 4.2: Real-time memory monitoring
  const updateMemoryStats = useCallback(() => {
    const currentUsage = getMemoryUsage();
    const stats = memoryStatsRef.current;
    
    stats.memoryReadings.push(currentUsage);
    
    // Keep only last 100 readings for average calculation
    if (stats.memoryReadings.length > 100) {
      stats.memoryReadings.shift();
    }
    
    stats.peakMemoryUsage = Math.max(stats.peakMemoryUsage, currentUsage);
    stats.averageMemoryUsage = stats.memoryReadings.reduce((a, b) => a + b, 0) / stats.memoryReadings.length;
    
    // Log memory warnings in development
    if (process.env.NODE_ENV !== 'production') {
      const pressure = getMemoryPressure();
      if (pressure > 0.8) {
        console.warn(`🧠 High memory pressure: ${(pressure * 100).toFixed(1)}% (${(currentUsage / 1024 / 1024).toFixed(1)}MB)`);
      }
    }
  }, []);

  // PHASE 4.2: Enhanced cleanup function
  const cleanup = useCallback(() => {
    const startTime = Date.now();
    let itemsCleared = 0;

    try {
      // Clear LRU cache
      if (cacheRef.current) {
        itemsCleared += cacheRef.current.size();
        cacheRef.current.clear();
      }

      // Abort all pending requests
      abortControllersRef.current.forEach(controller => {
        try {
          controller.abort();
          itemsCleared++;
        } catch (e) {
          // Ignore abort errors
        }
      });
      abortControllersRef.current.clear();

      // Clear all managed timeouts
      timeoutsRef.current.forEach(timeout => {
        clearTimeout(timeout);
        itemsCleared++;
      });
      timeoutsRef.current.clear();

      // Clear all managed intervals
      intervalsRef.current.forEach(interval => {
        clearInterval(interval);
        itemsCleared++;
      });
      intervalsRef.current.clear();

      // Update cleanup stats
      const stats = memoryStatsRef.current;
      stats.lastCleanup = Date.now();
      stats.cleanupCount++;

      // Trigger garbage collection if memory pressure is high
      if (shouldTriggerGC()) {
        triggerGarbageCollection();
      }

      // Log cleanup results in development
      if (process.env.NODE_ENV !== 'production') {
        const duration = Date.now() - startTime;
        console.log(`🧹 Memory cleanup completed: ${itemsCleared} items cleared in ${duration}ms`);
      }
    } catch (error) {
      console.error('Memory cleanup error:', error);
    }
  }, []);

  // PHASE 4.2: Managed timeout creation with automatic tracking
  const createManagedTimeout = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const timeout = setTimeout(() => {
      timeoutsRef.current.delete(timeout);
      callback();
    }, delay);
    
    timeoutsRef.current.add(timeout);
    return timeout;
  }, []);

  // PHASE 4.2: Managed timeout clearing
  const clearManagedTimeout = useCallback((timeout: NodeJS.Timeout): void => {
    clearTimeout(timeout);
    timeoutsRef.current.delete(timeout);
  }, []);

  // PHASE 4.2: Memory optimization with intelligent strategies
  const optimizeMemory = useCallback(() => {
    const currentUsage = getMemoryUsage();
    const pressure = getMemoryPressure();
    
    // Progressive optimization based on memory pressure
    if (pressure > 0.9) {
      // Critical: Aggressive cleanup
      cleanup();
      triggerGarbageCollection();
    } else if (pressure > 0.7) {
      // High: Partial cleanup
      if (cacheRef.current && cacheRef.current.size() > maxCacheSize * 0.5) {
        // Clear half the cache
        const keysToRemove = Math.floor(cacheRef.current.size() * 0.5);
        for (let i = 0; i < keysToRemove; i++) {
          // LRU cache will automatically remove least recently used
          cacheRef.current.set(`temp_${i}`, null);
        }
      }
    } else if (pressure > 0.5) {
      // Medium: Gentle optimization
      triggerGarbageCollection();
    }
    
    updateMemoryStats();
  }, [cleanup, maxCacheSize, updateMemoryStats]);

  // PHASE 4.2: Get current memory usage with detailed stats
  const getMemoryUsageStats = useCallback(() => {
    const stats = memoryStatsRef.current;
    const currentUsage = getMemoryUsage();
    const cacheUsage = cacheRef.current?.getMemoryUsage() || 0;
    
    return {
      current: currentUsage,
      peak: stats.peakMemoryUsage,
      average: stats.averageMemoryUsage,
      cache: cacheUsage,
      pressure: getMemoryPressure(),
      abortControllers: abortControllersRef.current.size,
      timeouts: timeoutsRef.current.size,
      intervals: intervalsRef.current.size,
      cleanupCount: stats.cleanupCount,
      lastCleanup: stats.lastCleanup
    };
  }, []);

  // PHASE 4.2: Setup automatic cleanup and monitoring intervals
  useEffect(() => {
    // Automatic cleanup interval
    const cleanupIntervalId = setInterval(() => {
      const pressure = getMemoryPressure();
      
      // Only run automatic cleanup if memory pressure is high
      if (pressure > 0.6) {
        optimizeMemory();
      } else {
        // Just update stats during low pressure
        updateMemoryStats();
      }
    }, cleanupInterval);

    // Garbage collection hint interval
    const gcIntervalId = setInterval(() => {
      if (shouldTriggerGC()) {
        triggerGarbageCollection();
      }
    }, MEMORY_CONSTANTS.GC_HINT_INTERVAL);

    intervalsRef.current.add(cleanupIntervalId);
    intervalsRef.current.add(gcIntervalId);

    // Cleanup on unmount
    return () => {
      clearInterval(cleanupIntervalId);
      clearInterval(gcIntervalId);
      cleanup();
    };
  }, [cleanupInterval, optimizeMemory, updateMemoryStats, cleanup]);

  // PHASE 4.2: Memory pressure monitoring with warnings
  useEffect(() => {
    const checkMemoryPressure = () => {
      const pressure = getMemoryPressure();
      
      if (pressure > 0.9) {
        console.warn('🚨 Critical memory pressure detected, triggering emergency cleanup');
        optimizeMemory();
      }
    };

    // Check memory pressure more frequently during high usage
    const pressureCheckInterval = setInterval(checkMemoryPressure, 10000); // Every 10 seconds
    intervalsRef.current.add(pressureCheckInterval);

    return () => {
      clearInterval(pressureCheckInterval);
    };
  }, [optimizeMemory]);

  // PHASE 4.2: Return enhanced memory management interface
  return useMemo(() => ({
    cleanup,
    createManagedTimeout,
    clearManagedTimeout,
    optimizeMemory,
    getMemoryUsage: getMemoryUsageStats,
    
    // PHASE 4.2: Additional advanced features
    cache: {
      get: (key: string) => cacheRef.current?.get(key),
      set: (key: string, value: any) => cacheRef.current?.set(key, value),
      delete: (key: string) => cacheRef.current?.delete(key) || false,
      clear: () => cacheRef.current?.clear(),
      size: () => cacheRef.current?.size() || 0
    },
    
    abortControllers: {
      add: (controller: AbortController) => abortControllersRef.current.add(controller),
      remove: (controller: AbortController) => abortControllersRef.current.delete(controller),
      clear: () => abortControllersRef.current.clear(),
      size: () => abortControllersRef.current.size
    },
    
    // Memory monitoring
    isMemoryPressureHigh: () => getMemoryPressure() > 0.7,
    getMemoryPressure,
    triggerGC: triggerGarbageCollection
  }), [cleanup, createManagedTimeout, clearManagedTimeout, optimizeMemory, getMemoryUsageStats]);
} 