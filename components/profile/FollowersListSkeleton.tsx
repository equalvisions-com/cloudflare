"use client";

import { memo } from "react";

interface FollowersListSkeletonProps {
  count?: number;
  className?: string;
}

const FollowersListSkeletonComponent = ({ 
  count = 6, 
  className = "" 
}: FollowersListSkeletonProps) => {
  return (
    <div className={`space-y-0 ${className}`} role="status" aria-label="Loading followers">
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index} 
          className={`
            flex items-center gap-3 p-4 animate-pulse
            ${index !== 0 ? 'border-t border-border/50' : ''}
          `}
        >
          {/* Profile image skeleton */}
          <div className="w-16 h-16 bg-muted rounded-full flex-shrink-0" />
          
          {/* Content skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Name skeleton */}
            <div className="h-4 bg-muted rounded w-32" />
            {/* Username skeleton */}
            <div className="h-3 bg-muted rounded w-24" />
          </div>
          
          {/* Action button skeleton */}
          <div className="w-20 h-8 bg-muted rounded flex-shrink-0" />
        </div>
      ))}
      <span className="sr-only">Loading followers list...</span>
    </div>
  );
};

// Export the memoized version to prevent unnecessary re-renders
export const FollowersListSkeleton = memo(FollowersListSkeletonComponent);

// Also export a drawer-specific skeleton
interface FollowersListDrawerSkeletonProps {
  count?: number;
}

const FollowersListDrawerSkeletonComponent = ({ count = 6 }: FollowersListDrawerSkeletonProps) => {
  return (
    <div className="space-y-0" role="status" aria-label="Loading followers">
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index} 
          className={`
            flex items-center gap-3 p-4 animate-pulse
            ${index !== 0 ? 'border-t border-border/50' : ''}
          `}
        >
          {/* Profile image skeleton */}
          <div className="w-16 h-16 bg-muted rounded-full flex-shrink-0" />
          
          {/* Content skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Name skeleton */}
            <div className="h-4 bg-muted rounded w-32" />
            {/* Username skeleton */}
            <div className="h-3 bg-muted rounded w-24" />
          </div>
          
          {/* Action button skeleton */}
          <div className="w-20 h-8 bg-muted rounded flex-shrink-0" />
        </div>
      ))}
      <span className="sr-only">Loading followers list...</span>
    </div>
  );
};

export const FollowersListDrawerSkeleton = memo(FollowersListDrawerSkeletonComponent); 