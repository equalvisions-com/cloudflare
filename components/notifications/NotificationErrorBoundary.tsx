import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface NotificationErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  notificationId?: string;
}

interface NotificationErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  retryCount: number;
}

class NotificationErrorBoundary extends Component<
  NotificationErrorBoundaryProps,
  NotificationErrorBoundaryState
> {
  private maxRetries = 3;

  constructor(props: NotificationErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<NotificationErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `notification-error-${Date.now()}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-red-800">
                Notification Error
              </h3>
              <p className="text-sm text-red-700 mt-1">
                Something went wrong loading this notification.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-2">
                  <summary className="text-xs text-red-600 cursor-pointer">
                    Error Details
                  </summary>
                  <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-2">
              {this.state.retryCount < this.maxRetries && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={this.handleRetry}
                  className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry ({this.maxRetries - this.state.retryCount} left)
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={this.handleReset}
                className="h-8 px-3 text-xs text-red-600 hover:bg-red-100"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NotificationErrorBoundary; 