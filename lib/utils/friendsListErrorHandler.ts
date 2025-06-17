import { toast } from '@/components/ui/use-toast';
import {
  FriendsListErrorType,
  FriendsListErrorSeverity,
  type FriendsListEnhancedError,
  type FriendsListErrorContext,
  type FriendsListRetryConfig,
  type FriendsListRecoveryStrategy,
} from '@/lib/types';

// Error classification patterns
const ERROR_PATTERNS = {
  NETWORK: [
    /network/i,
    /fetch/i,
    /connection/i,
    /timeout/i,
    /offline/i,
    /ERR_NETWORK/i,
    /ERR_INTERNET_DISCONNECTED/i,
  ],
  RATE_LIMIT: [
    /rate.?limit/i,
    /too.?many.?requests/i,
    /429/,
    /quota.?exceeded/i,
    /throttle/i,
  ],
  AUTHENTICATION: [
    /unauthorized/i,
    /authentication/i,
    /401/,
    /403/,
    /forbidden/i,
    /access.?denied/i,
  ],
  VALIDATION: [
    /validation/i,
    /invalid/i,
    /bad.?request/i,
    /400/,
    /malformed/i,
  ],
  SERVER: [
    /server.?error/i,
    /internal.?error/i,
    /500/,
    /502/,
    /503/,
    /504/,
    /database/i,
  ],
  NOT_FOUND: [
    /not.?found/i,
    /404/,
    /does.?not.?exist/i,
    /missing/i,
  ],
} as const;

// Default retry configurations
const DEFAULT_RETRY_CONFIGS: Record<FriendsListErrorType, FriendsListRetryConfig> = {
  [FriendsListErrorType.NETWORK_ERROR]: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (attempt, error) => attempt < 3 && !navigator.onLine === false,
  },
  [FriendsListErrorType.RATE_LIMIT_ERROR]: {
    maxRetries: 2,
    baseDelay: 5000,
    maxDelay: 30000,
    backoffMultiplier: 3,
    jitter: true,
    retryCondition: (attempt) => attempt < 2,
  },
  [FriendsListErrorType.SERVER_ERROR]: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (attempt) => attempt < 2,
  },
  [FriendsListErrorType.AUTHENTICATION_ERROR]: {
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 1000,
    backoffMultiplier: 1,
    jitter: false,
    retryCondition: () => false, // Don't retry auth errors
  },
  [FriendsListErrorType.VALIDATION_ERROR]: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
    retryCondition: () => false, // Don't retry validation errors
  },
  [FriendsListErrorType.NOT_FOUND_ERROR]: {
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 1000,
    backoffMultiplier: 1,
    jitter: false,
    retryCondition: (attempt) => attempt < 1,
  },
  [FriendsListErrorType.LOAD_MORE_ERROR]: {
    maxRetries: 2,
    baseDelay: 1500,
    maxDelay: 6000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (attempt) => attempt < 2,
  },
  [FriendsListErrorType.UNFRIEND_ERROR]: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 4000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (attempt) => attempt < 2,
  },
  [FriendsListErrorType.UNKNOWN_ERROR]: {
    maxRetries: 1,
    baseDelay: 2000,
    maxDelay: 2000,
    backoffMultiplier: 1,
    jitter: false,
    retryCondition: (attempt) => attempt < 1,
  },
  [FriendsListErrorType.INITIALIZATION_ERROR]: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 4000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (attempt) => attempt < 2,
  },
};

