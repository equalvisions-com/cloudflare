'use client';

import React from 'react';
import { Button } from './ui/button';

interface ErrorInfo {
  componentStack: string;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  showDetails?: boolean;
}

export class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced logging for cache-related errors
    const isCacheError = error.message.includes('cache') || 
                        error.message.includes('RequestInitializerDict') ||
                        error.message.includes('not implemented');
    
    if (isCacheError) {
      console.error('🚨 CACHE ERROR DETECTED:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        location: window.location.href,
        userAgent: navigator.userAgent
      });
      
      // Try to extract more details about where this came from
      const stackLines = error.stack?.split('\n') || [];
      const relevantLines = stackLines.filter(line => 
        line.includes('.tsx') || 
        line.includes('.ts') || 
        line.includes('fetch') ||
        line.includes('cache')
      );
      
      console.error('🔍 Relevant stack traces:', relevantLines);
    }

    console.error('Global Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo,
    });

    // Send to error logging API
    fetch('/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        isCacheError,
        userAgent: navigator.userAgent,
      }),
    }).catch(logError => {
      console.error('Failed to log error to API:', logError);
    });
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const { showDetails = false } = this.props;

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred. We've been notified and are working to fix it.
            </p>
            
            {showDetails && error && (
              <details className="text-left mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                <summary className="cursor-pointer font-semibold text-red-600 dark:text-red-400">
                  Error Details
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap text-xs">{error.stack}</pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap text-xs">{errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
            
            <div className="space-y-3">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Refresh Page
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 