'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Virtuoso } from 'react-virtuoso';
import { Loader2 } from "lucide-react";
import { ActivityDescription } from "@/components/profile/UserActivityFeed";
import { Id } from "@/convex/_generated/dataModel";

// Types from both components
type ActivityItem = {
  type: "like" | "comment" | "retweet";
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  _id: string | Id<"comments">;
  userId: Id<"users">;
  username: string;
  userImage?: string;
  userName?: string;
};

type RSSEntry = {
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

interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

export interface FriendActivityGroup {
  entryGuid: string;
  feedUrl: string;
  activities: ActivityItem[];
  entry?: RSSEntry;
  metrics?: InteractionStates;
}

interface FriendsFeedClientProps {
  initialData?: {
    activityGroups: FriendActivityGroup[];
    hasMore: boolean;
  } | null;
  pageSize?: number;
}

export function FriendsFeedClient({ initialData, pageSize = 30 }: FriendsFeedClientProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [activityGroups, setActivityGroups] = useState<FriendActivityGroup[]>(initialData?.activityGroups || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Get the current user
  const identity = useQuery(api.users.viewer);
  const userId = identity?._id;
  
  // Get the user's friends
  const friendsData = useQuery(
    api.friends.getFriends,
    userId ? { userId } : "skip"
  );
  
  // Load friend activities
  const loadFriendActivities = useCallback(async () => {
    if (isLoading || !hasMore || !userId) return;
    
    setIsLoading(true);
    const nextPage = currentPage + 1;
    
    try {
      const response = await fetch(`/api/friends/activity?page=${nextPage}&pageSize=${pageSize}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      
      if (data.activityGroups?.length) {
        setActivityGroups(prev => [...prev, ...data.activityGroups]);
        setHasMore(data.hasMore);
      } else {
        setHasMore(false);
      }
      
      setCurrentPage(nextPage);
    } catch (error) {
      console.error('Error loading friend activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, userId, currentPage, pageSize]);
  
  // Check if we need to load more on initial render
  useEffect(() => {
    const checkContentHeight = () => {
      if (!loadMoreRef.current || !hasMore || isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (documentHeight <= viewportHeight && activityGroups.length > 0) {
        loadFriendActivities();
      }
    };
    
    const timer = setTimeout(checkContentHeight, 1000);
    return () => clearTimeout(timer);
  }, [activityGroups.length, hasMore, isLoading, loadFriendActivities]);
  
  // Render an activity group
  const renderActivityGroup = useCallback((group: FriendActivityGroup, index: number) => {
    if (!group.entry) return null;
    
    const entry = group.entry;
    const sortedActivities = [...group.activities].sort((a, b) => b.timestamp - a.timestamp);
    const firstActivity = sortedActivities[0];
    const isComment = sortedActivities.some(act => act.type === "comment");
    
    return (
      <article key={`${group.entryGuid}-${index}`} className="border-b border-border last:border-0">
        <div className="p-4">
          {/* User activity description */}
          <div className="mb-4">
            {firstActivity && (
              <ActivityDescription 
                item={firstActivity}
                username={firstActivity.username}
                name={firstActivity.userName || firstActivity.username}
                profileImage={firstActivity.userImage}
                timestamp={new Date(firstActivity.timestamp).toISOString()}
              />
            )}
          </div>
          
          {/* RSS Entry Card */}
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-80 transition-opacity"
          >
            <Card className="overflow-hidden shadow-none">
              {entry.image && (
                <CardHeader className="p-0">
                  <AspectRatio ratio={16/9}>
                    <Image
                      src={entry.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 768px"
                      loading="lazy"
                      priority={false}
                    />
                  </AspectRatio>
                </CardHeader>
              )}
              <CardContent className="p-4 bg-secondary/60 border-t">
                <h3 className="text-lg font-semibold leading-tight">
                  {decode(entry.title)}
                </h3>
                {entry.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {decode(entry.description)}
                  </p>
                )}
              </CardContent>
            </Card>
          </a>
          
          {/* Interaction buttons */}
          <div className="flex justify-between items-center mt-4 h-[16px]">
            <div>
              <LikeButtonClient
                entryGuid={entry.guid}
                feedUrl={entry.feed_url || ""}
                title={entry.title}
                pubDate={entry.pub_date}
                link={entry.link}
                initialData={group.metrics?.likes || { isLiked: false, count: 0 }}
              />
            </div>
            <div>
              <CommentSectionClient
                entryGuid={entry.guid}
                feedUrl={entry.feed_url || ""}
                initialData={group.metrics?.comments || { count: 0 }}
              />
            </div>
            <div>
              <RetweetButtonClientWithErrorBoundary
                entryGuid={entry.guid}
                feedUrl={entry.feed_url || ""}
                title={entry.title}
                pubDate={entry.pub_date}
                link={entry.link}
                initialData={group.metrics?.retweets || { isRetweeted: false, count: 0 }}
              />
            </div>
            <div>
              <ShareButtonClient
                url={entry.link}
                title={entry.title}
              />
            </div>
          </div>
        </div>
        
        {/* Show comments if any */}
        {isComment && (
          <div className="px-4 pb-4">
            {sortedActivities
              .filter(act => act.type === "comment")
              .map((comment, i) => (
                <div key={`${comment._id}-${i}`} className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    {comment.userImage && (
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <Image 
                          src={comment.userImage} 
                          alt={comment.username} 
                          width={32} 
                          height={32} 
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{comment.userName || comment.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.timestamp), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{comment.content}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </article>
    );
  }, []);
  
  // Handle no friends or empty feed case
  if (!userId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please sign in to see your friends&apos; activity.</p>
      </div>
    );
  }
  
  if (friendsData && friendsData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>You haven&apos;t added any friends yet.</p>
        <p className="text-sm mt-2">Add friends to see their activity here.</p>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      {activityGroups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No friend activity found.</p>
          <p className="text-sm mt-2">Your friends haven&apos;t interacted with any posts yet.</p>
        </div>
      ) : (
        <Virtuoso
          useWindowScroll
          totalCount={activityGroups.length}
          overscan={500}
          endReached={() => {
            if (hasMore && !isLoading) {
              loadFriendActivities();
            }
          }}
          initialTopMostItemIndex={0}
          itemContent={index => renderActivityGroup(activityGroups[index], index)}
          components={{
            Footer: () => (
              <div ref={loadMoreRef} className="py-4 text-center">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="h-6 w-6 mb-16 animate-spin" />
                  </div>
                ) : hasMore ? (
                  <div className="h-8" />
                ) : (
                  <div className="text-muted-foreground text-sm py-2">
                    No more activities to load
                  </div>
                )}
              </div>
            ),
          }}
        />
      )}
    </div>
  );
}

export function FriendsFeedClientWithErrorBoundary(props: FriendsFeedClientProps) {
  return (
    <ErrorBoundary>
      <FriendsFeedClient {...props} />
    </ErrorBoundary>
  );
} 