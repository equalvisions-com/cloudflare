"use client";

import React, { Suspense, useMemo } from "react";
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { FeedTabsContainerWithErrorBoundary } from "./FeedTabsContainer";
import type { FeedTabsContainerClientWrapperProps } from '@/lib/types';

// Optimized error fallback component with memoization
const FeedErrorFallback = React.memo(({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
  const errorMessage = useMemo(() => {
    // Sanitize error message for production
    if (process.env.NODE_ENV === 'production') {
      return 'Something went wrong. Please try refreshing the page.';
    }
    return error.message || 'An unexpected error occurred';
  }, [error]);

  return (
    <div className="text-center py-8" role="alert" aria-live="polite">
      <p className="text-destructive mb-4">{errorMessage}</p>
      <button 
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="Refresh content"
      >
        Refresh
      </button>
    </div>
  );
});
FeedErrorFallback.displayName = 'FeedErrorFallback';

// Optimized loading fallback
const LoadingFallback = React.memo(() => (
  <div className="animate-pulse space-y-4 p-4" aria-label="Loading content">
    <div className="h-4 bg-muted rounded w-3/4"></div>
    <div className="h-4 bg-muted rounded w-1/2"></div>
    <div className="h-4 bg-muted rounded w-5/6"></div>
  </div>
));
LoadingFallback.displayName = 'LoadingFallback';

/**
 * FeedTabsContainerClientWrapper Component
 * 
 * Production-ready wrapper with optimizations:
 * - Enhanced error boundaries with sanitized error messages
 * - Optimized Suspense with custom loading fallback
 * - Memoized components for performance
 * - Accessibility improvements
 * - Production-safe error handling
 */

/**
 * Client component wrapper for FeedTabsContainer to handle client-side functionality
 * like error boundaries and Suspense with production optimizations
 */
function FeedTabsContainerClientWrapperComponent({ 
  initialData, 
  featuredData, 
  pageSize
}: FeedTabsContainerClientWrapperProps) {
  // Memoize error boundary configuration
  const errorBoundaryConfig = useMemo(() => ({
    FallbackComponent: FeedErrorFallback,
    onError: (error: Error, errorInfo: any) => {
      // Log errors in production for monitoring
      if (process.env.NODE_ENV === 'production') {
        console.error('FeedTabsContainer Error:', error);
        // Add error reporting service here (e.g., Sentry, LogRocket)
      }
    },
    onReset: () => {
      // Optional: Add analytics tracking for error recovery
      if (process.env.NODE_ENV === 'production') {
        console.log('FeedTabsContainer Error Reset');
      }
    }
  }), []);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReactErrorBoundary {...errorBoundaryConfig}>
        <FeedTabsContainerWithErrorBoundary
          initialData={initialData}
          featuredData={featuredData}
          pageSize={pageSize}
        />
      </ReactErrorBoundary>
    </Suspense>
  );
}

// Export memoized version with production-optimized comparison
export const FeedTabsContainerClientWrapper = React.memo(
  FeedTabsContainerClientWrapperComponent,
  (prevProps, nextProps) => {
    // Shallow comparison for wrapper props
    return (
      prevProps.pageSize === nextProps.pageSize &&
      prevProps.initialData === nextProps.initialData &&
      prevProps.featuredData === nextProps.featuredData
    );
  }
);
FeedTabsContainerClientWrapper.displayName = 'FeedTabsContainerClientWrapper'; 