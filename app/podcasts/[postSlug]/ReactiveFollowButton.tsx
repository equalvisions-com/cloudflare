"use client";

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FollowButton } from '@/components/follow-button/FollowButton';
import { Id } from '@/convex/_generated/dataModel';
import { useConvexAuth } from 'convex/react';

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
  const { isAuthenticated: clientIsAuthenticated } = useConvexAuth();
  
  // Use client auth state when available, fallback to server state
  const isAuthenticated = clientIsAuthenticated ?? serverIsAuthenticated;
  
  // Reactive follow state query - this will update when database changes
  const currentFollowState = useQuery(
    api.following.isFollowing,
    isAuthenticated ? { postId } : "skip"
  );
  
  // Use reactive state when available, fallback to initial state
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