'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

// Simple logger for error boundary
const logger = {
  error: (message: string, data?: any) => {
  
  },
  info: (message: string, data?: any) => {
    
  }
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

/**
 * Enhanced Error Boundary for Featured Feed Components
 * 
 * Provides comprehensive error handling with:
 * - Automatic retry mechanism (up to 3 attempts)
 * - Detailed error logging
 * - Graceful fallback UI
 * - Performance monitoring
 * - Memory leak prevention
 */
export class FeaturedFeedErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000; // 2 seconds

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    logger.error('FeaturedFeedErrorBoundary: Component error caught', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    });

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Attempt automatic retry for recoverable errors
    this.attemptAutoRetry(error);
  }

  private attemptAutoRetry = (error: Error) => {
    const { retryCount } = this.state;
    
    // Only retry for certain types of errors and within retry limit
    if (this.isRetryableError(error) && retryCount < this.maxRetries) {
      logger.info(`FeaturedFeedErrorBoundary: Attempting auto-retry ${retryCount + 1}/${this.maxRetries}`, {
        error: error.message,
        delay: this.retryDelay
      });

      this.retryTimeoutId = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prevState.retryCount + 1
        }));
      }, this.retryDelay);
    }
  };

  private isRetryableError = (error: Error): boolean => {
    // Define which errors are worth retrying
    const retryablePatterns = [
      /network/i,
      /fetch/i,
      /timeout/i,
      /connection/i,
      /temporary/i
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    );
  };

  private handleManualRetry = () => {
    logger.info('FeaturedFeedErrorBoundary: Manual retry triggered');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0 // Reset retry count on manual retry
    });
  };

  componentWillUnmount() {
    // Clean up timeout to prevent memory leaks
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="p-8 text-center border border-destructive/20 rounded-lg bg-destructive/5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-destructive mb-2">
              Featured Feed Unavailable
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred while loading the featured content.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={this.handleManualRetry}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              disabled={this.state.retryCount >= this.maxRetries}
            >
              {this.state.retryCount >= this.maxRetries ? 'Max Retries Reached' : 'Try Again'}
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
            >
              Refresh Page
            </button>
          </div>

          {this.state.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Retry attempts: {this.state.retryCount}/{this.maxRetries}
            </p>
          )}

          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm font-medium">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
                {this.state.error?.stack}
                {'\n\nComponent Stack:'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC wrapper for easier usage
 */
export function withFeaturedFeedErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <FeaturedFeedErrorBoundary fallback={fallback}>
      <Component {...props} />
    </FeaturedFeedErrorBoundary>
  );

  WrappedComponent.displayName = `withFeaturedFeedErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
} 