// Recovery strategies
const RECOVERY_STRATEGIES: Record<FriendsListErrorType, FriendsListRecoveryStrategy> = {
  [FriendsListErrorType.NETWORK_ERROR]: {
    type: 'retry_with_fallback',
    description: 'Retry with exponential backoff, then show cached data if available',
    actions: ['retry', 'show_cached', 'offline_mode'],
  },
  [FriendsListErrorType.RATE_LIMIT_ERROR]: {
    type: 'wait_and_retry',
    description: 'Wait for rate limit to reset, then retry',
    actions: ['wait', 'retry', 'show_cached'],
  },
  [FriendsListErrorType.SERVER_ERROR]: {
    type: 'retry_with_degraded',
    description: 'Retry with exponential backoff, then show degraded experience',
    actions: ['retry', 'show_cached', 'degraded_mode'],
  },
  [FriendsListErrorType.AUTHENTICATION_ERROR]: {
    type: 'redirect_to_auth',
    description: 'Redirect user to authentication flow',
    actions: ['redirect_auth', 'clear_cache'],
  },
  [FriendsListErrorType.VALIDATION_ERROR]: {
    type: 'show_validation_error',
    description: 'Show validation error to user for correction',
    actions: ['show_error', 'highlight_fields'],
  },
  [FriendsListErrorType.NOT_FOUND_ERROR]: {
    type: 'refresh_and_retry',
    description: 'Refresh data and retry once',
    actions: ['refresh', 'retry'],
  },
  [FriendsListErrorType.LOAD_MORE_ERROR]: {
    type: 'retry_load_more',
    description: 'Retry loading more items with backoff',
    actions: ['retry', 'show_retry_button'],
  },
  [FriendsListErrorType.UNFRIEND_ERROR]: {
    type: 'retry_unfriend',
    description: 'Retry unfriend action with user confirmation',
    actions: ['retry', 'confirm_action', 'revert_optimistic'],
  },
  [FriendsListErrorType.UNKNOWN_ERROR]: {
    type: 'generic_recovery',
    description: 'Generic error recovery with user options',
    actions: ['retry', 'refresh', 'contact_support'],
  },
  [FriendsListErrorType.INITIALIZATION_ERROR]: {
    type: 'retry_initialization',
    description: 'Retry component initialization with fallback',
    actions: ['retry', 'refresh', 'fallback_mode'],
  },
};

export class FriendsListErrorHandler {
  private retryAttempts = new Map<string, number>();
  private lastErrorTime = new Map<string, number>();
  private circuitBreakerState = new Map<string, { failures: number; lastFailure: number; isOpen: boolean }>();
  
  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  
  /**
   * Classify error type based on error message and context
   */
  classifyError(error: unknown, context?: FriendsListErrorContext): FriendsListEnhancedError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();
    
    // Determine error type
    let errorType = FriendsListErrorType.UNKNOWN_ERROR;
    
