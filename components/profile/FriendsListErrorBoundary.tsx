'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Users, Home } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface FriendsListErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  lastErrorTime: number;
}

interface FriendsListErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<FriendsListErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  resetTimeoutMs?: number;
}

interface FriendsListErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  onRetry: () => void;
  onReset: () => void;
  canRetry: boolean;
}

class FriendsListErrorBoundary extends React.Component<
  FriendsListErrorBoundaryProps,
  FriendsListErrorBoundaryState
> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private readonly maxRetries: number;
  private readonly resetTimeoutMs: number;

  constructor(props: FriendsListErrorBoundaryProps) {
    super(props);
    
    this.maxRetries = props.maxRetries ?? 3;
    this.resetTimeoutMs = props.resetTimeoutMs ?? 30000; // 30 seconds
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<FriendsListErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('FriendsListErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Show error toast
    toast({
      title: 'Friends List Error',
      description: 'An unexpected error occurred while loading your friends.',
      variant: 'destructive',
    });

    // Set up automatic reset after timeout
    this.scheduleReset();
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private scheduleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.handleReset();
    }, this.resetTimeoutMs);
  };

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    if (newRetryCount > this.maxRetries) {
      toast({
        title: 'Maximum Retries Exceeded',
        description: 'Please refresh the page or try again later.',
        variant: 'destructive',
      });
      return;
    }

    // console.log(`FriendsListErrorBoundary: Retrying (attempt ${newRetryCount}/${this.maxRetries})`);
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: newRetryCount,
      lastErrorTime: 0,
    });

    toast({
      title: 'Retrying...',
      description: 'Attempting to reload your friends list.',
    });
  };

  private handleReset = () => {
    // console.log('FriendsListErrorBoundary: Resetting error state');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: 0,
    });

    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  };

  private canRetry = (): boolean => {
    return this.state.retryCount < this.maxRetries;
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultFriendsListErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          retryCount={this.state.retryCount}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
          canRetry={this.canRetry()}
        />
      );
    }

    return this.props.children;
  }
}

// Default fallback component
const DefaultFriendsListErrorFallback: React.FC<FriendsListErrorFallbackProps> = ({
  error,
  retryCount,
  onRetry,
  onReset,
  canRetry,
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return (
    <div className="flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-lg">Friends List Error</CardTitle>
          <CardDescription>
            We encountered an issue while loading your friends list.
            {retryCount > 0 && ` (Attempt ${retryCount})`}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isDevelopment && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Error Details (Development):
              </p>
              <p className="text-xs text-muted-foreground break-all">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {canRetry ? (
              <Button 
                onClick={onRetry} 
                className="w-full"
                variant="default"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            ) : (
              <Button 
                onClick={onReset} 
                className="w-full"
                variant="default"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            )}
            
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Page
            </Button>
            
            <Button 
              onClick={() => window.location.href = '/'} 
              variant="ghost"
              className="w-full"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              If this problem persists, please contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Minimal fallback for critical errors
export const MinimalFriendsListErrorFallback: React.FC<FriendsListErrorFallbackProps> = ({
  onRetry,
  canRetry,
}) => (
  <div className="flex items-center justify-center p-4 text-center">
    <div className="space-y-3">
      <Users className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Unable to load friends list
      </p>
      {canRetry && (
        <Button onClick={onRetry} size="sm" variant="outline">
          <RefreshCw className="mr-2 h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  </div>
);

// Hook for using error boundary programmatically
export const useFriendsListErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null);
  
  const throwError = React.useCallback((error: Error) => {
    setError(error);
  }, []);
  
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);
  
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);
  
  return { throwError, clearError };
};

export default FriendsListErrorBoundary;
export type { FriendsListErrorBoundaryProps, FriendsListErrorFallbackProps }; 