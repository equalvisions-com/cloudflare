"use client";

import React, { Suspense } from "react";
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { FeedTabsContainerWithErrorBoundary } from "./FeedTabsContainer";
import { FeedTabsStoreProvider } from "./FeedTabsStoreProvider";
import type { FeedTabsContainerClientWrapperProps } from '@/lib/types';

// Error fallback component
function FeedErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="text-center py-8">
 
      <button 
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
Refresh      </button>
    </div>
  );
}

/**
 * FeedTabsContainerClientWrapper Component
 * 
 * Production-ready wrapper component following established patterns:
 * - Zustand store provider for state isolation
 * - Error boundaries for graceful error handling
 * - Suspense for loading states
 * - Type safety with centralized types
 */

/**
 * Client component wrapper for FeedTabsContainer to handle client-side functionality
 * like error boundaries, Suspense, and store provider
 */
function FeedTabsContainerClientWrapperComponent({ 
  initialData, 
  featuredData, 
  pageSize
}: FeedTabsContainerClientWrapperProps) {
  return (
    <FeedTabsStoreProvider>
      <Suspense fallback={null}>
        <ReactErrorBoundary FallbackComponent={FeedErrorFallback}>
          <FeedTabsContainerWithErrorBoundary
            initialData={initialData}
            featuredData={featuredData}
            pageSize={pageSize}
          />
        </ReactErrorBoundary>
      </Suspense>
    </FeedTabsStoreProvider>
  );
}

// Export memoized version for performance optimization
export const FeedTabsContainerClientWrapper = React.memo(FeedTabsContainerClientWrapperComponent);
FeedTabsContainerClientWrapper.displayName = 'FeedTabsContainerClientWrapper'; 