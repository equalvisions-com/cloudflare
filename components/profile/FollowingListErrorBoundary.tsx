"use client";

import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { followingListErrorHandler, handleFollowingListError } from "@/lib/followingListErrorHandler";
import type { FollowingListError, FollowingListErrorType } from "@/lib/types";

// Props for the error boundary
interface FollowingListErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: FollowingListError, retry: () => void) => ReactNode;
  onError?: (error: FollowingListError, errorInfo: React.ErrorInfo) => void;
  enableRecovery?: boolean;
  maxRetries?: number;
}

// State for the error boundary
interface FollowingListErrorBoundaryState {
  hasError: boolean;
  error: FollowingListError | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

// Error boundary component
export class FollowingListErrorBoundary extends Component<
  FollowingListErrorBoundaryProps,
  FollowingListErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: FollowingListErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<FollowingListErrorBoundaryState> {
    // Convert the error to our standardized format
    const followingListError = handleFollowingListError(error, 'error_boundary', {
      operation: 'error_boundary',
      timestamp: Date.now(),
    });

    return {
      hasError: true,
      error: followingListError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error and call the onError callback if provided
    const followingListError = handleFollowingListError(error, 'error_boundary', {
      operation: 'error_boundary',
      timestamp: Date.now(),
      additionalData: { stack: errorInfo.componentStack },
    });

    this.setState({ errorInfo });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(followingListError, errorInfo);
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.error('FollowingList Error Boundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  componentWillUnmount() {
    // Clean up any pending retry timeouts
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  // Retry mechanism with exponential backoff
  handleRetry = () => {
    const { maxRetries = 3, enableRecovery = true } = this.props;
    const { retryCount } = this.state;

    if (!enableRecovery || retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds

    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
        isRetrying: false,
      });
    }, delay);
  };

