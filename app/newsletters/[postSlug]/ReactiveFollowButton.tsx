"use client";

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FollowButton } from '@/components/follow-button/FollowButton';
import { Id } from '@/convex/_generated/dataModel';
import { useConvexAuth } from 'convex/react';
import { useSidebar } from '@/components/ui/sidebar-context';

interface ReactiveFollowButtonProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
  initialIsFollowing: boolean;
  isAuthenticated?: boolean;
  className?: string;
}

/**
 * A reactive follow button that uses Convex queries to stay in sync
 * with other follow buttons across the app (widgets, feeds, etc.)
 */
export const ReactiveFollowButton = React.memo(function ReactiveFollowButton({
  postId,
  feedUrl,
  postTitle,
  initialIsFollowing,
  isAuthenticated: serverIsAuthenticated,
  className
}: ReactiveFollowButtonProps) {
  // Use sidebar context to eliminate duplicate users:viewer query
  const { isAuthenticated: sidebarIsAuthenticated } = useSidebar();
  
  // Use sidebar auth state when available, fallback to server state
  const isAuthenticated = sidebarIsAuthenticated ?? serverIsAuthenticated;
  
  // Strategy: Use server data initially, but enable reactivity after a short delay
  // This prevents duplicate initial queries while maintaining reactivity for user interactions
  const [enableReactivity, setEnableReactivity] = React.useState(false);
  
  React.useEffect(() => {
    // Enable reactivity after initial render to catch any follow/unfollow actions
    const timer = setTimeout(() => setEnableReactivity(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  const currentFollowState = useQuery(
    api.following.isFollowing,
    isAuthenticated && enableReactivity ? { postId } : "skip"
  );
  
  // Use reactive state when available, fallback to initial server state
  const isFollowing = currentFollowState ?? initialIsFollowing;
  
  return (
    <FollowButton
      postId={postId}
      feedUrl={feedUrl}
      postTitle={postTitle}
      initialIsFollowing={isFollowing}
      isAuthenticated={isAuthenticated}
      className={className}
      disableAutoFetch={true} // We're already handling the query above
    />
  );
}); 