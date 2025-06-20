interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface ErrorContext {
  operation: string;
  notificationId?: string;
  userId?: string;
  attempt: number;
}

class NotificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export class NotificationErrorHandler {
  private static instance: NotificationErrorHandler;
  private retryConfig: RetryConfig;

  private constructor(config: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...defaultRetryConfig, ...config };
  }

  static getInstance(config?: Partial<RetryConfig>): NotificationErrorHandler {
    if (!NotificationErrorHandler.instance) {
      NotificationErrorHandler.instance = new NotificationErrorHandler(config);
    }
    return NotificationErrorHandler.instance;
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context: Omit<ErrorContext, 'attempt'>,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customConfig };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === config.maxRetries;

        if (!isRetryable || isLastAttempt) {
          throw new NotificationError(
            `${context.operation} failed after ${attempt} attempt(s): ${lastError.message}`,
            this.getErrorCode(error),
            isRetryable,
            { ...context, attempt }
          );
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
          config.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

        await this.sleep(jitteredDelay);
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return true;
    }

    // Convex errors that are retryable
    if (error.message?.includes('rate limit') || error.message?.includes('timeout')) {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.status) {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.status);
    }

    // Default to non-retryable for unknown errors
    return false;
  }

  private getErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.status) return `HTTP_${error.status}`;
    if (error.name) return error.name;
    return 'UNKNOWN_ERROR';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Graceful degradation helpers
  static createFallbackNotification(id: string, type: 'loading' | 'error'): any {
    const baseNotification = {
      friendship: {
        _id: id,
        _creationTime: Date.now(),
        type: 'friend_request',
        status: 'pending',
        requesterId: '',
        requesteeId: '',
        direction: 'incoming',
        friendshipId: id,
        friendId: '',
        createdAt: Date.now(),
      },
      profile: {
        _id: '',
        userId: '',
        username: 'unknown',
        name: 'Loading...',
        profileImage: undefined,
      },
    };

    if (type === 'error') {
      baseNotification.profile.name = 'Error loading notification';
      baseNotification.profile.username = 'error';
    }

    return baseNotification;
  }

  // Circuit breaker pattern for preventing cascade failures
  private static circuitBreakers = new Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
  }>();

  static checkCircuitBreaker(operation: string): boolean {
    const breaker = this.circuitBreakers.get(operation);
    if (!breaker) {
      this.circuitBreakers.set(operation, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
      });
      return true;
    }

    const now = Date.now();
    const timeSinceLastFailure = now - breaker.lastFailure;

    // Reset after 30 seconds
    if (timeSinceLastFailure > 30000) {
      breaker.failures = 0;
      breaker.state = 'closed';
      return true;
    }

    // Open circuit after 5 failures
    if (breaker.failures >= 5) {
      breaker.state = 'open';
      return false;
    }

    return breaker.state !== 'open';
  }

  static recordFailure(operation: string): void {
    const breaker = this.circuitBreakers.get(operation) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed' as const,
    };

    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= 5) {
      breaker.state = 'open';
    }

    this.circuitBreakers.set(operation, breaker);
  }

  static recordSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
    }
  }
}

export { NotificationError, type RetryConfig, type ErrorContext }; 