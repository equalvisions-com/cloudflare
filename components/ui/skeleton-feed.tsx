'use client';

import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonFeedProps {
  count?: number;
}

export function SkeletonFeedItem() {
  return (
    <article>
      <div className="p-4">
        {/* Top Row: Profile Image + Title + Timestamp */}
        <div className="flex items-center gap-4 mb-4">
          {/* Profile/Feed Image */}
          <Skeleton className="flex-shrink-0 w-12 h-12 rounded-md" />
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full flex justify-between items-start">
              <Skeleton className="h-[15px] w-[140px]" />
              <Skeleton className="h-[15px] w-[20px]" />
            </div>
            <Skeleton className="h-[12px] w-[80px] mt-[6px]" />
          </div>
        </div>
        
        {/* Content Card */}
        <div className="mb-4 rounded-xl overflow-hidden bg-background">
          {/* Featured Image */}
          <div className="w-full">
            <Skeleton className="w-full aspect-[2/1]" />
          </div>
          
          {/* Content */}
          <div className="pt-[11px] pl-4 pr-4 pb-[12px]">
            <Skeleton className="h-[20px] w-full mb-[10px]" />
            <Skeleton className="h-[16px] w-full mb-[6px]" />
            <Skeleton className="h-[16px] w-3/4" />
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-4 h-[16px]">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-6" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="border-t border-border opacity-0" />
    </article>
  );
}

export function SkeletonFeed({ count = 3 }: SkeletonFeedProps) {
  return (
    <div>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonFeedItem key={index} />
      ))}
    </div>
  );
} 