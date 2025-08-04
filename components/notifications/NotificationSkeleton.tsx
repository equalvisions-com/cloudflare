import { memo } from 'react';

const NotificationSkeleton = memo(() => {
  return (
    <div className="flex items-center justify-between p-4 border-b animate-pulse">
      {/* Left side - Profile and content */}
      <div className="flex items-center gap-3 flex-1">
        {/* Profile image skeleton */}
        <div className="h-12 w-12 rounded-full bg-muted/60" />
        
        {/* Text content skeleton */}
        <div className="space-y-2">
          {/* Name skeleton */}
          <div className="h-4 w-32 bg-muted/60 rounded" />
          {/* Message skeleton */}
          <div className="h-3 w-48 bg-muted/40 rounded" />
        </div>
      </div>

      {/* Right side - Action buttons skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted/60" />
        <div className="h-8 w-8 rounded-full bg-muted/60" />
      </div>
    </div>
  );
});

NotificationSkeleton.displayName = 'NotificationSkeleton';

const NotificationSkeletonList = memo(({ count = 6 }: { count?: number }) => {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }, (_, index) => (
        <NotificationSkeleton key={`skeleton-${index}`} />
      ))}
    </div>
  );
});

NotificationSkeletonList.displayName = 'NotificationSkeletonList';

export { NotificationSkeletonList }; 