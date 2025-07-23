'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  timestamp: string;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = Math.random().toString(36).substring(2, 15);
    const timestamp = new Date().toISOString();
    
    return {
      hasError: true,
      error,
      errorId,
      timestamp
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log to console for debugging
    console.error('Global Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: this.state.timestamp,
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Try to log to external service if available
    try {
      this.logErrorToService(error, errorInfo);
    } catch (loggingError) {
      console.error('Failed to log error to external service:', loggingError);
    }
  }

  private logErrorToService = async (error: Error, errorInfo: ErrorInfo) => {
    // Try to send to your logging endpoint if available
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          errorId: this.state.errorId,
          timestamp: this.state.timestamp,
          userAgent: navigator.userAgent,
          url: window.location.href,
          type: 'client-error'
        })
      });
    } catch (e) {
      // Silently fail if logging endpoint is not available
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: ''
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback 
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        errorId={this.state.errorId}
        timestamp={this.state.timestamp}
        onRetry={this.handleRetry}
        onReload={this.handleReload}
        onGoHome={this.handleGoHome}
        showDetails={this.props.showDetails}
      />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  timestamp: string;
  onRetry: () => void;
  onReload: () => void;
  onGoHome: () => void;
  showDetails?: boolean;
}

function ErrorFallback({
  error,
  errorInfo,
  errorId,
  timestamp,
  onRetry,
  onReload,
  onGoHome,
  showDetails = true
}: ErrorFallbackProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyErrorDetails = async () => {
    const errorDetails = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorId,
      timestamp,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy error details:', e);
    }
  };

  const getErrorType = () => {
    if (!error) return 'Unknown Error';
    
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      return 'Code Loading Error';
    }
    if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
      return 'Network Error';
    }
    if (error.message.includes('Convex') || error.message.includes('CONVEX')) {
      return 'Database Connection Error';
    }
    if (error.message.includes('Unauthorized') || error.message.includes('Authentication')) {
      return 'Authentication Error';
    }
    
    return 'Application Error';
  };

  const getErrorSolution = () => {
    const errorType = getErrorType();
    
    switch (errorType) {
      case 'Code Loading Error':
        return 'Try refreshing the page. This usually happens when the app has been updated.';
      case 'Network Error':
        return 'Check your internet connection and try again.';
      case 'Database Connection Error':
        return 'The app is experiencing database connectivity issues. Please try again in a few minutes.';
      case 'Authentication Error':
        return 'Please sign out and sign back in to refresh your session.';
      default:
        return 'An unexpected error occurred. Try refreshing the page or returning to the homepage.';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-lg">
        <CardHeader className="text-center border-b">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-800">
            Something went wrong
          </CardTitle>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="destructive">{getErrorType()}</Badge>
            <Badge variant="outline">ID: {errorId}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="text-center space-y-2">
            <p className="text-gray-600 text-lg">
              {getErrorSolution()}
            </p>
            <p className="text-sm text-gray-500">
              Error occurred at {new Date(timestamp).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={onRetry} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button onClick={onReload} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </Button>
            <Button onClick={onGoHome} variant="outline" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </div>

          {showDetails && error && (
            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Technical Details
                </h3>
                <div className="flex gap-2">
                  <Button
                    onClick={copyErrorDetails}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    variant="outline"
                    size="sm"
                  >
                    {showTechnicalDetails ? 'Hide' : 'Show'} Details
                  </Button>
                </div>
              </div>

              {showTechnicalDetails && (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">Error Message:</h4>
                    <code className="block bg-gray-100 p-3 rounded text-sm text-red-600 overflow-x-auto">
                      {error.message}
                    </code>
                  </div>

                  {error.stack && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">Stack Trace:</h4>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-32">
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  {errorInfo?.componentStack && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">Component Stack:</h4>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-32">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="text-center text-xs text-gray-400 border-t pt-4">
            If this problem persists, please contact support with Error ID: {errorId}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 