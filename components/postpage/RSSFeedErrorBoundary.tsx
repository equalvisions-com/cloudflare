'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// PHASE 4: Enhanced error fallback component for RSS Feed
function RSSFeedErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 border border-destructive/20 rounded-lg bg-destructive/5">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-destructive">
          RSS Feed Error
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Something went wrong while loading the RSS feed. This might be a temporary issue.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs text-left bg-muted p-2 rounded mt-2">
            <summary className="cursor-pointer font-medium">Error Details</summary>
            <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
          </details>
        )}
      </div>
      <Button 
        onClick={resetErrorBoundary}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

// PHASE 4: Enhanced error logging for production monitoring
function handleError(error: Error, errorInfo: { componentStack?: string | null }) {
  // Log error for monitoring in production
  if (process.env.NODE_ENV === 'development') {
    console.error('[RSS Feed Error Boundary]', error, errorInfo);
  }
  
  // TODO: Send to error tracking service
  // Sentry.captureException(error, {
  //   contexts: {
  //     react: {
  //       componentStack: errorInfo.componentStack || 'Unknown',
  //     },
  //   },
  //   tags: {
  //     component: 'RSSFeed',
  //   },
  // });
}

// PHASE 4: Specialized RSS Feed Error Boundary
export function RSSFeedErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={RSSFeedErrorFallback}
      onError={handleError}
      onReset={() => {
        // Optional: Reset any global state or reload data
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
} 