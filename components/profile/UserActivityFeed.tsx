"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Heart, MessageCircle, Repeat, Loader2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Virtuoso } from 'react-virtuoso';
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Podcast, Mail } from "lucide-react";
import { useAudio } from '@/components/audio-player/AudioContext';
import { useQuery, useConvexAuth, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ProfileImage } from "@/components/profile/ProfileImage";
import { CommentLikeButton } from "@/components/comment-section/CommentLikeButton";
import { Textarea } from "@/components/ui/textarea";


// Types for activity items
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
};

// Type for RSS entry from PlanetScale
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
  // Additional fields from Convex posts
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
};

// Comment type based on the schema
interface Comment {
  _id: Id<"comments">;
  _creationTime: number;
  userId: Id<"users">;
  username: string;
  content: string;
  parentId?: Id<"comments">;
  entryGuid: string;
  feedUrl: string;
  createdAt: number;
  user?: {
    name?: string;
    username?: string;
    profileImage?: string;
    image?: string;
  } | null;
}

// Define the shape of interaction states for batch metrics
interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

interface UserActivityFeedProps {
  userId: Id<"users">;
  username: string;
  name: string;
  profileImage?: string | null;
  initialData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics?: Record<string, InteractionStates>;
  } | null;
  pageSize?: number;
  apiEndpoint?: string;
}

// Custom hook for batch metrics - similar to EntriesDisplay.tsx
function useEntriesMetrics(entryGuids: string[], initialMetrics?: Record<string, InteractionStates>) {
  // Debug log the initial metrics to make sure they're being received correctly
  useEffect(() => {
    if (initialMetrics && Object.keys(initialMetrics).length > 0) {
      console.log('📊 Received initial metrics for', Object.keys(initialMetrics).length, 'entries');
    }
  }, [initialMetrics]);

  // Track if we've already received initial metrics
  const hasInitialMetrics = useMemo(() => 
    Boolean(initialMetrics && Object.keys(initialMetrics).length > 0), 
    [initialMetrics]
  );
  
  // Create a stable representation of entry guids
  const memoizedGuids = useMemo(() => 
    entryGuids.length > 0 ? entryGuids : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryGuids.join(',')]
  );
  
  // Only fetch from Convex if we don't have initial metrics or if we need to refresh
  const shouldFetchMetrics = useMemo(() => {
    // If we have no guids, no need to fetch
    if (!memoizedGuids.length) return false;
    
    // If we have no initial metrics, we need to fetch
    if (!hasInitialMetrics) return true;
    
    // If we have initial metrics, check if we have metrics for all guids
    const missingMetrics = memoizedGuids.some(guid => 
      !initialMetrics || !initialMetrics[guid]
    );
    
    return missingMetrics;
  }, [memoizedGuids, hasInitialMetrics, initialMetrics]);
  
  // Fetch batch metrics for all entries only when needed
  const batchMetricsQuery = useQuery(
    api.entries.batchGetEntriesMetrics,
    shouldFetchMetrics ? { entryGuids: memoizedGuids } : "skip"
  );
  
  // Create a memoized metrics map that combines initial metrics with query results
  const metricsMap = useMemo(() => {
    // Start with initial metrics if available
    const map = new Map<string, InteractionStates>();
    
    // Add initial metrics first
    if (initialMetrics) {
      Object.entries(initialMetrics).forEach(([guid, metrics]) => {
        map.set(guid, metrics);
      });
    }
    
    // If we have query results AND we specifically queried for them,
    // they take precedence over initial metrics ONLY for entries we didn't have metrics for
    if (batchMetricsQuery && shouldFetchMetrics) {
      memoizedGuids.forEach((guid, index) => {
        if (batchMetricsQuery[index] && (!initialMetrics || !initialMetrics[guid])) {
          map.set(guid, batchMetricsQuery[index]);
        }
      });
    }
    
    return map;
  }, [batchMetricsQuery, memoizedGuids, initialMetrics, shouldFetchMetrics]);
  
  // Memoize default values
  const defaultInteractions = useMemo(() => ({
    likes: { isLiked: false, count: 0 },
    comments: { count: 0 },
    retweets: { isRetweeted: false, count: 0 }
  }), []);
  
  // Return a function to get metrics for a specific entry
  const getEntryMetrics = useCallback((entryGuid: string) => {
    // Always use the metrics from the server or default values
    return metricsMap.get(entryGuid) || defaultInteractions;
  }, [metricsMap, defaultInteractions]);
  
  return {
    getEntryMetrics,
    isLoading: shouldFetchMetrics && !batchMetricsQuery,
    metricsMap
  };
}

function ActivityIcon({ type }: { type: "like" | "comment" | "retweet" }) {
  switch (type) {
    case "like":
      return <Heart className="h-4 w-4 text-muted-foreground stroke-[2.5px]" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-muted-foreground stroke-[2.5px]" />;
    case "retweet":
      return <Repeat className="h-4 w-4 text-muted-foreground stroke-[2.5px]" />;
  }
}

