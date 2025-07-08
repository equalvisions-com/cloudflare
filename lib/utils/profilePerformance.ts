// Edge runtime compatible performance utilities for profile operations
// No monitoring - designed for Cloudflare Pages edge runtime

import { useCallback, useRef, useEffect, useMemo } from 'react';

// Memory management for blob URLs
export class BlobURLManager {
  private static urls = new Set<string>();

  static create(file: File): string {
    const url = URL.createObjectURL(file);
    this.urls.add(url);
    return url;
  }

  static revoke(url: string): void {
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
    }
  }

  static revokeAll(): void {
    this.urls.forEach(url => URL.revokeObjectURL(url));
    this.urls.clear();
  }

  static getActiveCount(): number {
    return this.urls.size;
  }
}

// Debounced callback hook for form inputs
export const useDebouncedCallback = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
};

// Throttled callback hook for expensive operations
export const useThrottledCallback = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callbackRef.current(...args);
        }, delay - timeSinceLastCall);
      }
    }) as T,
    [delay]
  );
};

// Memoized validation hook
export const useFormValidation = (name: string, bio: string) => {
  return useMemo(() => {
    const nameLength = name.trim().length;
    const bioLength = bio.trim().length;
    
    const nameValidation = {
      isError: nameLength > 60,
      message: nameLength > 60 ? 'Name must be 60 characters or less' : '',
      length: nameLength,
    };
    
    const bioValidation = {
      isError: bioLength > 250,
      message: bioLength > 250 ? 'Bio must be 250 characters or less' : '',
      length: bioLength,
    };
    
    return {
      name: nameValidation,
      bio: bioValidation,
      hasErrors: nameValidation.isError || bioValidation.isError,
    };
  }, [name, bio]);
};

// File validation with memoization
export const useFileValidation = () => {
  return useCallback((file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    
    const errors: string[] = [];
    
    if (file.size > maxSize) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 5MB limit`);
    }
    
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} not supported. Use JPEG, PNG, WebP, or GIF`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      size: file.size,
      type: file.type,
    };
  }, []);
};

// Memory-efficient image preview hook
export const useImagePreview = () => {
  const previewUrlRef = useRef<string | null>(null);
  
  const createPreview = useCallback((file: File): string => {
    // Clean up previous preview
    if (previewUrlRef.current) {
      BlobURLManager.revoke(previewUrlRef.current);
    }
    
    // Create new preview
    const url = BlobURLManager.create(file);
    previewUrlRef.current = url;
    return url;
  }, []);
  
  const cleanupPreview = useCallback(() => {
    if (previewUrlRef.current) {
      BlobURLManager.revoke(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPreview();
    };
  }, [cleanupPreview]);
  
  return {
    createPreview,
    cleanupPreview,
    currentPreview: previewUrlRef.current,
  };
};

// Optimized retry mechanism with memory management
export const useOptimizedRetry = () => {
  const retryTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  
  const scheduleRetry = useCallback(<T>(
    operation: () => Promise<T>,
    delay: number,
    onError?: (error: Error) => void
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        retryTimeoutsRef.current.delete(timeout);
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)));
          }
          reject(error);
        }
      }, delay);
      
      retryTimeoutsRef.current.add(timeout);
    });
  }, []);
  
  const cancelAllRetries = useCallback(() => {
    retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    retryTimeoutsRef.current.clear();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllRetries();
    };
  }, [cancelAllRetries]);
  
  return {
    scheduleRetry,
    cancelAllRetries,
    activeRetryCount: retryTimeoutsRef.current.size,
  };
};

// Form state optimization hook
export const useOptimizedFormState = <T>(
  initialState: T,
  equalityFn?: (a: T, b: T) => boolean
) => {
  const stateRef = useRef<T>(initialState);
  const listenersRef = useRef<Set<(state: T) => void>>(new Set());
  
  const defaultEqualityFn = useCallback((a: T, b: T) => {
    return JSON.stringify(a) === JSON.stringify(b);
  }, []);
  
  const isEqual = equalityFn || defaultEqualityFn;
  
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    const nextState = typeof newState === 'function' 
      ? (newState as (prev: T) => T)(stateRef.current)
      : newState;
    
    if (!isEqual(stateRef.current, nextState)) {
      stateRef.current = nextState;
      listenersRef.current.forEach(listener => listener(nextState));
    }
  }, [isEqual]);
  
  const subscribe = useCallback((listener: (state: T) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);
  
  return {
    getState: () => stateRef.current,
    setState,
    subscribe,
  };
};

// Resource cleanup manager
export class ResourceManager {
  private static resources = new Map<string, () => void>();
  
  static register(id: string, cleanup: () => void): void {
    // Clean up existing resource with same ID
    const existing = this.resources.get(id);
    if (existing) {
      existing();
    }
    
    this.resources.set(id, cleanup);
  }
  
  static cleanup(id: string): void {
    const cleanup = this.resources.get(id);
    if (cleanup) {
      cleanup();
      this.resources.delete(id);
    }
  }
  
  static cleanupAll(): void {
    this.resources.forEach(cleanup => cleanup());
    this.resources.clear();
  }
  
  static getActiveCount(): number {
    return this.resources.size;
  }
}

// Edge runtime compatible performance utilities
export const performanceUtils = {
  // Efficient object comparison for shallow objects
  shallowEqual: <T extends Record<string, any>>(a: T, b: T): boolean => {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (a[key] !== b[key]) return false;
    }
    
    return true;
  },
  
  // Memory-efficient array comparison
  arrayEqual: <T>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
  },
  
  // Optimized deep clone for simple objects
  deepClone: <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as T;
    if (obj instanceof Array) return obj.map(item => performanceUtils.deepClone(item)) as T;
    
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = performanceUtils.deepClone(obj[key]);
      }
    }
    return cloned;
  },
  
  // Batch DOM updates
  batchUpdates: (updates: (() => void)[]): void => {
    // Use requestAnimationFrame for batching in edge runtime
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        updates.forEach(update => update());
      });
    } else {
      // Fallback for environments without requestAnimationFrame
      setTimeout(() => {
        updates.forEach(update => update());
      }, 0);
    }
  },
}; 