    for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(lowerMessage))) {
        errorType = FriendsListErrorType[type as keyof typeof FriendsListErrorType];
        break;
      }
    }
    
    // Determine severity
    const severity = this.determineSeverity(errorType, context);
    
    // Get user-friendly message
    const userMessage = this.getUserFriendlyMessage(errorType, errorMessage);
    
    // Get recovery strategy
    const recoveryStrategy = RECOVERY_STRATEGIES[errorType];
    
    return {
      type: errorType,
      severity,
      message: userMessage,
      originalError: error instanceof Error ? error : undefined,
      timestamp: Date.now(),
      context,
      retryable: this.isRetryable(errorType),
      recoveryStrategy,
      retryConfig: DEFAULT_RETRY_CONFIGS[errorType],
    };
  }
  
  /**
   * Determine error severity based on type and context
   */
  private determineSeverity(errorType: FriendsListErrorType, context?: FriendsListErrorContext): FriendsListErrorSeverity {
    // Critical errors that break core functionality
    if ([
      FriendsListErrorType.AUTHENTICATION_ERROR,
      FriendsListErrorType.SERVER_ERROR,
    ].includes(errorType)) {
      return FriendsListErrorSeverity.CRITICAL;
    }
    
    // High severity errors that significantly impact UX
    if ([
      FriendsListErrorType.NETWORK_ERROR,
      FriendsListErrorType.RATE_LIMIT_ERROR,
    ].includes(errorType)) {
      return FriendsListErrorSeverity.HIGH;
    }
    
    // Medium severity errors that partially impact functionality
    if ([
      FriendsListErrorType.LOAD_MORE_ERROR,
      FriendsListErrorType.UNFRIEND_ERROR,
      FriendsListErrorType.NOT_FOUND_ERROR,
    ].includes(errorType)) {
      return FriendsListErrorSeverity.MEDIUM;
    }
    
    // Low severity errors that don't significantly impact UX
    if ([
      FriendsListErrorType.VALIDATION_ERROR,
    ].includes(errorType)) {
      return FriendsListErrorSeverity.LOW;
    }
    
    return FriendsListErrorSeverity.MEDIUM;
  }
  
  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(errorType: FriendsListErrorType, originalMessage: string): string {
    const messages = {
      [FriendsListErrorType.NETWORK_ERROR]: 'Connection issue. Please check your internet and try again.',
      [FriendsListErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please wait a moment and try again.',
      [FriendsListErrorType.SERVER_ERROR]: 'Server temporarily unavailable. Please try again in a few moments.',
      [FriendsListErrorType.AUTHENTICATION_ERROR]: 'Authentication required. Please sign in again.',
      [FriendsListErrorType.VALIDATION_ERROR]: 'Invalid request. Please check your input and try again.',
      [FriendsListErrorType.NOT_FOUND_ERROR]: 'The requested information could not be found.',
      [FriendsListErrorType.LOAD_MORE_ERROR]: 'Failed to load more friends. Please try again.',
      [FriendsListErrorType.UNFRIEND_ERROR]: 'Failed to update friendship. Please try again.',
      [FriendsListErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
      [FriendsListErrorType.INITIALIZATION_ERROR]: 'Failed to initialize friends list. Please refresh the page.',
    };
    
    return messages[errorType] || 'An unexpected error occurred. Please try again.';
  }
  
  /**
   * Check if error type is retryable
   */
  private isRetryable(errorType: FriendsListErrorType): boolean {
    const nonRetryableTypes = [
      FriendsListErrorType.AUTHENTICATION_ERROR,
      FriendsListErrorType.VALIDATION_ERROR,
    ];
    
    return !nonRetryableTypes.includes(errorType);
  }
  
  /**
   * Handle error with comprehensive recovery strategy
   */
  async handleError(
    error: unknown,
    context?: FriendsListErrorContext,
    onRetry?: () => Promise<void>
  ): Promise<FriendsListEnhancedError> {
    const friendsListError = this.classifyError(error, context);
    const errorKey = `${friendsListError.type}_${context?.operation || 'unknown'}`;
    
    // Log error for debugging
    console.error('FriendsList Error:', {
      type: friendsListError.type,
      severity: friendsListError.severity,
      message: friendsListError.message,
      context: friendsListError.context,
      originalError: friendsListError.originalError,
    });
    
    // Update circuit breaker state
    this.updateCircuitBreaker(errorKey);
    
    // Check if circuit breaker is open
    if (this.isCircuitBreakerOpen(errorKey)) {
      toast({
        title: 'Service Temporarily Unavailable',
        description: 'Multiple failures detected. Please try again in a few minutes.',
        variant: 'destructive',
      });
      return friendsListError;
    }
    
    // Show appropriate toast based on severity
    this.showErrorToast(friendsListError);
    
    // Attempt recovery if retryable and retry function provided
    if (friendsListError.retryable && onRetry && friendsListError.retryConfig) {
      await this.attemptRecovery(friendsListError, errorKey, onRetry);
    }
    
    return friendsListError;
  }
  
  /**
   * Show error toast based on severity
   */
  private showErrorToast(error: FriendsListEnhancedError): void {
    const toastConfig = {
      title: this.getErrorTitle(error.type),
      description: error.message,
      variant: error.severity === FriendsListErrorSeverity.CRITICAL ? 'destructive' as const : 'default' as const,
    };
    
    toast(toastConfig);
  }
  
  /**
   * Get error title for toast
   */
  private getErrorTitle(errorType: FriendsListErrorType): string {
    const titles = {
      [FriendsListErrorType.NETWORK_ERROR]: 'Connection Error',
      [FriendsListErrorType.RATE_LIMIT_ERROR]: 'Rate Limit Exceeded',
      [FriendsListErrorType.SERVER_ERROR]: 'Server Error',
      [FriendsListErrorType.AUTHENTICATION_ERROR]: 'Authentication Required',
      [FriendsListErrorType.VALIDATION_ERROR]: 'Validation Error',
      [FriendsListErrorType.NOT_FOUND_ERROR]: 'Not Found',
      [FriendsListErrorType.LOAD_MORE_ERROR]: 'Load Error',
      [FriendsListErrorType.UNFRIEND_ERROR]: 'Action Failed',
      [FriendsListErrorType.UNKNOWN_ERROR]: 'Unexpected Error',
      [FriendsListErrorType.INITIALIZATION_ERROR]: 'Initialization Error',
    };
    
    return titles[errorType] || 'Error';
  }
  
  /**
   * Attempt error recovery with retry logic
   */
  private async attemptRecovery(
    error: FriendsListEnhancedError,
    errorKey: string,
    onRetry: () => Promise<void>
  ): Promise<void> {
    const retryConfig = error.retryConfig!;
    const currentAttempt = this.retryAttempts.get(errorKey) || 0;
    
    // Check if we should retry
    if (!retryConfig.retryCondition(currentAttempt, error.originalError)) {
      return;
    }
    
    // Calculate delay with exponential backoff and jitter
    const delay = this.calculateRetryDelay(retryConfig, currentAttempt);
    
    // Update retry attempt count
    this.retryAttempts.set(errorKey, currentAttempt + 1);
    
    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await onRetry();
      // Success - reset retry count and circuit breaker
      this.retryAttempts.delete(errorKey);
      this.resetCircuitBreaker(errorKey);
    } catch (retryError) {
      // Retry failed - handle recursively if more attempts available
      if (currentAttempt + 1 < retryConfig.maxRetries) {
        await this.handleError(retryError, error.context, onRetry);
      }
    }
  }
  
  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(config: FriendsListRetryConfig, attempt: number): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    delay = Math.min(delay, config.maxDelay);
    
    if (config.jitter) {
      // Add random jitter (±25%)
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }
  
  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(errorKey: string): void {
    const now = Date.now();
    const state = this.circuitBreakerState.get(errorKey) || { failures: 0, lastFailure: 0, isOpen: false };
    
    state.failures++;
    state.lastFailure = now;
    
    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
    }
    
    this.circuitBreakerState.set(errorKey, state);
  }
  
  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(errorKey: string): boolean {
    const state = this.circuitBreakerState.get(errorKey);
    if (!state || !state.isOpen) return false;
    
    const now = Date.now();
    if (now - state.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
      // Reset circuit breaker after timeout
      this.resetCircuitBreaker(errorKey);
      return false;
    }
    
    return true;
  }
  
  /**
   * Reset circuit breaker state
   */
  private resetCircuitBreaker(errorKey: string): void {
    this.circuitBreakerState.set(errorKey, { failures: 0, lastFailure: 0, isOpen: false });
  }
  
  /**
   * Clear all retry states (useful for cleanup)
   */
  clearRetryStates(): void {
    this.retryAttempts.clear();
    this.lastErrorTime.clear();
    this.circuitBreakerState.clear();
  }
  
  /**
   * Get current error statistics
   */
  getErrorStats(): Record<string, any> {
    return {
      retryAttempts: Object.fromEntries(this.retryAttempts),
      circuitBreakerStates: Object.fromEntries(this.circuitBreakerState),
      lastErrorTimes: Object.fromEntries(this.lastErrorTime),
    };
  }
}

// Singleton instance
export const friendsListErrorHandler = new FriendsListErrorHandler(); 