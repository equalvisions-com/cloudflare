"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { ProfileImage } from "@/components/profile/ProfileImage";
import { SimpleFriendButton } from "@/components/ui/SimpleFriendButton";
import type { FollowersListUserData } from "@/lib/types";

interface VirtualizedFollowerItemProps {
  follower: FollowersListUserData;
  index: number;
  isFirst?: boolean;
  isLast?: boolean;
  isAuthenticated?: boolean;
}

export const VirtualizedFollowerItem = memo<VirtualizedFollowerItemProps>((props) => {
  // Memoized computed values
  const computedValues = useMemo(() => {
    const follower = props.follower;
    if (!follower) return null;

    return {
      displayName: follower.name || follower.username || "Unknown User",
      username: follower.username || "unknown",
      profileImage: follower.profileImage,
      userId: follower.userId,
    };
  }, [props.follower]);

  // Defensive check for data integrity - AFTER all hooks
  if (!props.follower || !computedValues) {
    return (
      <div 
        className="flex items-center justify-center p-4 text-muted-foreground"
        role="alert"
        aria-label="Invalid follower data"
      >
        <span className="text-sm">Invalid follower data</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between gap-3 p-4 border-b border-border min-h-[80px] hover:bg-muted/30 transition-colors duration-200"
      data-index={props.index}
      data-follower-id={computedValues.userId.toString()}
      role="listitem"
      aria-label={`Follower: ${computedValues.displayName}`}
    >
      {/* Left side - Profile info */}
      <Link
        href={`/profile/${computedValues.username}`}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md p-1 -m-1"
        aria-label={`View ${computedValues.displayName}'s profile`}
      >
        <div className="flex-shrink-0">
          <ProfileImage
            profileImage={computedValues.profileImage}
            username={computedValues.username}
            size="sm"
            className="h-12 w-12"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-foreground">
            {computedValues.displayName}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            @{computedValues.username}
          </div>
        </div>
      </Link>

      {/* Right side - Action button */}
      {props.isAuthenticated && (
        <div className="flex-shrink-0" role="group" aria-label="Friend actions">
          <SimpleFriendButton
            username={computedValues.username}
            userId={computedValues.userId}
            profileData={{
              username: computedValues.username,
              name: computedValues.displayName,
              profileImage: computedValues.profileImage,
            }}
            className="w-[100px] rounded-full opacity-100 hover:opacity-100 font-semibold shadow-none transition-all duration-200 text-sm"
            friendsClassName="text-muted-foreground border border-input"
            pendingClassName="text-muted-foreground border border-input"
            aria-label={`Manage friendship with ${computedValues.displayName}`}
          />
        </div>
      )}
    </div>
  );
});

VirtualizedFollowerItem.displayName = 'VirtualizedFollowerItem';

// Memoized export to prevent unnecessary re-renders
export const MemoizedVirtualizedFollowerItem = memo(VirtualizedFollowerItem); 