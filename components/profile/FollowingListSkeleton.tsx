"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Props for the skeleton component
interface FollowingListSkeletonProps {
  count?: number;
  showHeader?: boolean;
  showLoadMore?: boolean;
  className?: string;
}

// Individual following item skeleton
const FollowingItemSkeleton = React.memo(() => (
  <div className="flex items-center space-x-4 p-4 border-b border-border">
    {/* Post image skeleton */}
    <div className="flex-shrink-0">
      <Skeleton className="h-16 w-16 rounded-lg" />
    </div>
    
    {/* Content skeleton */}
    <div className="flex-1 min-w-0 space-y-2">
      {/* Title skeleton */}
      <Skeleton className="h-4 w-3/4" />
      
      {/* Subtitle/category skeleton */}
      <Skeleton className="h-3 w-1/2" />
      
      {/* Metadata skeleton */}
      <div className="flex items-center space-x-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    
    {/* Follow button skeleton */}
    <div className="flex-shrink-0">
      <Skeleton className="h-9 w-[100px] rounded-full" />
    </div>
  </div>
));

FollowingItemSkeleton.displayName = "FollowingItemSkeleton";

// Header skeleton for the drawer
const FollowingListHeaderSkeleton = React.memo(() => (
  <div className="flex items-center justify-between p-4 border-b border-gray-200">
    <div className="space-y-2">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-24" />
    </div>
    <Skeleton className="h-6 w-6 rounded" />
  </div>
));

FollowingListHeaderSkeleton.displayName = "FollowingListHeaderSkeleton";

// Load more button skeleton
const LoadMoreButtonSkeleton = React.memo(() => (
  <div className="p-4 border-t border-border">
    <Skeleton className="h-10 w-full rounded-md" />
  </div>
));

LoadMoreButtonSkeleton.displayName = "LoadMoreButtonSkeleton";

// Main skeleton component
export const FollowingListSkeleton: React.FC<FollowingListSkeletonProps> = ({
  count = 5,
  showHeader = true,
  showLoadMore = false,
  className = "",
}) => {
  return (
    <div 
      className={`bg-white rounded-lg ${className}`}
      role="status"
      aria-label="Loading following list"
    >
      {/* Header skeleton */}
      {showHeader && <FollowingListHeaderSkeleton />}
      
      {/* Following items skeleton */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: count }, (_, index) => (
          <FollowingItemSkeleton key={index} />
        ))}
      </div>
      
      {/* Load more button skeleton */}
      {showLoadMore && <LoadMoreButtonSkeleton />}
      
      {/* Screen reader text */}
      <span className="sr-only">Loading following list content...</span>
    </div>
  );
};

// Compact skeleton for smaller spaces
export const FollowingListCompactSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 3, className = "" }) => (
  <div 
    className={`space-y-3 ${className}`}
    role="status"
    aria-label="Loading following list"
  >
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
        <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded flex-shrink-0" />
      </div>
    ))}
    <span className="sr-only">Loading following list content...</span>
  </div>
);

// Drawer skeleton specifically for the drawer layout
export const FollowingListDrawerSkeleton: React.FC<{
  count?: number;
}> = ({ count = 6 }) => (
  <div className="flex-1 overflow-hidden">
    <div className="h-full overflow-y-auto">
      {Array.from({ length: count }, (_, index) => (
        <FollowingItemSkeleton key={index} />
      ))}
    </div>
  </div>
);

// Pulse animation variant for enhanced loading feedback
export const FollowingListPulseSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 4, className = "" }) => (
  <div 
    className={`space-y-4 ${className}`}
    role="status"
    aria-label="Loading following list"
  >
    {Array.from({ length: count }, (_, index) => (
      <div 
        key={index} 
        className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-lg animate-pulse"
        style={{
          animationDelay: `${index * 0.1}s`,
          animationDuration: '1.5s',
        }}
      >
        <div className="h-16 w-16 bg-gray-200 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-3 w-3 bg-gray-200 rounded-full" />
            <div className="h-3 bg-gray-200 rounded w-20" />
          </div>
        </div>
        <div className="h-8 w-20 bg-gray-200 rounded-md flex-shrink-0" />
      </div>
    ))}
    <span className="sr-only">Loading following list content...</span>
  </div>
);

// Shimmer effect skeleton for premium feel
export const FollowingListShimmerSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 5, className = "" }) => (
  <div 
    className={`space-y-3 ${className}`}
    role="status"
    aria-label="Loading following list"
  >
    <style jsx>{`
      @keyframes shimmer {
        0% {
          background-position: -200px 0;
        }
        100% {
          background-position: calc(200px + 100%) 0;
        }
      }
      .shimmer {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200px 100%;
        animation: shimmer 1.5s infinite;
      }
    `}</style>
    
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg">
        <div className="h-16 w-16 shimmer rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 shimmer rounded w-3/4" />
          <div className="h-3 shimmer rounded w-1/2" />
          <div className="flex space-x-2">
            <div className="h-3 shimmer rounded w-16" />
            <div className="h-3 w-3 shimmer rounded-full" />
            <div className="h-3 shimmer rounded w-20" />
          </div>
        </div>
        <div className="h-8 w-20 shimmer rounded-md flex-shrink-0" />
      </div>
    ))}
    <span className="sr-only">Loading following list content...</span>
  </div>
);

// Export default as the main skeleton
export default FollowingListSkeleton; 