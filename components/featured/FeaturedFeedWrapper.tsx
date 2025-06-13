'use client';

import React, { memo, lazy, Suspense } from 'react';
import { SkeletonFeed } from '@/components/ui/skeleton-feed';
import type { FeaturedFeedWrapperProps } from '@/lib/types';

// PHASE 4.1: Dynamic import for FeaturedFeedClient to reduce initial bundle size
const FeaturedFeedClient = lazy(() => 
  import('./FeaturedFeedClient').then(mod => ({ default: mod.FeaturedFeedClient }))
);

// PHASE 4.1: Loading fallback component for dynamic import
const FeaturedFeedLoadingFallback = memo(() => (
  <div className="w-full">
    <SkeletonFeed count={5} />
  </div>
));
FeaturedFeedLoadingFallback.displayName = 'FeaturedFeedLoadingFallback';

// Production-ready Featured Feed Wrapper Component
const FeaturedFeedWrapperComponent = ({ initialData, pageSize = 30, isActive = true }: FeaturedFeedWrapperProps) => {
  // Handle empty state with better UX
  if (!initialData || !initialData.entries || initialData.entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-3">
        <div className="text-lg font-medium">No featured content available</div>
        <p className="text-sm max-w-md mx-auto leading-relaxed">
          Featured content will appear here when available. Check back later for curated posts and highlights.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<FeaturedFeedLoadingFallback />}>
      <FeaturedFeedClient
        initialData={initialData}
        pageSize={pageSize}
        isActive={isActive}
      />
    </Suspense>
  );
};

// Export memoized version for performance optimization
export const FeaturedFeedWrapper = memo(FeaturedFeedWrapperComponent);
FeaturedFeedWrapper.displayName = 'FeaturedFeedWrapper'; 