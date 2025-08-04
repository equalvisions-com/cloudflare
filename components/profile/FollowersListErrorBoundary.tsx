"use client";

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface FollowersListErrorBoundaryProps {
  children: ReactNode;
  enableRecovery?: boolean;
  maxRetries?: number;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface FollowersListErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

export class FollowersListErrorBoundary extends Component<
  FollowersListErrorBoundaryProps,
  FollowersListErrorBoundaryState
> {
  constructor(props: FollowersListErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<FollowersListErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      const { enableRecovery = true, maxRetries = 3 } = this.props;
      const canRetry = enableRecovery && this.state.retryCount < maxRetries;

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            The followers list encountered an error and couldn&apos;t load properly.
          </p>
          
          {canRetry && (
            <Button
              onClick={this.handleRetry}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again ({maxRetries - this.state.retryCount} attempts left)
            </Button>
          )}
          
          {!canRetry && (
            <p className="text-xs text-muted-foreground mt-2">
              Maximum retry attempts reached. Please refresh the page.
            </p>
          )}
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Error Details (Development Only)
              </summary>
              <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto max-w-md">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
} 