// Export ActivityDescription for reuse
export function ActivityDescription({ item, username, name, profileImage, timestamp }: { 
  item: ActivityItem; 
  username: string;
  name: string;
  profileImage?: string | null;
  timestamp?: string;
}) {
  // Create a ref to store the like count element
  const likeCountRef = useRef<HTMLDivElement>(null);
  // State to track if replies are expanded
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  // State to track reply input
  const [replyText, setReplyText] = useState('');
  // State to track if submitting a reply
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  // State to store replies
  const [replies, setReplies] = useState<Comment[]>([]);
  // State to track if replies are loading
  const [repliesLoading, setRepliesLoading] = useState(false);
  // State to track if replies have been loaded at least once
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  // Create a map of refs for reply like counts
  const replyLikeCountRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // State to track deleted replies
  const [deletedReplies, setDeletedReplies] = useState<Set<string>>(new Set());
  
  // Use Convex query for replies
  const commentRepliesQuery = useQuery(
    api.comments.getCommentReplies,
    item.type === 'comment' && item._id ? 
      { commentId: typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id } : 
      'skip'
  );
  
  // Fetch replies when expanded
  const fetchReplies = useCallback(() => {
    if (item.type !== 'comment' || !item._id) return;
    
    setRepliesLoading(true);
    try {
      // The query result is automatically updated by Convex
      if (commentRepliesQuery) {
        setReplies(commentRepliesQuery || []);
        setRepliesLoaded(true);
      }
    } catch (error) {
      console.error('Error processing replies:', error);
    } finally {
      setRepliesLoading(false);
    }
  }, [item, commentRepliesQuery]);
  
  // Use effect to update replies whenever the query result changes
  useEffect(() => {
    if (repliesExpanded && commentRepliesQuery) {
      setReplies(commentRepliesQuery || []);
      setRepliesLoaded(true);
      setRepliesLoading(false);
    }
  }, [repliesExpanded, commentRepliesQuery]);
  
  // Toggle replies visibility
  const toggleReplies = useCallback(() => {
    const newExpandedState = !repliesExpanded;
    setRepliesExpanded(newExpandedState);
    
    if (newExpandedState && !repliesLoaded) {
      fetchReplies();
    }
  }, [repliesExpanded, fetchReplies, repliesLoaded]);
  
  // Use the same addComment mutation for replies
  const addComment = useMutation(api.comments.addComment);
  
  // Submit a reply
  const submitReply = useCallback(async () => {
    if (!replyText.trim() || isSubmittingReply || item.type !== 'comment' || !item._id) return;
    
    const commentId = typeof item._id === 'string' ? 
      item._id as unknown as Id<"comments"> : 
      item._id;
    
    setIsSubmittingReply(true);
    
    try {
      // Use Convex mutation to submit the reply
      await addComment({
        parentId: commentId,
        content: replyText.trim(),
        entryGuid: item.entryGuid,
        feedUrl: item.feedUrl
      });
      
      // Clear the input
      setReplyText('');
      
      // Make sure replies are expanded
      setRepliesExpanded(true);
      
      // The replies will automatically update through the Convex subscription
      // No need to manually fetch them again
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  }, [replyText, isSubmittingReply, item, addComment]);
  
  // Function to update the like count text
  const updateLikeCount = (count: number) => {
    if (likeCountRef.current) {
      if (count > 0) {
        const countText = `${count} ${count === 1 ? 'Like' : 'Likes'}`;
        const countElement = likeCountRef.current.querySelector('span:last-child');
        if (countElement) {
          countElement.textContent = countText;
        }
        likeCountRef.current.classList.remove('hidden');
      } else {
        likeCountRef.current.classList.add('hidden');
      }
    }
  };
  
  // Check for initial like count from Convex
  useEffect(() => {
    if (item.type === 'comment' && item._id) {
      // No need to convert the ID here since we're not using it
      // We just need to make sure the ref is ready
      if (likeCountRef.current) {
        // The initial state is hidden, the button will update it if needed
        likeCountRef.current.classList.add('hidden');
      }
    }
  }, [item]);
  
  // Add authentication state
  const { isAuthenticated } = useConvexAuth();
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const viewer = useQuery(api.users.viewer);
  
  // Add state to track if comment is deleted
  const [isDeleted, setIsDeleted] = useState(false);
  
  // Get comments to check ownership
  const commentDetails = useQuery(
    api.comments.getComments, 
    item.type === 'comment' && item.entryGuid ? { entryGuid: item.entryGuid } : 'skip'
  );
  
  // Check if the comment belongs to the current user using ID-based authorization
  useEffect(() => {
    if (isAuthenticated && viewer && item.type === 'comment' && item._id && commentDetails) {
      const commentId = typeof item._id === 'string' ? 
        item._id as unknown as Id<"comments"> : 
        item._id;
      
      // Find the comment in the returned comments
      const comment = commentDetails.find(c => c._id === commentId);
      if (comment) {
        // Use ID-based comparison instead of username
        setIsCurrentUser(viewer._id === comment.userId);
      }
    }
  }, [isAuthenticated, viewer, item, commentDetails]);
  
  // Use Convex mutation for comment deletion
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  
  // Function to delete a comment - updated to use React state
  const deleteComment = useCallback(async () => {
    if (item.type !== 'comment' || !item._id) return;
    
    const commentId = typeof item._id === 'string' ? 
      item._id as unknown as Id<"comments"> : 
      item._id;
    
    try {
      // Use Convex mutation instead of fetch
      await deleteCommentMutation({ commentId });
      
      // Update UI to show comment was deleted using React state
      setIsDeleted(true);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  }, [item, deleteCommentMutation]);
  
  // Function to update the like count text for replies
  const updateReplyLikeCount = useCallback((replyId: string, count: number) => {
    const replyLikeCountElement = replyLikeCountRefs.current.get(replyId);
    if (replyLikeCountElement) {
      if (count > 0) {
        const countText = `${count} ${count === 1 ? 'Like' : 'Likes'}`;
        const countElement = replyLikeCountElement.querySelector('span');
        if (countElement) {
          countElement.textContent = countText;
        }
        replyLikeCountElement.classList.remove('hidden');
      } else {
        replyLikeCountElement.classList.add('hidden');
      }
    }
  }, []);
  
  // Render a single reply with ID-based authorization
  const renderReply = (reply: Comment) => {
    // Check if this reply is deleted using the component-level state
    const isReplyDeleted = deletedReplies.has(reply._id.toString());
    
    // Check if this reply belongs to the current user using ID-based authorization
    const isReplyFromCurrentUser = isAuthenticated && viewer && viewer._id === reply.userId;
    
    // Function to delete a reply - updated to use component-level state
    const deleteReply = () => {
      if (!reply._id) return;
      
      // Use the same Convex mutation for deleting comments
      deleteCommentMutation({ commentId: reply._id })
        .then(() => {
          // Mark this reply as deleted using component-level state
          setDeletedReplies((prev: Set<string>) => {
            const newSet = new Set(prev);
            newSet.add(reply._id.toString());
            return newSet;
          });
        })
        .catch(error => {
          console.error('Error deleting reply:', error);
        });
    };
    
    // If reply is deleted, show a placeholder
    if (isReplyDeleted) {
      return (
        <div key={reply._id} className="mt-0 border-t pl-4 py-4">
          <div className="text-muted-foreground text-sm">This reply has been deleted.</div>
        </div>
      );
    }
    
    // Function to set reference for the like count element
    const setReplyLikeCountRef = (el: HTMLDivElement | null) => {
      if (el && reply._id) {
        replyLikeCountRefs.current.set(reply._id.toString(), el);
      }
    };
    
    // Get profile image - check multiple possible locations based on data structure
    const profileImageUrl = 
      reply.user?.profileImage || // From profiles table
      reply.user?.image ||        // From users table
      null;                       // Fallback
      
    // Get display name from various possible locations
    const displayName = 
      reply.user?.name ||      // From profiles or users table
      reply.username ||        // Fallback to username in comment
      'Anonymous';             // Last resort fallback
    
    return (
      <div key={reply._id} className="mt-0">
        <div className="flex items-start gap-4 border-t pl-4 py-4">
          <ProfileImage 
            profileImage={profileImageUrl}
            username={reply.username}
            size="md-lg"
            className="flex-shrink-0"
          />
          <div className="flex-1 flex">
            <div className="flex-1">
              <div className="flex items-center mb-1">
                <span className="text-sm font-bold leading-none">{displayName}</span>
              </div>
              <p className="text-sm">{reply.content}</p>
              
              {/* Actions row with timestamp and like count */}
              <div className="flex items-center gap-4 mt-1">
                {/* Timestamp */}
                <div className="leading-none font-semibold text-muted-foreground text-xs">
                  {(() => {
                    const now = new Date();
                    const replyDate = new Date(reply._creationTime);
                    
                    // Ensure we're working with valid dates
                    if (isNaN(replyDate.getTime())) {
                      return '';
                    }

                    // Calculate time difference
                    const diffInMs = now.getTime() - replyDate.getTime();
                    const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
                    const diffInHours = Math.floor(diffInMinutes / 60);
                    const diffInDays = Math.floor(diffInHours / 24);
                    const diffInMonths = Math.floor(diffInDays / 30);
                    
                    // Format based on the time difference
                    if (diffInMinutes < 60) {
                      return `${diffInMinutes}m`;
                    } else if (diffInHours < 24) {
                      return `${diffInHours}h`;
                    } else if (diffInDays < 30) {
                      return `${diffInDays}d`;
                    } else {
                      return `${diffInMonths}mo`;
                    }
                  })()}
                </div>
                
                {/* Like count for reply */}
                <div 
                  ref={setReplyLikeCountRef}
                  className="leading-none font-semibold text-muted-foreground text-xs hidden"
                >
                  <span>0 Likes</span>
                </div>
              </div>
            </div>
            
            <div className="flex-shrink-0 flex items-center ml-2 pr-4">
              <div className="flex flex-col items-end w-full">
                {/* Add menu for reply owner at the top */}
                {isReplyFromCurrentUser && (
                  <div className="mb-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent">
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={deleteReply}
                          className="text-red-500 focus:text-red-500 cursor-pointer"
                        >
                          Delete Reply
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                
                {/* Like button */}
                <CommentLikeButton 
                  commentId={reply._id as unknown as Id<"comments">}
                  size="sm"
                  hideCount={true}
                  onCountChange={(count) => updateReplyLikeCount(reply._id.toString(), count)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  switch (item.type) {
    case "like":
      return (
        <span>
          <span className="font-medium">{name}</span> liked{" "}
          <Link href={item.link || "#"} className="text-blue-500 hover:underline">
            {item.title || "a post"}
          </Link>
        </span>
      );
    case "comment":
      // If comment is deleted, show a message
      if (isDeleted) {
        return (
          <div className="p-4 text-muted-foreground text-sm">
            This comment has been deleted.
          </div>
        );
      }
      
      return (
        <div className="flex flex-col">
          <div className="flex items-start gap-4 pl-4 pt-4">
            <ProfileImage 
              profileImage={profileImage}
              username={username}
              size="md-lg"
              className="flex-shrink-0"
            />
            <div className="flex-1 flex pr-4 pb-4">
              <div className="flex-1">
                <div className="flex items-center mb-0">
                  <div className="leading-none mt-[-3px] mb-[5px]">
                    <span className="text-sm font-bold leading-none">{name}</span>
                  </div>
                </div>
                
                {item.content && (
                  <div className="text-sm mb-[7px]">
                    {item.content}
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  {timestamp && (
                    <div className="leading-none font-semibold text-muted-foreground text-xs">
                      {timestamp}
                    </div>
                  )}
                  <div className="leading-none font-semibold text-muted-foreground text-xs">
                    <button 
                      onClick={toggleReplies}
                      className="text-muted-foreground hover:underline focus:outline-none"
                    >
                      Replies
                    </button>
                  </div>
                  <div 
                    ref={likeCountRef} 
                    className="leading-none font-semibold text-muted-foreground text-xs hidden"
                  >
                    <span>0 Likes</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-shrink-0 flex items-center ml-2">
                <div className="flex flex-col items-end w-full">
                  {/* Add the dropdown menu for comment owner at the top */}
                  {isCurrentUser && (
                    <div className="mb-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent">
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={deleteComment}
                            className="text-red-500 focus:text-red-500 cursor-pointer"
                          >
                            Delete Comment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  
                  {item._id && (
                    <CommentLikeButton 
                      commentId={typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id}
                      size="sm"
                      hideCount={true}
                      onCountChange={updateLikeCount}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Replies section - outside the flex layout */}
          {repliesExpanded && (
            <div className="mt-0">
              {repliesLoading ? (
                <div className="py-2 text-sm text-muted-foreground">Loading replies...</div>
              ) : replies.length > 0 ? (
                <div className="space-y-0">
                  {replies.map(reply => renderReply(reply))}
                </div>
              ) : null}
              
              {/* Reply form */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => {
                      // Limit to 500 characters
                      const newValue = e.target.value.slice(0, 500);
                      setReplyText(newValue);
                    }}
                    className="resize-none h-9 py-2 min-h-0 text-sm"
                    maxLength={500}
                    rows={1}
                  />
                  <Button 
                    onClick={submitReply} 
                    disabled={!replyText.trim() || isSubmittingReply}
                    size="sm"
                  >
                    {isSubmittingReply ? (
                      <span className="flex items-center">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Posting...
                      </span>
                    ) : "Reply"}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground text-right mt-1">
                  {replyText.length}/500 characters
                </div>
              </div>
            </div>
          )}
        </div>
      );
    case "retweet":
      return (
        <span className="text-muted-foreground text-sm">
          <span className="font-semibold">{name}</span> <span className="font-semibold">shared</span>
        </span>
      );
  }
}

// Memoized MoreOptionsDropdown component
const MoreOptionsDropdown = React.memo(({ entry }: { entry: RSSEntry }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-transparent p-0">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem asChild>
        <a
          href={entry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer"
        >
          Open in new tab
        </a>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
));
MoreOptionsDropdown.displayName = 'MoreOptionsDropdown';

// Activity card with entry details
const ActivityCard = React.memo(({ 
  activity, 
  username, 
  name,
  profileImage,
  entryDetails,
  getEntryMetrics
}: { 
  activity: ActivityItem; 
  username: string;
  name: string;
  profileImage?: string | null;
  entryDetails?: RSSEntry;
  getEntryMetrics: (entryGuid: string) => InteractionStates;
}) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = entryDetails && currentTrack?.src === entryDetails.link;
  
  // Get metrics for this entry - explicitly memoized to prevent regeneration
  const interactions = useMemo(() => {
    if (!entryDetails) return undefined;
    return getEntryMetrics(entryDetails.guid);
  }, [entryDetails, getEntryMetrics]);
  
  // Format entry timestamp using the same logic as RSSFeedClient
  const entryTimestamp = useMemo(() => {
    if (!entryDetails?.pub_date) return '';

    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let pubDate: Date;
    
    if (typeof entryDetails.pub_date === 'string' && mysqlDateRegex.test(entryDetails.pub_date)) {
      // Convert MySQL datetime string to UTC time
      const [datePart, timePart] = entryDetails.pub_date.split(' ');
      pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      pubDate = new Date(entryDetails.pub_date);
    }
    
    const now = new Date();
    
    // Ensure we're working with valid dates
    if (isNaN(pubDate.getTime())) {
      return '';
    }

    // Calculate time difference
    const diffInMs = now.getTime() - pubDate.getTime();
    const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    
    // For future dates (more than 1 minute ahead), show 'in X'
    const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
    const prefix = isFuture ? 'in ' : '';
    const suffix = isFuture ? '' : ' ago';
    
    // Format based on the time difference
    if (diffInMinutes < 60) {
      return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
    } else if (diffInHours < 24) {
      return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
    } else if (diffInDays < 30) {
      return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
    } else {
      return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
    }
  }, [entryDetails?.pub_date]);

  // Format activity timestamp for comments
  const activityTimestamp = useMemo(() => {
    if (!activity.timestamp) return '';
    
    const now = new Date();
    const activityDate = new Date(activity.timestamp);
    
    // Ensure we're working with valid dates
    if (isNaN(activityDate.getTime())) {
      return '';
    }

    // Calculate time difference
    const diffInMs = now.getTime() - activityDate.getTime();
    const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    
    // For future dates (more than 1 minute ahead), show 'in X'
    const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
    const prefix = isFuture ? 'in ' : '';
    // For comments, we don't want to show "ago"
    const suffix = isFuture ? '' : '';
    
    // Format based on the time difference
    if (diffInMinutes < 60) {
      return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
    } else if (diffInHours < 24) {
      return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
    } else if (diffInDays < 30) {
      return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
    } else {
      return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
    }
  }, [activity.timestamp]);

  // Handle card click for podcasts
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (entryDetails && (entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast')) {
      e.preventDefault();
      playTrack(entryDetails.link, entryDetails.title, entryDetails.image || undefined);
    }
  }, [entryDetails, playTrack]);
  
  // If we don't have entry details, show a simplified card
  if (!entryDetails) {
    return (
      <div className="p-4 rounded-lg shadow-sm mb-4">
        <div className="flex items-start">
          {activity.type !== "comment" && (
            <div className="mt-1 mr-3">
              <ActivityIcon type={activity.type} />
            </div>
          )}
          <div className="flex-1">
            <ActivityDescription 
              item={activity} 
              username={username}
              name={name}
              profileImage={profileImage}
              timestamp={activity.type === "comment" ? activityTimestamp : undefined}
            />
            {activity.type !== "comment" && (
              <div className="text-sm text-gray-500 mt-2">
                {activity.type === "retweet" ? (
                  <span className="hidden">{activityTimestamp}</span>
                ) : (
                  activityTimestamp
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // With entry details, show a rich card similar to EntriesDisplay
  return (
    <article className={activity.type === "comment" ? "relative" : ""}>
      {/* Removed vertical line for comments */}
      
      <div className="p-4">
        {/* Activity header with icon and description */}
        <div className="flex items-start mb-2 relative h-[16px]">
          <div className="mr-2">
            <ActivityIcon type={activity.type} />
          </div>
          <div className="flex-1">
            {activity.type === "like" && (
            <ActivityDescription 
              item={activity} 
              username={username}
              name={name}
              profileImage={profileImage}
              timestamp={undefined}
            />
            )}
            {activity.type === "retweet" && (
              <span className="text-muted-foreground text-sm block leading-none pt-[0px]">
                <span className="font-semibold">{name}</span> <span className="font-semibold">shared</span>
              </span>
            )}
            {activity.type === "comment" && (
              <span className="text-muted-foreground text-sm block leading-none pt-[1px]">
                <span className="font-semibold">{name}</span> <span className="font-semibold">commented</span>
              </span>
            )}
            <div className="text-xs text-gray-500 mt-2">
              {activity.type === "retweet" ? (
                <span className="hidden"></span>
              ) : activity.type === "comment" ? (
                <span className="hidden"></span>
              ) : (
                (() => {
                  if (!entryDetails.pub_date) return '';

                  // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
                  const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                  let pubDate: Date;
                  
                  if (typeof entryDetails.pub_date === 'string' && mysqlDateRegex.test(entryDetails.pub_date)) {
                    // Convert MySQL datetime string to UTC time
                    const [datePart, timePart] = entryDetails.pub_date.split(' ');
                    pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
                  } else {
                    // Handle other formats
                    pubDate = new Date(entryDetails.pub_date);
                  }
                  
                  const now = new Date();
                  
                  // Ensure we're working with valid dates
                  if (isNaN(pubDate.getTime())) {
                    return '';
                  }

                  // Calculate time difference
                  const diffInMs = now.getTime() - pubDate.getTime();
                  const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
                  const diffInHours = Math.floor(diffInMinutes / 60);
                  const diffInDays = Math.floor(diffInHours / 24);
                  const diffInMonths = Math.floor(diffInDays / 30);
                  
                  // For future dates (more than 1 minute ahead), show 'in X'
                  const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
                  const prefix = isFuture ? 'in ' : '';
                  const suffix = isFuture ? '' : ' ago';
                  
                  // Format based on the time difference
                  if (diffInMinutes < 60) {
                    return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
                  } else if (diffInHours < 24) {
                    return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
                  } else if (diffInDays < 30) {
                    return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
                  } else {
                    return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
                  }
                })()
              )}
            </div>
          </div>
        </div>
        
        {/* Different layouts based on activity type */}
        {activity.type === "comment" ? (
          <>
          {/* Featured Image and Title in flex layout */}
          <div className="flex items-start gap-4 mb-4 relative">
            {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
            <div className="flex-shrink-0 relative">
              {(entryDetails.post_featured_img || entryDetails.image) && (
                <div className="w-14 h-14 relative z-10">
                  <Link 
                    href={entryDetails.category_slug && entryDetails.post_slug ? 
                      `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                      entryDetails.link}
                    className="block w-full h-full relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
                    target={entryDetails.category_slug && entryDetails.post_slug ? "_self" : "_blank"}
                    rel={entryDetails.category_slug && entryDetails.post_slug ? "" : "noopener noreferrer"}
                  >
                    <AspectRatio ratio={1}>
                      <Image
                        src={entryDetails.post_featured_img || entryDetails.image || ''}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                        loading="lazy"
                        priority={false}
                      />
                    </AspectRatio>
                  </Link>
                </div>
              )}
            </div>
            
            {/* Title and Timestamp */}
            <div className="flex-grow">
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <Link 
                    href={entryDetails.category_slug && entryDetails.post_slug ? 
                      `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                      entryDetails.link}
                    className="hover:opacity-80 transition-opacity"
                    target={entryDetails.category_slug && entryDetails.post_slug ? "_self" : "_blank"}
                    rel={entryDetails.category_slug && entryDetails.post_slug ? "" : "noopener noreferrer"}
                  >
                    <h3 className="text-base font-semibold text-primary leading-tight">
                      {entryDetails.post_title || entryDetails.feed_title || entryDetails.title}
                    </h3>
                  </Link>
                  <span 
                    className="leading-none text-muted-foreground flex-shrink-0"
                    title={entryDetails.pub_date ? 
                      format(new Date(entryDetails.pub_date), 'PPP p') : 
                      new Date(activity.timestamp).toLocaleString()
                    }
                  >
                    {entryTimestamp}
                  </span>
                </div>
                {/* Use post_media_type if available, otherwise fallback to mediaType */}
                {(entryDetails.post_media_type || entryDetails.mediaType) && (
                  <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground font-medium rounded-md mt-1.5">
                    {(entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast') && 
                      <Podcast className="h-3 w-3" />
                    }
                    {(entryDetails.post_media_type?.toLowerCase() === 'newsletter' || entryDetails.mediaType?.toLowerCase() === 'newsletter') && 
                      <Mail className="h-3 w-3" />
                    }
                    {(entryDetails.post_media_type || entryDetails.mediaType || 'article').charAt(0).toUpperCase() + 
                     (entryDetails.post_media_type || entryDetails.mediaType || 'article').slice(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
                
          {/* Entry Content Card - Full width */}
          <div className="mt-4">
            {(entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast') ? (
              <div>
                <div 
                  onClick={handleCardClick}
                  className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
                >
                  <Card className={`overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                    {entryDetails.image && (
                      <CardHeader className="p-0">
                        <AspectRatio ratio={16/9}>
                          <Image
                            src={entryDetails.image}
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
                        {entryDetails.title}
                      </h3>
                      {entryDetails.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {entryDetails.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <a
                href={entryDetails.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-80 transition-opacity"
              >
                <Card className="overflow-hidden shadow-none">
                  {entryDetails.image && (
                    <CardHeader className="p-0">
                      <AspectRatio ratio={16/9}>
                        <Image
                          src={entryDetails.image}
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
                      {entryDetails.title}
                    </h3>
                    {entryDetails.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {entryDetails.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </a>
            )}
          </div>
          </>
        ) : (
          // Original full-width layout for retweets/likes
          <>
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-start gap-4 mb-4 relative">
          {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
          {(entryDetails.post_featured_img || entryDetails.image) && (
                <div className="flex-shrink-0 w-14 h-14">
              <Link 
                href={entryDetails.category_slug && entryDetails.post_slug ? 
                  `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                  entryDetails.link}
                className="block w-full h-full relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
                target={entryDetails.category_slug && entryDetails.post_slug ? "_self" : "_blank"}
                rel={entryDetails.category_slug && entryDetails.post_slug ? "" : "noopener noreferrer"}
              >
                <AspectRatio ratio={1}>
                  <Image
                    src={entryDetails.post_featured_img || entryDetails.image || ''}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                    loading="lazy"
                    priority={false}
                  />
                </AspectRatio>
              </Link>
            </div>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              <div className="flex items-center justify-between gap-2">
                <Link 
                  href={entryDetails.category_slug && entryDetails.post_slug ? 
                    `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                    entryDetails.link}
                  className="hover:opacity-80 transition-opacity"
                  target={entryDetails.category_slug && entryDetails.post_slug ? "_self" : "_blank"}
                  rel={entryDetails.category_slug && entryDetails.post_slug ? "" : "noopener noreferrer"}
                >
                  <h3 className="text-base font-semibold text-primary leading-tight">
                    {entryDetails.post_title || entryDetails.feed_title || entryDetails.title}
                  </h3>
                </Link>
                <span 
                  className="leading-none text-muted-foreground flex-shrink-0"
                  title={entryDetails.pub_date ? 
                    format(new Date(entryDetails.pub_date), 'PPP p') : 
                    new Date(activity.timestamp).toLocaleString()
                  }
                >
                      {(() => {
                        if (!entryDetails.pub_date) return '';

                        // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
                        const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                        let pubDate: Date;
                        
                        if (typeof entryDetails.pub_date === 'string' && mysqlDateRegex.test(entryDetails.pub_date)) {
                          // Convert MySQL datetime string to UTC time
                          const [datePart, timePart] = entryDetails.pub_date.split(' ');
                          pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
                        } else {
                          // Handle other formats
                          pubDate = new Date(entryDetails.pub_date);
                        }
                        
                        const now = new Date();
                        
                        // Ensure we're working with valid dates
                        if (isNaN(pubDate.getTime())) {
                          return '';
                        }

                        // Calculate time difference
                        const diffInMs = now.getTime() - pubDate.getTime();
                        const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
                        const diffInHours = Math.floor(diffInMinutes / 60);
                        const diffInDays = Math.floor(diffInHours / 24);
                        const diffInMonths = Math.floor(diffInDays / 30);
                        
                        // For future dates (more than 1 minute ahead), show 'in X'
                        const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
                        const prefix = isFuture ? 'in ' : '';
                        const suffix = isFuture ? '' : ' ago';
                        
                        // Format based on the time difference
                        if (diffInMinutes < 60) {
                          return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
                        } else if (diffInHours < 24) {
                          return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
                        } else if (diffInDays < 30) {
                          return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
                        } else {
                          return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
                        }
                      })()}
                </span>
              </div>
              {/* Use post_media_type if available, otherwise fallback to mediaType */}
              {(entryDetails.post_media_type || entryDetails.mediaType) && (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md font-medium mt-1.5">
                  {(entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast') && 
                    <Podcast className="h-3 w-3" />
                  }
                  {(entryDetails.post_media_type?.toLowerCase() === 'newsletter' || entryDetails.mediaType?.toLowerCase() === 'newsletter') && 
                    <Mail className="h-3 w-3" />
                  }
                  {(entryDetails.post_media_type || entryDetails.mediaType || 'article').charAt(0).toUpperCase() + 
                   (entryDetails.post_media_type || entryDetails.mediaType || 'article').slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>

            {/* Entry Content Card - Full width for retweets/likes */}
        <div>
          {(entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast') ? (
            <div>
              <div 
                onClick={handleCardClick}
                className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
              >
                <Card className={`overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                  {entryDetails.image && (
                    <CardHeader className="p-0">
                      <AspectRatio ratio={16/9}>
                        <Image
                          src={entryDetails.image}
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
                      {entryDetails.title}
                    </h3>
                    {entryDetails.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {entryDetails.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <a
              href={entryDetails.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:opacity-80 transition-opacity"
            >
              <Card className="overflow-hidden shadow-none">
                {entryDetails.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={16/9}>
                      <Image
                        src={entryDetails.image}
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
                    {entryDetails.title}
                  </h3>
                  {entryDetails.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {entryDetails.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </a>
          )}
        </div>
          </>
        )}

         {/* Move engagement buttons below the card but within the article container */}
         <div className="flex justify-between items-center h-[32px] pt-4 text-muted-foreground">
          <div>
            <LikeButtonClient
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={interactions?.likes || { isLiked: false, count: 0 }}
            />
          </div>
          <div>
            <CommentSectionClient
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              initialData={interactions?.comments || { count: 0 }}
            />
          </div>
          <div>
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={interactions?.retweets || { isRetweeted: false, count: 0 }}
            />
          </div>
          <div>
            <ShareButtonClient
              url={entryDetails.link}
              title={entryDetails.title}
            />
          </div>
          <div className="flex justify-end">
            <MoreOptionsDropdown entry={entryDetails} />
          </div>
        </div>
      </div>
      
     
      
      <div id={`comments-${entryDetails.guid}`} className={activity.type === "comment" ? "" : "border-t border-border"} />
      
      {/* User Comment Activity - moved below the entry card */}
      {activity.type === "comment" && (
        <div className="border-l border-r border-b border-t relative">
          <div className="relative z-10">
            <ActivityDescription 
              item={activity} 
              username={username}
              name={name}
              profileImage={profileImage}
              timestamp={(() => {
                const now = new Date();
                const commentDate = new Date(activity.timestamp);
                
                // Ensure we're working with valid dates
                if (isNaN(commentDate.getTime())) {
                  return '';
                }

                // Calculate time difference
                const diffInMs = now.getTime() - commentDate.getTime();
                const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
                const diffInHours = Math.floor(diffInMinutes / 60);
                const diffInDays = Math.floor(diffInHours / 24);
                const diffInMonths = Math.floor(diffInDays / 30);
                
                // For future dates (more than 1 minute ahead), show 'in X'
                const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
                const prefix = isFuture ? 'in ' : '';
                // Remove suffix for comments to eliminate "ago"
                const suffix = isFuture ? '' : '';
                
                // Format based on the time difference
                if (diffInMinutes < 60) {
                  return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
                } else if (diffInHours < 24) {
                  return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
                } else if (diffInDays < 30) {
                  return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
                } else {
                  return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
                }
              })()}
            />
          </div>
        </div>
      )}
    </article>
  );
});
ActivityCard.displayName = 'ActivityCard';

/**
 * Client component that displays a user's activity feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
export function UserActivityFeed({ userId, username, name, profileImage, initialData, pageSize = 30, apiEndpoint = "/api/activity" }: UserActivityFeedProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>(initialData?.activities || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false);
  const [entryDetails, setEntryDetails] = useState<Record<string, RSSEntry>>(initialData?.entryDetails || {});
  const [currentSkip, setCurrentSkip] = useState(initialData?.activities.length || 0);
  const totalCount = initialData?.totalCount || 0;
  
  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(!initialData?.activities.length);
  
  // Get audio context at the component level
  const { playTrack, currentTrack } = useAudio();
  
  // Get entry guids for metrics
  const entryGuids = useMemo(() => 
    activities.map(activity => activity.entryGuid), 
    [activities]
  );
  
  // Use our custom hook for metrics
  const { getEntryMetrics, isLoading: isMetricsLoading } = useEntriesMetrics(
    entryGuids,
    initialData?.entryMetrics
  );

  // Group activities by entry GUID for comments
  const groupedActivities = useMemo(() => {
    // Create a map to store activities by entry GUID and type
    const groupedMap = new Map<string, Map<string, ActivityItem[]>>();
    
    // First pass: collect all activities by entry GUID and type
    activities.forEach(activity => {
      const key = activity.entryGuid;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, new Map());
      }
      
      // Group only comments together, keep likes and retweets separate
      const typeKey = activity.type === 'comment' ? 'comment' : `${activity.type}-${activity._id}`;
      
      if (!groupedMap.get(key)!.has(typeKey)) {
        groupedMap.get(key)!.set(typeKey, []);
      }
      groupedMap.get(key)!.get(typeKey)!.push(activity);
    });
    
    // Second pass: create final structure
    const result: Array<{
      entryGuid: string;
      firstActivity: ActivityItem;
      comments: ActivityItem[];
      hasMultipleComments: boolean;
      type: string;
    }> = [];
    
    groupedMap.forEach((typeMap, entryGuid) => {
      typeMap.forEach((activitiesForType, typeKey) => {
        // Sort activities by timestamp (oldest first)
        const sortedActivities = [...activitiesForType].sort((a, b) => a.timestamp - b.timestamp);
        
        if (typeKey === 'comment') {
          // For comments, group them together
          result.push({
            entryGuid,
            firstActivity: sortedActivities[0],
            comments: sortedActivities,
            hasMultipleComments: sortedActivities.length > 1,
            type: 'comment'
          });
        } else {
          // For likes and retweets, each is a separate entry
          sortedActivities.forEach(activity => {
            result.push({
              entryGuid,
              firstActivity: activity,
              comments: [],
              hasMultipleComments: false,
              type: activity.type
            });
          });
        }
      });
    });
    
    // Sort the result by the timestamp of the first activity (newest first for the feed)
    return result.sort((a, b) => b.firstActivity.timestamp - a.firstActivity.timestamp);
  }, [activities]);

  // Log when initial data is received
  useEffect(() => {
    if (initialData?.activities) {
      console.log('📋 Initial activity data received from server:', {
        activitiesCount: initialData.activities.length,
        totalCount: initialData.totalCount,
        hasMore: initialData.hasMore,
        entryDetailsCount: Object.keys(initialData.entryDetails || {}).length,
        entryMetricsCount: Object.keys(initialData.entryMetrics || {}).length
      });
      
      // Explicitly check if we have metrics in the initial data
      if (initialData.entryMetrics && Object.keys(initialData.entryMetrics).length > 0) {
        console.log('🔢 Initial metrics will be used for rendering');
      }
      
      setActivities(initialData.activities);
      setEntryDetails(initialData.entryDetails || {});
      setHasMore(initialData.hasMore);
      setCurrentSkip(initialData.activities.length);
      setIsInitialLoad(false);
    }
  }, [initialData]);

  // Function to load more activities
  const loadMoreActivities = useCallback(async () => {
    if (isLoading || !hasMore) {
      console.log(`⚠️ Not loading more: isLoading=${isLoading}, hasMore=${hasMore}`);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log(`📡 Fetching more activities from API, skip=${currentSkip}, limit=${pageSize}`);
      
      // Use the API route to fetch the next page
      const result = await fetch(`${apiEndpoint}?userId=${userId}&skip=${currentSkip}&limit=${pageSize}`);
      
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      
      const data = await result.json();
      console.log(`📦 Received data from API:`, {
        activitiesCount: data.activities?.length || 0,
        hasMore: data.hasMore,
        entryDetailsCount: Object.keys(data.entryDetails || {}).length,
        entryMetricsCount: Object.keys(data.entryMetrics || {}).length
      });
      
      if (!data.activities?.length) {
        console.log('⚠️ No activities returned from API');
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      setActivities(prev => [...prev, ...data.activities]);
      setEntryDetails(prev => ({...prev, ...data.entryDetails}));
      setCurrentSkip(prev => prev + data.activities.length);
      setHasMore(data.hasMore);
      
      console.log(`📊 Updated state - total activities: ${activities.length + data.activities.length}, hasMore: ${data.hasMore}`);
    } catch (error) {
      console.error('❌ Error loading more activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentSkip, userId, pageSize, activities.length, apiEndpoint]);

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    const checkContentHeight = () => {
      if (!loadMoreRef.current || !hasMore || isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && activities.length > 0) {
        console.log('📏 Content is shorter than viewport, loading more activities');
        loadMoreActivities();
      }
    };
    
    // Run the check after a short delay to ensure the DOM has updated
    const timer = setTimeout(checkContentHeight, 1000);
    
    return () => clearTimeout(timer);
  }, [activities.length, hasMore, isLoading, loadMoreActivities]);

  // Loading state - only show for initial load and initial metrics fetch
  if ((isLoading && isInitialLoad) || (isInitialLoad && activities.length > 0 && isMetricsLoading)) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading activity...</span>
      </div>
    );
  }

  // No activities state
  if (activities.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No activity found for this user.</p>
      </div>
    );
  }

  // Render a group of activities for the same entry
  const renderActivityGroup = (group: {
    entryGuid: string;
    firstActivity: ActivityItem;
    comments: ActivityItem[];
    hasMultipleComments: boolean;
    type: string;
  }, index: number) => {
    const entryDetail = entryDetails[group.entryGuid];
    
    if (!entryDetail) {
      return null;
    }
    
    // Get metrics for this entry
    const interactions = getEntryMetrics(entryDetail.guid);
    
    // Check if this entry is currently playing
    const isCurrentlyPlaying = currentTrack?.src === entryDetail.link;
    
    // Handle card click for podcasts
    const handleCardClick = (e: React.MouseEvent) => {
      if (entryDetail && (entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast')) {
        e.preventDefault();
        playTrack(entryDetail.link, entryDetail.title, entryDetail.image || undefined);
      }
    };
    
    // If this is a like or retweet, or there's only one comment, render a regular ActivityCard
    if (group.type !== 'comment' || group.comments.length <= 1) {
      return (
        <ActivityCard 
          key={`group-${group.entryGuid}-${group.type}-${index}`}
          activity={group.firstActivity}
          username={username}
          name={name}
          profileImage={profileImage}
          entryDetails={entryDetail}
          getEntryMetrics={getEntryMetrics}
        />
      );
    }
    
    // For multiple comments, render a special daisy-chained version
    return (
      <article key={`group-${group.entryGuid}-${group.type}-${index}`} className="relative">
        <div className="p-4">
          {/* Activity header with icon and description */}
          <div className="flex items-start mb-2 relative h-[16px]">
            <div className="mr-2">
              <ActivityIcon type={group.firstActivity.type} />
            </div>
            <div className="flex-1">
              <span className="text-muted-foreground text-sm block leading-none pt-[1px]">
                <span className="font-semibold">{name}</span> <span className="font-semibold">commented</span>
              </span>
            </div>
          </div>
          
          {/* Featured Image and Title */}
          <div className="flex items-start gap-4 mb-4 relative">
            {/* Featured Image */}
            <div className="flex-shrink-0 relative">
              {(entryDetail.post_featured_img || entryDetail.image) && (
                <div className="w-14 h-14 relative z-10">
                  <Link 
                    href={entryDetail.category_slug && entryDetail.post_slug ? 
                      `/${entryDetail.category_slug}/${entryDetail.post_slug}` : 
                      entryDetail.link}
                    className="block w-full h-full relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
                    target={entryDetail.category_slug && entryDetail.post_slug ? "_self" : "_blank"}
                    rel={entryDetail.category_slug && entryDetail.post_slug ? "" : "noopener noreferrer"}
                  >
                    <AspectRatio ratio={1}>
                      <Image
                        src={entryDetail.post_featured_img || entryDetail.image || ''}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                        loading="lazy"
                        priority={false}
                      />
                    </AspectRatio>
                  </Link>
                </div>
              )}
            </div>
            
            {/* Title and Timestamp */}
            <div className="flex-grow">
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <Link 
                    href={entryDetail.category_slug && entryDetail.post_slug ? 
                      `/${entryDetail.category_slug}/${entryDetail.post_slug}` : 
                      entryDetail.link}
                    className="hover:opacity-80 transition-opacity"
                    target={entryDetail.category_slug && entryDetail.post_slug ? "_self" : "_blank"}
                    rel={entryDetail.category_slug && entryDetail.post_slug ? "" : "noopener noreferrer"}
                  >
                    <h3 className="text-base font-semibold text-primary leading-tight">
                      {entryDetail.post_title || entryDetail.feed_title || entryDetail.title}
                    </h3>
                  </Link>
                  <span 
                    className="leading-none text-muted-foreground flex-shrink-0"
                    title={entryDetail.pub_date ? 
                      format(new Date(entryDetail.pub_date), 'PPP p') : 
                      new Date(group.firstActivity.timestamp).toLocaleString()
                    }
                  >
                    {(() => {
                      if (!entryDetail.pub_date) return '';

                      // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
                      const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                      let pubDate: Date;
                      
                      if (typeof entryDetail.pub_date === 'string' && mysqlDateRegex.test(entryDetail.pub_date)) {
                        // Convert MySQL datetime string to UTC time
                        const [datePart, timePart] = entryDetail.pub_date.split(' ');
                        pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
                      } else {
                        // Handle other formats
                        pubDate = new Date(entryDetail.pub_date);
                      }
                      
                      const now = new Date();
                      
                      // Ensure we're working with valid dates
                      if (isNaN(pubDate.getTime())) {
                        return '';
                      }

                      // Calculate time difference
                      const diffInMs = now.getTime() - pubDate.getTime();
                      const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
                      const diffInHours = Math.floor(diffInMinutes / 60);
                      const diffInDays = Math.floor(diffInHours / 24);
                      const diffInMonths = Math.floor(diffInDays / 30);
                      
                      // For future dates (more than 1 minute ahead), show 'in X'
                      const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
                      const prefix = isFuture ? 'in ' : '';
                      const suffix = isFuture ? '' : ' ago';
                      
                      // Format based on the time difference
                      if (diffInMinutes < 60) {
                        return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
                      } else if (diffInHours < 24) {
                        return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
                      } else if (diffInDays < 30) {
                        return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
                      } else {
                        return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
                      }
                    })()}
                  </span>
                </div>
                {/* Media type badge */}
                {(entryDetail.post_media_type || entryDetail.mediaType) && (
                  <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground font-medium rounded-md mt-1.5">
                    {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') && 
                      <Podcast className="h-3 w-3" />
                    }
                    {(entryDetail.post_media_type?.toLowerCase() === 'newsletter' || entryDetail.mediaType?.toLowerCase() === 'newsletter') && 
                      <Mail className="h-3 w-3" />
                    }
                    {(entryDetail.post_media_type || entryDetail.mediaType || 'article').charAt(0).toUpperCase() + 
                     (entryDetail.post_media_type || entryDetail.mediaType || 'article').slice(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
                
          {/* Entry Content Card */}
          <div className="mt-4">
            {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') ? (
              <div>
                <div 
                  onClick={handleCardClick}
                  className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
                >
                  <Card className={`overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                    {entryDetail.image && (
                      <CardHeader className="p-0">
                        <AspectRatio ratio={16/9}>
                          <Image
                            src={entryDetail.image}
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
                        {entryDetail.title}
                      </h3>
                      {entryDetail.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {entryDetail.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <a
                href={entryDetail.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-80 transition-opacity"
              >
                <Card className="overflow-hidden shadow-none">
                  {entryDetail.image && (
                    <CardHeader className="p-0">
                      <AspectRatio ratio={16/9}>
                        <Image
                          src={entryDetail.image}
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
                      {entryDetail.title}
                    </h3>
                    {entryDetail.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {entryDetail.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </a>
            )}
          </div>
             {/* Add engagement buttons below the card */}
             <div className="flex justify-between items-center h-[32px] pt-4 text-muted-foreground">
             <div>
              <LikeButtonClient
                entryGuid={entryDetail.guid}
                feedUrl={entryDetail.feed_url || ''}
                title={entryDetail.title}
                pubDate={entryDetail.pub_date}
                link={entryDetail.link}
                initialData={interactions.likes}
              />
            </div>
            <div>
              <CommentSectionClient
                entryGuid={entryDetail.guid}
                feedUrl={entryDetail.feed_url || ''}
                initialData={interactions.comments}
              />
            </div>
            <div>
              <RetweetButtonClientWithErrorBoundary
                entryGuid={entryDetail.guid}
                feedUrl={entryDetail.feed_url || ''}
                title={entryDetail.title}
                pubDate={entryDetail.pub_date}
                link={entryDetail.link}
                initialData={interactions.retweets}
              />
            </div>
            <div>
              <ShareButtonClient
                url={entryDetail.link}
                title={entryDetail.title}
              />
            </div>
            <div className="flex justify-end">
              <MoreOptionsDropdown entry={entryDetail} />
            </div>
          </div>
        </div>

     
        
        <div id={`comments-${entryDetail.guid}`} className="" />
        
        {/* Render all comments in chronological order */}
        <div className="border-l border-r border-b">
          {group.comments.map((comment) => {
            return (
              <div 
                key={`comment-${comment._id}`} 
                className="p-4 border-t relative"
              >
                {/* Comment content */}
                <div className="relative z-10">
                  <ActivityDescription 
                    item={comment} 
                    username={username}
                    name={name}
                    profileImage={profileImage}
                    timestamp={(() => {
                      const now = new Date();
                      const commentDate = new Date(comment.timestamp);
                      
                      // Ensure we're working with valid dates
                      if (isNaN(commentDate.getTime())) {
                        return '';
                      }

                      // Calculate time difference
                      const diffInMs = now.getTime() - commentDate.getTime();
                      const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
                      const diffInHours = Math.floor(diffInMinutes / 60);
                      const diffInDays = Math.floor(diffInHours / 24);
                      const diffInMonths = Math.floor(diffInDays / 30);
                      
                      // For future dates (more than 1 minute ahead), show 'in X'
                      const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
                      const prefix = isFuture ? 'in ' : '';
                      // Remove suffix for comments to eliminate "ago"
                      const suffix = isFuture ? '' : '';
                      
                      // Format based on the time difference
                      if (diffInMinutes < 60) {
                        return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
                      } else if (diffInHours < 24) {
                        return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
                      } else if (diffInDays < 30) {
                        return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
                      } else {
                        return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
                      }
                    })()}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </article>
    );
  };

  return (
    <div className="w-full">
      <Virtuoso
        useWindowScroll
        data={groupedActivities}
        endReached={loadMoreActivities}
        overscan={200}
        itemContent={(index, group) => renderActivityGroup(group, index)}
        components={{
          Footer: () => (
            <div className="py-4 text-center">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading more...</span>
                </div>
              ) : hasMore ? (
                <div className="h-8" />
              ) : (
                <div className="text-muted-foreground text-sm py-2">
                  {activities.length > 0 ? 
                    `Showing ${activities.length} of ${totalCount} activities` : 
                    "No activities"
                  }
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  );
} 