  // Reset error state completely
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    });
  };

  // Get error severity styling based on error type
  private getErrorSeverityStyles(errorType: FollowingListErrorType) {
    // Map error types to severity levels
    const highSeverityErrors = [
      'SERVER_ERROR',
      'AUTHENTICATION_ERROR',
    ];
    
    const mediumSeverityErrors = [
      'NETWORK_ERROR',
      'RATE_LIMIT_ERROR',
      'UNKNOWN_ERROR',
    ];

    if (highSeverityErrors.includes(errorType)) {
      return {
        containerClass: 'border-red-200 bg-red-50',
        iconClass: 'text-red-600',
        titleClass: 'text-red-800',
        messageClass: 'text-red-700',
      };
    } else if (mediumSeverityErrors.includes(errorType)) {
      return {
        containerClass: 'border-orange-200 bg-orange-50',
        iconClass: 'text-orange-600',
        titleClass: 'text-orange-800',
        messageClass: 'text-orange-700',
      };
    } else {
      return {
        containerClass: 'border-yellow-200 bg-yellow-50',
        iconClass: 'text-yellow-600',
        titleClass: 'text-yellow-800',
        messageClass: 'text-yellow-700',
      };
    }
  }

  // Default error UI
  private renderDefaultErrorUI(error: FollowingListError) {
    const { enableRecovery = true, maxRetries = 3 } = this.props;
    const { retryCount, isRetrying } = this.state;
    const styles = this.getErrorSeverityStyles(error.type);
    const canRetry = enableRecovery && error.retryable && retryCount < maxRetries;

    return (
      <div className={`rounded-lg border-2 p-6 ${styles.containerClass}`}>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <AlertTriangle className={`h-6 w-6 ${styles.iconClass}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold ${styles.titleClass}`}>
              {this.getErrorTitle(error.type)}
            </h3>
            
            <p className={`mt-2 text-sm ${styles.messageClass}`}>
              {this.getUserMessage(error)}
            </p>

            {/* Error details for development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className={`cursor-pointer text-xs ${styles.messageClass} hover:underline`}>
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-white rounded border text-xs font-mono">
                  <p><strong>Type:</strong> {error.type}</p>
                  <p><strong>Message:</strong> {error.message}</p>
                  {error.context && (
                    <p><strong>Context:</strong> {JSON.stringify(error.context, null, 2)}</p>
                  )}
                </div>
              </details>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              {canRetry && (
                <Button
                  onClick={this.handleRetry}
                  disabled={isRetrying}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : `Retry (${maxRetries - retryCount} left)`}
                </Button>
              )}

              <Button
                onClick={this.handleReset}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Reset
              </Button>

              {process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={() => {
                    
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Bug className="h-4 w-4" />
                  Debug
                </Button>
              )}
            </div>

            {/* Retry count indicator */}
            {retryCount > 0 && (
              <div className="mt-4 text-xs text-muted-foreground">
                Retry attempt: {retryCount} of {maxRetries}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Get user-friendly error title
  private getErrorTitle(errorType: FollowingListErrorType): string {
    const titles: Record<FollowingListErrorType, string> = {
      NETWORK_ERROR: 'Connection Problem',
      LOAD_MORE_ERROR: 'Loading Error',
      FOLLOW_ERROR: 'Follow Error',
      UNFOLLOW_ERROR: 'Unfollow Error',
      INITIALIZATION_ERROR: 'Initialization Error',
      UNKNOWN_ERROR: 'Unexpected Error',
      RATE_LIMIT_ERROR: 'Too Many Requests',
      SERVER_ERROR: 'Server Issue',
      AUTHENTICATION_ERROR: 'Authentication Required',
      VALIDATION_ERROR: 'Invalid Request',
      NOT_FOUND_ERROR: 'Content Not Found',
      TIMEOUT_ERROR: 'Request Timeout',
      PERMISSION_DENIED: 'Permission Denied',
      CIRCUIT_BREAKER_OPEN: 'Service Unavailable',
    };
    return titles[errorType] || 'Error';
  }

  // Get user-friendly message
  private getUserMessage(error: FollowingListError): string {
    const messages: Record<FollowingListErrorType, string> = {
      NETWORK_ERROR: 'Connection issue. Please check your internet and try again.',
      LOAD_MORE_ERROR: 'Failed to load more items. Please try again.',
      FOLLOW_ERROR: 'Failed to follow content. Please try again.',
      UNFOLLOW_ERROR: 'Failed to unfollow content. Please try again.',
      INITIALIZATION_ERROR: 'Failed to initialize following list. Please refresh the page.',
      UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
      RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment before trying again.',
      SERVER_ERROR: 'Server temporarily unavailable. Please try again in a moment.',
      AUTHENTICATION_ERROR: 'Authentication required. Please sign in again.',
      VALIDATION_ERROR: 'Invalid request. Please check your input.',
      NOT_FOUND_ERROR: 'Content not found.',
      TIMEOUT_ERROR: 'Request timed out. Please try again.',
      PERMISSION_DENIED: 'You do not have permission to perform this action.',
      CIRCUIT_BREAKER_OPEN: 'Service is temporarily unavailable. Please try again later.',
    };
    return messages[error.type] || error.message;
  }

  render() {
    const { hasError, error, isRetrying } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Show loading state during retry
      if (isRetrying) {
        return (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Attempting to recover...</span>
            </div>
          </div>
        );
      }

      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleRetry);
      }

      // Use default error UI
      return this.renderDefaultErrorUI(error);
    }

    return children;
  }
}

// Higher-order component for easier usage
export function withFollowingListErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<FollowingListErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <FollowingListErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </FollowingListErrorBoundary>
  );

  WrappedComponent.displayName = `withFollowingListErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for error boundary context (if needed in the future)
export function useFollowingListErrorBoundary() {
  return {
    resetErrorBoundary: () => {
      // This would need to be implemented with context if we need it
      window.location.reload();
    },
  };
} 