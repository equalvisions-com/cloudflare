import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AspectRatio } from '@/components/ui/aspect-ratio';

// Memoized single user card skeleton
const UserCardSkeleton = memo(() => (
  <Card className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
    <CardContent className="p-4">
      <div className="flex items-start gap-4">
        {/* Profile Image Skeleton */}
        <div className="flex-shrink-0 w-16 h-16">
          <AspectRatio ratio={1/1} className="overflow-hidden rounded-full">
            <Skeleton className="w-full h-full rounded-full" />
          </AspectRatio>
        </div>
        
        {/* User Info Skeleton */}
        <div className="flex-1 min-w-0 space-y-2 pt-0">
          <div className="flex justify-between items-start gap-4">
            <div className="block flex-1">
              {/* Name Skeleton */}
              <Skeleton className="h-5 w-32 mb-1" />
              {/* Username Skeleton */}
              <Skeleton className="h-3 w-24" />
            </div>
            {/* Friend Button Skeleton */}
            <div className="flex-shrink-0">
              <Skeleton className="h-[23px] w-16 rounded-full" />
            </div>
          </div>
          {/* Bio Skeleton */}
          <div className="!mt-[5px]">
            <Skeleton className="h-3 w-full max-w-xs" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
));

UserCardSkeleton.displayName = 'UserCardSkeleton';

// Memoized users list skeleton
const UsersListSkeleton = memo<{ count?: number }>(({ count = 6 }) => (
  <div className="space-y-0">
    {Array.from({ length: count }).map((_, i) => (
      <UserCardSkeleton key={i} />
    ))}
  </div>
));

UsersListSkeleton.displayName = 'UsersListSkeleton';

// Memoized search skeleton with sticky header
const UsersSearchSkeleton = memo(() => (
  <div className="space-y-0">
    {/* Search input skeleton */}
    <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 md:py-4">
      <div className="relative flex items-center gap-3.5">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
    
    {/* Users list skeleton */}
    <UsersListSkeleton count={8} />
  </div>
));

UsersSearchSkeleton.displayName = 'UsersSearchSkeleton';

export { UserCardSkeleton, UsersListSkeleton, UsersSearchSkeleton }; 