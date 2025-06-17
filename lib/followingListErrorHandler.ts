import {
  FollowingListErrorType,
  FollowingListErrorSeverity,
} from "@/lib/types";
import type {
  FollowingListError,
  FollowingListErrorContext,
  FollowingListRetryConfig,
  FollowingListCircuitBreakerState,
} from "@/lib/types";

// Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
}

// Default circuit breaker configuration
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open circuit after 5 failures
  recoveryTimeout: 30000, // 30 seconds before attempting recovery
  monitoringWindow: 60000, // 1 minute monitoring window
  halfOpenMaxCalls: 3, // Max calls in half-open state
};

// Default retry configuration
const DEFAULT_RETRY_CONFIG: FollowingListRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (attempt: number, error?: Error) => {
    // Default retry condition - retry on network errors and server errors
    if (!error) return false;
    const errorString = String(error);
    return errorString.includes('NetworkError') || 
           errorString.includes('fetch') ||
           errorString.includes('500') ||
           errorString.includes('502') ||
           errorString.includes('503') ||
           errorString.includes('504');
  },
};

// Error classification mapping
const ERROR_CLASSIFICATION: Record<string, FollowingListErrorType> = {
  // Network errors
  'NetworkError': FollowingListErrorType.NETWORK_ERROR,
  'TypeError': FollowingListErrorType.NETWORK_ERROR,
  'fetch': FollowingListErrorType.NETWORK_ERROR,
  
  // Server errors
  '500': FollowingListErrorType.SERVER_ERROR,
  '502': FollowingListErrorType.SERVER_ERROR,
  '503': FollowingListErrorType.SERVER_ERROR,
  '504': FollowingListErrorType.SERVER_ERROR,
  
  // Authentication errors
  '401': FollowingListErrorType.AUTHENTICATION_ERROR,
  '403': FollowingListErrorType.AUTHENTICATION_ERROR,
  
  // Validation errors
  '400': FollowingListErrorType.VALIDATION_ERROR,
  '422': FollowingListErrorType.VALIDATION_ERROR,
  
  // Rate limiting
  '429': FollowingListErrorType.RATE_LIMIT_ERROR,
  
  // Not found
  '404': FollowingListErrorType.NOT_FOUND_ERROR,
};

// Error severity mapping
const ERROR_SEVERITY_MAP: Record<FollowingListErrorType, FollowingListErrorSeverity> = {
  [FollowingListErrorType.NETWORK_ERROR]: FollowingListErrorSeverity.MEDIUM,
  [FollowingListErrorType.SERVER_ERROR]: FollowingListErrorSeverity.HIGH,
  [FollowingListErrorType.AUTHENTICATION_ERROR]: FollowingListErrorSeverity.HIGH,
  [FollowingListErrorType.VALIDATION_ERROR]: FollowingListErrorSeverity.LOW,
  [FollowingListErrorType.RATE_LIMIT_ERROR]: FollowingListErrorSeverity.MEDIUM,
  [FollowingListErrorType.NOT_FOUND_ERROR]: FollowingListErrorSeverity.LOW,
  [FollowingListErrorType.UNKNOWN_ERROR]: FollowingListErrorSeverity.MEDIUM,
  [FollowingListErrorType.CIRCUIT_BREAKER_OPEN]: FollowingListErrorSeverity.HIGH,
  [FollowingListErrorType.TIMEOUT_ERROR]: FollowingListErrorSeverity.MEDIUM,
  [FollowingListErrorType.PERMISSION_DENIED]: FollowingListErrorSeverity.HIGH,
  [FollowingListErrorType.LOAD_MORE_ERROR]: FollowingListErrorSeverity.MEDIUM,
  [FollowingListErrorType.FOLLOW_ERROR]: FollowingListErrorSeverity.MEDIUM,
  [FollowingListErrorType.UNFOLLOW_ERROR]: FollowingListErrorSeverity.MEDIUM,
  [FollowingListErrorType.INITIALIZATION_ERROR]: FollowingListErrorSeverity.HIGH,
};

// Circuit breaker state management
class CircuitBreaker {
  private state: FollowingListCircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCallCount = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.halfOpenCallCount = 0;
      } else {
        throw this.createCircuitBreakerError();
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
      throw this.createCircuitBreakerError();
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.halfOpenCallCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenCallCount++;
      this.state = 'OPEN';
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private createCircuitBreakerError(): FollowingListError {
    return {
      type: FollowingListErrorType.CIRCUIT_BREAKER_OPEN,
      message: 'Circuit breaker is open. Service temporarily unavailable.',
      retryable: false,
      context: {
        operation: 'circuit_breaker',
        additionalData: {
          circuitBreakerState: this.state,
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime,
        },
      },
    };
  }

  getState(): FollowingListCircuitBreakerState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenCallCount: this.halfOpenCallCount,
    };
  }
}

// Main error handler class
export class FollowingListErrorHandler {
  private circuitBreaker: CircuitBreaker;
  private retryConfig: FollowingListRetryConfig;

