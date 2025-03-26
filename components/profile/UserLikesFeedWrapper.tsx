'use client';

import React from 'react';
import { UserLikesFeed } from './UserLikesFeed';
import { SwipeableWrapper } from '@/components/ui/SwipeableWrapper';
import { Id } from "@/convex/_generated/dataModel";

// Activity and RSSEntry types copied from UserLikesFeed component
type ActivityItem = {
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  _id: string;
};

type RSSEntry = {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_title?: string;
  feed_url?: string;
  mediaType?: string;
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
};

// Define interaction states
interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

interface UserLikesFeedWrapperProps {
  userId: Id<"users">;
  initialData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics?: Record<string, InteractionStates>;
  } | null;
  pageSize?: number;
}

export function UserLikesFeedWrapper(props: UserLikesFeedWrapperProps) {
  return (
    <SwipeableWrapper>
      <UserLikesFeed {...props} />
    </SwipeableWrapper>
  );
} 