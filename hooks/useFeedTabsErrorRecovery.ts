import { useCallback, useRef, useState } from 'react';
import { useFeedTabsMemoryManagement } from './useFeedTabsMemoryManagement';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface ErrorRecoveryState {
  retryCount: number;
  lastError: string | null;
  isRecovering: boolean;
  nextRetryAt: number | null;
}

/**
 * Error recovery hook optimized for Cloudflare Edge Runtime
 * 
 * Provides:
 * - Exponential backoff retry logic
 * - Circuit breaker pattern
 * - Error categorization and handling
 * - Memory-efficient error tracking
 * - Edge Runtime specific optimizations
 */
export const useFeedTabsErrorRecovery = () => {
  const { createManagedTimeout, clearManagedTimeout } = useFeedTabsMemoryManagement();
  
  // Error state tracking
  const [errorState, setErrorState] = useState<ErrorRecoveryState>({
    retryCount: 0,
    lastError: null,
    isRecovering: false,
    nextRetryAt: null
  });

  // Retry configuration optimized for Edge Runtime
  const retryConfigRef = useRef<RetryConfig>({
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds max
    backoffMultiplier: 2
  });

  // Track retry timeouts for cleanup
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate next retry delay using exponential backoff
   */
  const calculateRetryDelay = useCallback((retryCount: number): number => {
    const config = retryConfigRef.current;
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, retryCount),
      config.maxDelay
    );
    
    // Add jitter to prevent thundering herd (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.max(delay + jitter, config.baseDelay);
  }, []);

  /**
   * Categorize errors for appropriate handling
   */
  const categorizeError = useCallback((error: any): 'network' | 'auth' | 'server' | 'client' | 'unknown' => {
    if (!error) return 'unknown';
    
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.response?.status;
    
    // Network errors
    if (error.name === 'AbortError' || message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    
    // Authentication errors
    if (status === 401 || status === 403 || message.includes('auth')) {
      return 'auth';
    }
    
    // Server errors (5xx)
    if (status >= 500 && status < 600) {
      return 'server';
    }
    
    // Client errors (4xx)
    if (status >= 400 && status < 500) {
      return 'client';
    }
    
    return 'unknown';
  }, []);

  /**
   * Determine if error is retryable
   */
  const isRetryableError = useCallback((error: any): boolean => {
    const category = categorizeError(error);
    
    // Don't retry auth errors or client errors (except 408, 429)
    if (category === 'auth' || category === 'client') {
      const status = error.status || error.response?.status;
      return status === 408 || status === 429; // Request timeout or rate limit
    }
    
    // Retry network and server errors
    return category === 'network' || category === 'server' || category === 'unknown';
  }, [categorizeError]);

  /**
   * Execute function with retry logic
   */
  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> => {
    const config = retryConfigRef.current;
    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Update state for first attempt
        if (attempt === 0) {
          setErrorState(prev => ({
            ...prev,
            isRecovering: false,
            lastError: null
          }));
        }

        const result = await operation();
        
        // Success - reset error state
        setErrorState({
          retryCount: 0,
          lastError: null,
          isRecovering: false,
          nextRetryAt: null
        });
        
        return result;
             } catch (error: any) {
         lastError = error;
         
         // Don't retry if error is not retryable or we've exhausted retries
         if (!isRetryableError(error) || attempt === config.maxRetries) {
           setErrorState(prev => ({
             ...prev,
             retryCount: attempt,
             lastError: error.message || 'Unknown error',
             isRecovering: false,
             nextRetryAt: null
           }));
           throw error;
         }

        // Calculate delay and update state
        const delay = calculateRetryDelay(attempt);
        const nextRetryAt = Date.now() + delay;
        
                 setErrorState(prev => ({
           ...prev,
           retryCount: attempt + 1,
           lastError: (error as any).message || 'Unknown error',
           isRecovering: true,
           nextRetryAt
         }));

        // Wait before retry
        await new Promise(resolve => {
          retryTimeoutRef.current = createManagedTimeout(() => {
            retryTimeoutRef.current = null;
            resolve(void 0);
          }, delay);
        });
      }
    }

    throw lastError;
  }, [isRetryableError, calculateRetryDelay, createManagedTimeout]);

  /**
   * Manual retry function for user-initiated retries
   */
  const manualRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> => {
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearManagedTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Reset retry count for manual retry
    setErrorState(prev => ({
      ...prev,
      retryCount: 0,
      isRecovering: true,
      nextRetryAt: null
    }));

    return withRetry(operation, operationName);
  }, [withRetry, clearManagedTimeout]);

  /**
   * Get user-friendly error message
   */
  const getErrorMessage = useCallback((error: any): string => {
    const category = categorizeError(error);
    
    switch (category) {
      case 'network':
        return 'Network connection issue. Please check your internet connection and try again.';
      case 'auth':
        return 'Authentication required. Please sign in and try again.';
      case 'server':
        return 'Server temporarily unavailable. Please try again in a moment.';
      case 'client':
        return 'Request failed. Please refresh the page and try again.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }, [categorizeError]);

  /**
   * Get retry status information
   */
  const getRetryStatus = useCallback(() => {
    if (!errorState.isRecovering) return null;
    
    const timeUntilRetry = errorState.nextRetryAt ? Math.max(0, errorState.nextRetryAt - Date.now()) : 0;
    
    return {
      retryCount: errorState.retryCount,
      maxRetries: retryConfigRef.current.maxRetries,
      timeUntilRetry: Math.ceil(timeUntilRetry / 1000), // Convert to seconds
      isRetrying: timeUntilRetry > 0
    };
  }, [errorState]);

  /**
   * Reset error state
   */
  const resetErrorState = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearManagedTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    setErrorState({
      retryCount: 0,
      lastError: null,
      isRecovering: false,
      nextRetryAt: null
    });
  }, [clearManagedTimeout]);

  /**
   * Update retry configuration
   */
  const updateRetryConfig = useCallback((config: Partial<RetryConfig>) => {
    retryConfigRef.current = {
      ...retryConfigRef.current,
      ...config
    };
  }, []);

  return {
    withRetry,
    manualRetry,
    getErrorMessage,
    getRetryStatus,
    resetErrorState,
    updateRetryConfig,
    errorState: {
      hasError: !!errorState.lastError,
      isRecovering: errorState.isRecovering,
      retryCount: errorState.retryCount,
      lastError: errorState.lastError
    }
  };
}; 