"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { memo } from "react";

interface FriendsListSkeletonProps {
  count?: number;
  showHeader?: boolean;
}

export const FriendsListSkeleton = memo<FriendsListSkeletonProps>(({ 
  count = 6, 
  showHeader = false 
}) => {
  return (
    <div className="space-y-0" role="status" aria-label="Loading friends list">
      {showHeader && (
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-6 w-20" />
        </div>
      )}
      
      {Array.from({ length: count }, (_, index) => (
        <FriendItemSkeleton key={index} />
      ))}
      
      <span className="sr-only">Loading friends...</span>
    </div>
  );
});

FriendsListSkeleton.displayName = "FriendsListSkeleton";

const FriendItemSkeleton = memo(() => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border/50 last:border-b-0">
      {/* Profile section */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Profile image skeleton */}
        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
        
        {/* Profile info skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name skeleton */}
          <Skeleton className="h-4 w-24" />
          {/* Username skeleton */}
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      
      {/* Action button skeleton */}
      <div className="flex-shrink-0 ml-3">
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
});

FriendItemSkeleton.displayName = "FriendItemSkeleton";

// Loading more skeleton for virtualized list
export const LoadingMoreSkeleton = memo(() => {
  return (
    <div className="flex items-center justify-center py-4" role="status" aria-label="Loading more friends">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
        <span className="text-sm">Loading more...</span>
      </div>
      <span className="sr-only">Loading more friends</span>
    </div>
  );
});

LoadingMoreSkeleton.displayName = "LoadingMoreSkeleton";

// Initial loading skeleton for drawer
export const DrawerLoadingSkeleton = memo(() => {
  return (
    <div className="flex-1 overflow-hidden">
      <FriendsListSkeleton count={8} />
    </div>
  );
});

DrawerLoadingSkeleton.displayName = "DrawerLoadingSkeleton"; 