  constructor(
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
    retryConfig?: Partial<FollowingListRetryConfig>
  ) {
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  // Classify error type from various error sources
  classifyError(error: unknown, context?: FollowingListErrorContext): FollowingListErrorType {
    if (!error) return FollowingListErrorType.UNKNOWN_ERROR;

    const errorString = String(error);
    const errorMessage = error instanceof Error ? error.message : errorString;

    // Check for specific error patterns
    for (const [pattern, type] of Object.entries(ERROR_CLASSIFICATION)) {
      if (errorString.includes(pattern) || errorMessage.includes(pattern)) {
        return type;
      }
    }

    // Check for HTTP status codes
    if (context?.httpStatus) {
      const statusString = context.httpStatus.toString();
      if (ERROR_CLASSIFICATION[statusString]) {
        return ERROR_CLASSIFICATION[statusString];
      }
    }

    // Check for timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return FollowingListErrorType.TIMEOUT_ERROR;
    }

    // Check for permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
      return FollowingListErrorType.PERMISSION_DENIED;
    }

    return FollowingListErrorType.UNKNOWN_ERROR;
  }

  // Create standardized error object
  createError(
    error: unknown,
    context: FollowingListErrorContext,
    userMessage?: string
  ): FollowingListError {
    const errorType = this.classifyError(error, context);
    const message = error instanceof Error ? error.message : String(error);

    return {
      type: errorType,
      message,
      retryable: this.isRetryable(errorType),
      context,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Execute operation with circuit breaker protection
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: FollowingListErrorContext
  ): Promise<T> {
    try {
      return await this.circuitBreaker.execute(operation);
    } catch (error) {
      throw this.createError(error, context);
    }
  }

  // Execute operation with retry logic
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: FollowingListErrorContext,
    retryConfig?: Partial<FollowingListRetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...retryConfig };
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error, context);

        // Don't retry non-retryable errors
        if (!this.isRetryable(errorType) || attempt === config.maxRetries) {
          throw this.createError(error, { ...context, attempt });
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt, config);
        await this.sleep(delay);
      }
    }

    throw this.createError(lastError, { ...context, attempt: config.maxRetries });
  }

  // Execute operation with both circuit breaker and retry
  async executeWithProtection<T>(
    operation: () => Promise<T>,
    context: FollowingListErrorContext,
    retryConfig?: Partial<FollowingListRetryConfig>
  ): Promise<T> {
    return this.executeWithRetry(
      () => this.circuitBreaker.execute(operation),
      context,
      retryConfig
    );
  }

  // Check if error type is retryable
  private isRetryable(errorType: FollowingListErrorType): boolean {
    const nonRetryableErrors: FollowingListErrorType[] = [
      FollowingListErrorType.AUTHENTICATION_ERROR,
      FollowingListErrorType.VALIDATION_ERROR,
      FollowingListErrorType.NOT_FOUND_ERROR,
      FollowingListErrorType.PERMISSION_DENIED,
      FollowingListErrorType.CIRCUIT_BREAKER_OPEN,
    ];
    return !nonRetryableErrors.includes(errorType);
  }

  // Calculate retry delay with exponential backoff and jitter
  private calculateRetryDelay(attempt: number, config: FollowingListRetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.max(0, delay);
  }

  // Sleep utility
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get default user-friendly message for error type
  private getDefaultUserMessage(errorType: FollowingListErrorType): string {
    const messages: Record<FollowingListErrorType, string> = {
      [FollowingListErrorType.NETWORK_ERROR]: 'Connection issue. Please check your internet and try again.',
      [FollowingListErrorType.SERVER_ERROR]: 'Server temporarily unavailable. Please try again in a moment.',
      [FollowingListErrorType.AUTHENTICATION_ERROR]: 'Authentication required. Please sign in again.',
      [FollowingListErrorType.VALIDATION_ERROR]: 'Invalid request. Please check your input.',
      [FollowingListErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please wait a moment before trying again.',
      [FollowingListErrorType.NOT_FOUND_ERROR]: 'Content not found.',
      [FollowingListErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
      [FollowingListErrorType.CIRCUIT_BREAKER_OPEN]: 'Service temporarily unavailable. Please try again later.',
      [FollowingListErrorType.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
      [FollowingListErrorType.PERMISSION_DENIED]: 'Permission denied. You may not have access to this content.',
      [FollowingListErrorType.LOAD_MORE_ERROR]: 'Failed to load more items. Please try again.',
      [FollowingListErrorType.FOLLOW_ERROR]: 'Failed to follow. Please try again.',
      [FollowingListErrorType.UNFOLLOW_ERROR]: 'Failed to unfollow. Please try again.',
      [FollowingListErrorType.INITIALIZATION_ERROR]: 'Failed to initialize. Please refresh the page.',
    };
    return messages[errorType];
  }

  // Get circuit breaker metrics
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  // Reset circuit breaker (for testing or manual recovery)
  resetCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker();
  }
}

// Singleton instance for global use
export const followingListErrorHandler = new FollowingListErrorHandler();

// Utility functions for common error scenarios
export const handleFollowingListError = (
  error: unknown,
  operation: string,
  additionalContext?: Partial<FollowingListErrorContext>
): FollowingListError => {
  const context: FollowingListErrorContext = {
    operation,
    timestamp: Date.now(),
    ...additionalContext,
  };
  return followingListErrorHandler.createError(error, context);
};

export const executeWithErrorHandling = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Partial<FollowingListErrorContext>
): Promise<T> => {
  const fullContext: FollowingListErrorContext = {
    operation: operationName,
    timestamp: Date.now(),
    ...context,
  };
  return followingListErrorHandler.executeWithProtection(operation, fullContext);
}; 