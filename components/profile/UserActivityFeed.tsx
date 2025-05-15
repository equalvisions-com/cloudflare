"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Heart, MessageCircle, Repeat, Loader2, ChevronDown, Bookmark, Mail, Podcast, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Virtuoso } from 'react-virtuoso';
import React, { useCallback, useEffect, useRef, useState, useMemo, useReducer } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAudio } from '@/components/audio-player/AudioContext';
import { useQuery, useConvexAuth, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ProfileImage } from "@/components/profile/ProfileImage";
import { CommentLikeButton } from "@/components/comment-section/CommentLikeButton";
import { Textarea } from "@/components/ui/textarea";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";

// Add a consistent logging utility
const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📋 ${message}`, data !== undefined ? data : '');
    }
  },
  info: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`ℹ️ ${message}`, data !== undefined ? data : '');
    }
  },
  warn: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️ ${message}`, data !== undefined ? data : '');
    }
  },
  error: (message: string, error?: unknown) => {
    console.error(`❌ ${message}`, error !== undefined ? error : '');
  }
};

// Types for activity items
type ActivityItem = {
  type: "comment" | "retweet";
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
  verified?: boolean; // Add verified field
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
  isActive?: boolean;
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
  
  // Create a stable representation of entry guids - FIX MEMOIZATION
  const memoizedGuids = useMemo(() => 
    entryGuids.length > 0 ? entryGuids : [],
    // Use proper dependency array instead of join(',')
    [entryGuids]
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

// Memoize ActivityIcon
const ActivityIcon = React.memo(({ type }: { type: "comment" | "retweet" }) => {
  switch (type) {
    case "comment":
      return <MessageCircle className="h-4 w-4 text-muted-foreground stroke-[2.5px]" />;
    case "retweet":
      return <Repeat className="h-4 w-4 text-muted-foreground stroke-[2.5px]" />;
  }
});
ActivityIcon.displayName = 'ActivityIcon'; // Add display name for React DevTools

// Export ActivityDescription for reuse
// Memoize ActivityDescription
export const ActivityDescription = React.memo(({ item, username, name, profileImage, timestamp }: {
  item: ActivityItem;
  username: string;
  name: string;
  profileImage?: string | null;
  timestamp?: string;
}) => {
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
  // State to track if user is actively replying to the main comment
  const [isReplying, setIsReplying] = useState(false);
  // Add authentication state
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  const router = useRouter();
  // Use Convex mutation for comment deletion
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  // Use the same addComment mutation for replies
  const addComment = useMutation(api.comments.addComment);
  // Add state to track if comment is deleted
  const [isDeleted, setIsDeleted] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);

  // Always call useQuery with the same pattern regardless of condition
  // This fixes the "rendered more hooks" error by ensuring consistent hook usage
  const commentRepliesQuery = useQuery(
    api.comments.getCommentReplies,
    item.type === 'comment' && item._id 
      ? { commentId: typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id }
      : 'skip'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.type, item._id, commentRepliesQuery]); // Use item.type, item._id instead of whole item

  // Use effect to update replies whenever the query result changes
  useEffect(() => {
    if (repliesExpanded && commentRepliesQuery && item.type === 'comment' && item._id) {
      setReplies(commentRepliesQuery || []);
      setRepliesLoaded(true);
      setRepliesLoading(false);
    }
  }, [repliesExpanded, commentRepliesQuery, item.type, item._id]);

  // Toggle replies visibility
  const toggleReplies = useCallback(() => {
    const newExpandedState = !repliesExpanded;
    setRepliesExpanded(newExpandedState);

    if (newExpandedState && !repliesLoaded && item.type === 'comment' && item._id) {
      fetchReplies();
    }
  }, [repliesExpanded, fetchReplies, repliesLoaded, item.type, item._id]);

  // Extract ReplyRenderer to a separate component to avoid hook issues in loops
  const ReplyRenderer = React.memo(({ reply, index }: { reply: Comment, index: number }) => {
    // Check if this reply is deleted using the component-level state
    const isReplyDeleted = deletedReplies.has(reply._id.toString());

    // Check if this reply belongs to the current user using ID-based authorization
    const isReplyFromCurrentUser = isAuthenticated && viewer && viewer._id === reply.userId;

    // Pre-define deleteReply function reference - moved outside the component
    const deleteReplyRef = useRef<() => void>();
    
    // Use useEffect to update the function when dependencies change
    useEffect(() => {
      deleteReplyRef.current = () => {
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
    }, [reply._id]); // Removed deleteCommentMutation
    
    // Function to delete a reply that uses the ref
    const deleteReply = () => {
      if (deleteReplyRef.current) {
        deleteReplyRef.current();
      }
    };

    // If reply is deleted, show a placeholder
    if (isReplyDeleted) {
      return (
        <div key={reply._id.toString()} className="mt-0 border-t pl-4 py-4">
          <div className="text-muted-foreground text-sm">This reply has been deleted.</div>
        </div>
      );
    }

    // Function to set reference for the like count element
    const setReplyLikeCountRef = (el: HTMLDivElement | null) => {
      if (el && reply._id) {
        replyLikeCountRefs.current.set(reply._id.toString(), el);
      } else if (!el && reply._id) {
        replyLikeCountRefs.current.delete(reply._id.toString()); // Clean up ref map
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

    // Calculate timestamp
    const replyTimestamp = (() => {
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

      // For future dates (more than 1 minute ahead), show 'in X'
      const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
      const prefix = isFuture ? 'in ' : '';
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
    })();

    // Function to update the like count text for replies
    const updateReplyLikeCount = (count: number) => {
      const replyLikeCountElement = replyLikeCountRefs.current.get(reply._id.toString());
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
    };

    return (
      <div key={reply._id.toString()} className="mt-0">
        {/* Add padding-left here to indent replies */}
        {/* Conditionally apply border-t based on index */}
        <div className={`flex items-start gap-4 ${index !== 0 ? 'border-t' : ''} pl-11 py-4`}>
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
                  {replyTimestamp}
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
                  onCountChange={(count) => updateReplyLikeCount(count)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });
  ReplyRenderer.displayName = 'ReplyRenderer';

  // Render the replies section
  const renderRepliesSection = () => {
    if (!repliesExpanded) return null;
    
    return (
      <div className="mt-0 border-t">
        {repliesLoading ? (
          <div className="py-2 pl-4 text-sm text-muted-foreground">Loading replies...</div>
        ) : replies.length > 0 ? (
          <div className="space-y-0">
            {replies
              .filter(reply => !deletedReplies.has(reply._id.toString()))
              .map((reply, index) => (
                <ReplyRenderer key={reply._id.toString()} reply={reply} index={index} />
              ))}
          </div>
        ) : (
          <div className="py-2 pl-4 text-sm text-muted-foreground">No replies yet.</div>
        )}
      </div>
    );
  };

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

      // Clear the input and hide the reply form
      setReplyText('');
      setIsReplying(false); // Hide the input form

      // The replies will automatically update through the Convex subscription
      // No need to manually fetch them again
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyText, isSubmittingReply, item.type, item._id, item.entryGuid, item.feedUrl, addComment]); // Use specific item fields

  // Function to update the like count text (ref dependent, useCallback might not be necessary but harmless)
  const updateLikeCount = useCallback((count: number) => {
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
  }, []); // Ref dependency doesn't need to be listed

  // Function to initiate replying to the main comment
  const handleReplyClick = useCallback(() => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    // Toggle the replying state
    setIsReplying(current => !current); // Use functional update
    if (isReplying) { // If it *was* replying, clear text
      setReplyText('');
    }
  }, [isAuthenticated, router, isReplying]);

  // Function to cancel replying
  const cancelReplyClick = useCallback(() => {
    setIsReplying(false);
    setReplyText(''); // Clear text on cancel
  }, []); // No dependencies

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.type, item._id]); // Specific item fields

  // Get comments to check ownership
  const commentDetails = useQuery(
    api.comments.getComments,
    item.type === 'comment' && item.entryGuid 
      ? { entryGuid: item.entryGuid } 
      : 'skip'
  );

  // Check if the comment belongs to the current user using ID-based authorization
  useEffect(() => {
    if (isAuthenticated && viewer && item.type === 'comment' && item._id && commentDetails) {
      const commentId = typeof item._id === 'string' ?
        item._id as unknown as Id<"comments"> :
        item._id;

      // Find the comment in the returned comments
      const comment = commentDetails.find(c => c._id === commentId);
      // Use ID-based comparison instead of username
      setIsCurrentUser(!!comment && viewer._id === comment.userId); // Ensure comment exists
    } else {
      setIsCurrentUser(false); // Reset if conditions not met
    }
  }, [isAuthenticated, viewer, item.type, item._id, commentDetails]); // Specific item fields

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.type, item._id, deleteCommentMutation]); // Specific item fields

  switch (item.type) {
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
                  <div 
                    ref={likeCountRef} 
                    className="leading-none font-semibold text-muted-foreground text-xs hidden"
                  >
                    <span>0 Likes</span>
                  </div>
                  {/* Reply button - only for the main comment */}
                  <div className="leading-none font-semibold text-muted-foreground text-xs">
                    <button 
                      onClick={handleReplyClick}
                      className="text-muted-foreground hover:underline focus:outline-none"
                    >
                      {isReplying ? 'Cancel Reply' : 'Reply'}
                    </button>
                  </div>
                  {/* View/Hide Replies Button - Only show if we have an ID */}
                  {item._id && (commentRepliesQuery?.length ?? 0) > 0 && (
                    <div className="leading-none font-semibold text-muted-foreground text-xs">
                      <button 
                        onClick={toggleReplies}
                        className="text-muted-foreground hover:underline focus:outline-none"
                      >
                        {repliesExpanded 
                          ? "Hide Replies" 
                          : `View Replies (${commentRepliesQuery?.length ?? 0})`}
                      </button>
                    </div>
                  )}
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
          
          {/* Reply Input Form - Conditionally shown */}
          {isReplying && (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  placeholder={`Replying to ${name}...`}
                  value={replyText}
                  onChange={(e) => {
                    const newValue = e.target.value.slice(0, 500);
                    setReplyText(newValue);
                  }}
                  className="resize-none h-9 py-2 min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  maxLength={500}
                  rows={1}
                  autoFocus // Focus the input when it appears
                />
                <Button 
                  onClick={submitReply} 
                  disabled={!replyText.trim() || isSubmittingReply}
                  size="sm" className="h-9 text-sm font-medium"
                >
                  {isSubmittingReply ? (
                    <span className="flex items-center">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Posting...
                    </span>
                  ) : "Post"}
                </Button>
              </div>
              <div className="flex justify-between items-center mt-1">
                <button 
                  onClick={cancelReplyClick}
                  className="text-xs text-muted-foreground hover:underline flex items-center font-semibold"
                >
                  <X className="h-3.5 w-3.5 mr-1 stroke-[2.5]" />
                  Cancel
                </button>
                <div className="text-xs text-muted-foreground text-right">
                  {replyText.length}/500 characters
                </div>
              </div>
            </div>
          )}

          {/* Replies section - Use the extracted renderRepliesSection function */}
          {renderRepliesSection()}
        </div>
      );
    case "retweet":
      return (
        <span className="text-muted-foreground text-sm">
          <span className="font-semibold">{name}</span> <span className="font-semibold">shared</span>
        </span>
      );
    default:
      return null;
  }
});
// Add display name for React DevTools
ActivityDescription.displayName = 'ActivityDescription';

// Now extract timestamp formatting to utility functions at the top level, above all components

/**
 * Utility function to format time ago for display
 * @param timestamp Unix timestamp or date string
 * @returns Formatted time string (e.g. "5m", "2h", "3d")
 */
const formatTimeAgo = (timestamp: number | string): string => {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = new Date(timestamp);
  
  // Ensure we're working with valid dates
  if (isNaN(date.getTime())) {
    return '';
  }

  // Calculate time difference
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInMonths = Math.floor(diffInDays / 30);
  
  // For future dates (more than 1 minute ahead), show 'in X'
  const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
  const prefix = isFuture ? 'in ' : '';
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
};

// Activity card with entry details
// Memoize ActivityCard
const ActivityCard = React.memo(({
  activity,
  username,
  name,
  profileImage,
  entryDetail,
  getEntryMetrics,
  onOpenCommentDrawer
}: {
  activity: ActivityItem;
  username: string;
  name: string;
  profileImage?: string | null;
  entryDetail?: RSSEntry;
  getEntryMetrics: (entryGuid: string) => InteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}) => {
  const { playTrack, currentTrack } = useAudio();
  
  // Extract primitive values from objects for dependency arrays
  const entryGuid = entryDetail?.guid;
  const feedUrl = entryDetail?.feed_url || '';
  const entryLink = entryDetail?.link;
  const entryTitle = entryDetail?.title;
  const entryImage = entryDetail?.image;
  const entryMediaType = entryDetail?.post_media_type?.toLowerCase();
  const entryAlternativeMediaType = entryDetail?.mediaType?.toLowerCase();
  const isPodcast = entryMediaType === 'podcast' || entryAlternativeMediaType === 'podcast';
  
  // Use primitive isCurrentlyPlaying
  const isCurrentlyPlaying = useMemo(() =>
    Boolean(entryLink && currentTrack?.src === entryLink),
    [entryLink, currentTrack?.src]
  );

  // Get metrics for this entry - explicitly memoized to prevent regeneration
  const interactions = useMemo(() => {
    if (!entryGuid) return undefined;
    return getEntryMetrics(entryGuid);
  }, [entryGuid, getEntryMetrics]);

  // Format entry timestamp using shared formatter
  const entryTimestamp = useMemo(() => {
    if (!entryDetail?.pub_date) return '';
    return formatTimeAgo(entryDetail.pub_date);
  }, [entryDetail?.pub_date]);

  // Format activity timestamp for comments
  const activityTimestamp = useMemo(() => {
    if (!activity.timestamp) return '';
    return formatTimeAgo(activity.timestamp);
  }, [activity.timestamp]);

  // Handle card click for podcasts with primitive dependencies
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isPodcast && entryLink) {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entryLink, entryTitle || '', entryImage);
    }
  }, [isPodcast, entryLink, entryTitle, entryImage, playTrack]);
  
  // Helper function to prevent scroll jumping on link interaction
  const handleLinkInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Let the event continue for the click
    // but prevent the focus-triggered scrolling afterward
    const target = e.currentTarget as HTMLElement;
    
    // Use a one-time event listener that removes itself after execution
    target.addEventListener('focusin', (focusEvent) => {
      focusEvent.preventDefault();
      // Immediately blur to prevent scroll adjustments
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        setTimeout(() => {
          // Use setTimeout to allow the click to complete first
          activeElement.blur();
        }, 0);
      }
    }, { once: true });
  }, []);

  // Memoize the comment drawer click handler
  const handleCommentClick = useCallback(() => {
    if (entryGuid) {
      onOpenCommentDrawer(entryGuid, feedUrl, interactions?.comments);
    }
  }, [entryGuid, feedUrl, interactions?.comments, onOpenCommentDrawer]);

  // Add handler to prevent focus when clicking non-interactive elements
  const handleNonInteractiveMouseDown = useCallback((e: React.MouseEvent) => {
    // Skip focus prevention for drawer content or input fields
    const target = e.target as HTMLElement;
    const isInDrawer = target.closest('[data-drawer-content]') || 
                       target.closest('[role="dialog"]');
    const isInputField = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;
                       
    if (isInDrawer || isInputField) {
      return;
    }
    
    // Only prevent default if this isn't an interactive element
    if (
      target.tagName !== 'BUTTON' && 
      target.tagName !== 'A' && 
      target.tagName !== 'INPUT' && 
      !target.closest('button') && 
      !target.closest('a') && 
      !target.closest('input')
    ) {
      e.preventDefault();
    }
  }, []);

  // If we don't have entry details, show a simplified card
  if (!entryDetail) {
    // Memoize the simple card content if necessary, but often not needed for simple displays
    return (
      <div 
        className="p-4 rounded-lg shadow-sm mb-4"
        tabIndex={-1}
        onMouseDown={handleNonInteractiveMouseDown}
      >
        <div className="flex items-start">
          {activity.type !== "comment" && (
            <div className="mt-1 mr-3">
               {/* Use memoized ActivityIcon */}
              <ActivityIcon type={activity.type} />
            </div>
          )}
          <div className="flex-1">
             {/* Use memoized ActivityDescription */}
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
                  // Ensure activityTimestamp is used correctly here if needed
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
    // Use activity._id or a combination for the key if possible, or index as fallback
    <article 
      key={activity._id ? activity._id.toString() : activity.entryGuid} 
      className={`${activity.type === "comment" ? "relative" : ""} outline-none focus:outline-none focus-visible:outline-none`}
      onClick={(e) => {
        // Stop all click events from bubbling up to parent components
        e.stopPropagation();
      }}
      tabIndex={-1}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Removed vertical line for comments */}

      <div className="p-4">
        {/* Activity header with icon and description */}
        <div className="flex items-start mb-2 relative h-[16px]">
          <div className="mr-2">
             {/* Use memoized ActivityIcon */}
            <ActivityIcon type={activity.type} />
          </div>
          <div className="flex-1">
            {/* Only show retweets and comments */}
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
          </div>
        </div>
        
        {/* Different layouts based on activity type */}
        {activity.type === "comment" ? (
          <>
          {/* Featured Image and Title in flex layout */}
          <div className="flex items-start gap-4 mb-4 relative mt-4">
            {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
            <div className="flex-shrink-0 relative">
              {(entryDetail.post_featured_img || entryDetail.image) && (
                <div className="w-12 h-12 relative z-10">
                  <Link
                    href={entryDetail.post_slug ?
                      (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ?
                        `/newsletters/${entryDetail.post_slug}` :
                        entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast' ?
                          `/podcasts/${entryDetail.post_slug}` :
                          entryDetail.category_slug ?
                            `/${entryDetail.category_slug}/${entryDetail.post_slug}` :
                            entryDetail.link) :
                          entryDetail.link}
                    className="block w-full h-full relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                    target={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                                  entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                        ? "_self" : "_blank"}
                    rel={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                               entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                      ? "" : "noopener noreferrer"}
                    onMouseDown={handleLinkInteraction}
                  >
                    <AspectRatio ratio={1}>
                      <Image
                        src={entryDetail.post_featured_img || entryDetail.image || ''}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
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
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={entryDetail.post_slug ?
                      (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ?
                        `/newsletters/${entryDetail.post_slug}` :
                        entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast' ?
                          `/podcasts/${entryDetail.post_slug}` :
                          entryDetail.category_slug ?
                            `/${entryDetail.category_slug}/${entryDetail.post_slug}` :
                            entryDetail.link) :
                          entryDetail.link}
                    className="hover:opacity-80 transition-opacity"
                    target={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                                  entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                        ? "_self" : "_blank"}
                    rel={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                               entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                      ? "" : "noopener noreferrer"}
                    onMouseDown={handleLinkInteraction}
                  >
                    <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-2 mt-[2.5px]">
                      {entryDetail.post_title || entryDetail.feed_title || entryDetail.title}
                      {entryDetail.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h3>
                  </Link>
                  <span
                    className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                    title={entryDetail.pub_date ?
                      format(new Date(entryDetail.pub_date), 'PPP p') :
                      new Date(activity.timestamp).toLocaleString()
                    }
                  >
                    {entryTimestamp}
                  </span>
                </div>
                {/* Use post_media_type if available, otherwise fallback to mediaType */}
                {(entryDetail.post_media_type || entryDetail.mediaType) && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
                    {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') &&
                      <Podcast className="h-3 w-3" />
                    }
                    {(entryDetail.post_media_type?.toLowerCase() === 'newsletter' || entryDetail.mediaType?.toLowerCase() === 'newsletter') &&
                      <Mail className="h-3 w-3" strokeWidth={2.5} />
                    }
                    {(entryDetail.post_media_type || entryDetail.mediaType || 'article').charAt(0).toUpperCase() +
                     (entryDetail.post_media_type || entryDetail.mediaType || 'article').slice(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Entry Content Card - Full width */}
          <div className="mt-4">
          {/* Use the memoized handleCardClick */}
          {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') ? (
            <div>
              <div
                onClick={handleCardClick}
                className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
              >
                <Card className={`rounded-xl overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                  {entryDetail.image && (
                    <CardHeader className="p-0">
                      <AspectRatio ratio={2/1}>
                        <Image
                          src={entryDetail.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 516px) 100vw, 516px"
                            priority={false}
                        />
                      </AspectRatio>
                    </CardHeader>
                  )}
                  <CardContent className="border-t pt-[11px] pl-4 pr-4 pb-[12px]">
                    <h3 className="text-base font-bold capitalize leading-[1.5]">
                      {entryDetail.title}
                    </h3>
                    {entryDetail.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
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
              onMouseDown={handleLinkInteraction}
            >
              <Card className="rounded-xl border overflow-hidden shadow-none">
                {entryDetail.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={2/1}>
                      <Image
                        src={entryDetail.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <CardContent className="pl-4 pr-4 pb-[12px] border-t pt-[11px]">
                  <h3 className="text-base font-bold capitalize leading-[1.5]">
                    {entryDetail.title}
                  </h3>
                  {entryDetail.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                      {entryDetail.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </a>
          )}
        </div>
          </>
        ) : (
          // Original full-width layout for retweets
          <>
            {/* Top Row: Featured Image and Title */}
            <div className="flex items-start gap-4 mb-4 relative mt-4">
              {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
              {(entryDetail.post_featured_img || entryDetail.image) && (
                <div className="flex-shrink-0 w-12 h-12">
                  <Link 
                    href={entryDetail.post_slug ? 
                      (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ? 
                        `/newsletters/${entryDetail.post_slug}` : 
                        entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast' ? 
                          `/podcasts/${entryDetail.post_slug}` : 
                          entryDetail.category_slug ? 
                            `/${entryDetail.category_slug}/${entryDetail.post_slug}` : 
                            entryDetail.link) : 
                          entryDetail.link}
                    className="block w-full h-full relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                    target={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' || 
                                                  entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast') 
                        ? "_self" : "_blank"}
                    rel={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' || 
                                               entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast') 
                      ? "" : "noopener noreferrer"}
                    onMouseDown={handleLinkInteraction}
                  >
                    <AspectRatio ratio={1}>
                      <Image
                        src={entryDetail.post_featured_img || entryDetail.image || ''}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                        priority={false}
                      />
                    </AspectRatio>
                  </Link>
                </div>
              )}
              
              {/* Title and Timestamp */}
              <div className="flex-grow">
                <div className="w-full">
                  <div className="flex items-start justify-between gap-2">
                    <Link 
                      href={entryDetail.post_slug ? 
                        (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ? 
                          `/newsletters/${entryDetail.post_slug}` : 
                          entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast' ? 
                            `/podcasts/${entryDetail.post_slug}` : 
                            entryDetail.category_slug ? 
                              `/${entryDetail.category_slug}/${entryDetail.post_slug}` : 
                              entryDetail.link) : 
                            entryDetail.link}
                        className="hover:opacity-80 transition-opacity"
                        target={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' || 
                                                      entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast') 
                        ? "_self" : "_blank"}
                        rel={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' || 
                                                   entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast') 
                      ? "" : "noopener noreferrer"}
                    onMouseDown={handleLinkInteraction}
                    >
                      <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-2 mt-[2.5px]">
                        {entryDetail.post_title || entryDetail.feed_title || entryDetail.title}
                        {entryDetail.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                      </h3>
                    </Link>
                    <span 
                      className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                      title={entryDetail.pub_date ? 
                        format(new Date(entryDetail.pub_date), 'PPP p') : 
                        new Date(activity.timestamp).toLocaleString()
                      }
                    >
                      {entryTimestamp}
                    </span>
                  </div>
                  {/* Use post_media_type if available, otherwise fallback to mediaType */}
                  {(entryDetail.post_media_type || entryDetail.mediaType) && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
                      {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') && 
                        <Podcast className="h-3 w-3" />
                      }
                      {(entryDetail.post_media_type?.toLowerCase() === 'newsletter' || entryDetail.mediaType?.toLowerCase() === 'newsletter') && 
                        <Mail className="h-3 w-3" strokeWidth={2.5} />
                      }
                      {(entryDetail.post_media_type || entryDetail.mediaType || 'article').charAt(0).toUpperCase() + 
                       (entryDetail.post_media_type || entryDetail.mediaType || 'article').slice(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Entry Content Card - Full width for retweets */}
            <div>
              {/* Use the memoized handleCardClick */}
              {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') ? (
                <div>
                  <div 
                    onClick={handleCardClick}
                    className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
                  >
                    <Card className={`rounded-xl overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                      {entryDetail.image && (
                        <CardHeader className="p-0">
                          <AspectRatio ratio={2/1}>
                            <Image
                              src={entryDetail.image}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 516px) 100vw, 516px"
                                priority={false}
                            />
                          </AspectRatio>
                        </CardHeader>
                      )}
                      <CardContent className="border-t pt-[11px] pl-4 pr-4 pb-[12px]">
                        <h3 className="text-base font-bold capitalize leading-[1.5]">
                          {entryDetail.title}
                        </h3>
                        {entryDetail.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
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
                  onMouseDown={handleLinkInteraction}
                >
                  <Card className="rounded-xl border overflow-hidden shadow-none">
                    {entryDetail.image && (
                      <CardHeader className="p-0">
                        <AspectRatio ratio={2/1}>
                          <Image
                            src={entryDetail.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 516px) 100vw, 516px"
                            priority={false}
                          />
                        </AspectRatio>
                      </CardHeader>
                    )}
                    <CardContent className="pl-4 pr-4 pb-[12px] border-t pt-[11px]">
                      <h3 className="text-base font-bold capitalize leading-[1.5]">
                        {entryDetail.title}
                      </h3>
                      {entryDetail.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                          {entryDetail.description}
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
         <div className="flex justify-between items-center mt-4 h-[16px]" onClick={(e) => e.stopPropagation()}>
          <NoFocusWrapper className="flex items-center">
            <LikeButtonClient
              entryGuid={entryDetail.guid}
              feedUrl={entryDetail.feed_url || ''}
              title={entryDetail.title}
              pubDate={entryDetail.pub_date}
              link={entryDetail.link}
              // Ensure interactions is stable or default value is memoized
              initialData={interactions?.likes || { isLiked: false, count: 0 }}
            />
          </NoFocusWrapper>
           {/* Use stable handleGroupCommentClick */}
          <NoFocusWrapper 
            className="flex items-center" 
            onClick={handleCommentClick}
          >
            <CommentSectionClient
              entryGuid={entryDetail.guid}
              feedUrl={entryDetail.feed_url || ''}
               // Ensure interactions is stable or default value is memoized
              initialData={interactions?.comments || { count: 0 }}
              buttonOnly={true}
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entryDetail.guid}
              feedUrl={entryDetail.feed_url || ''}
              title={entryDetail.title}
              pubDate={entryDetail.pub_date}
              link={entryDetail.link}
               // Ensure interactions is stable or default value is memoized
              initialData={interactions?.retweets || { isRetweeted: false, count: 0 }}
            />
          </NoFocusWrapper>
          <div className="flex items-center gap-4">
            <NoFocusWrapper className="flex items-center">
              <BookmarkButtonClient
                entryGuid={entryDetail.guid}
                feedUrl={entryDetail.feed_url || ''}
                title={entryDetail.title}
                pubDate={entryDetail.pub_date}
                link={entryDetail.link}
                initialData={{ isBookmarked: false }}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entryDetail.link}
                title={entryDetail.title}
              />
            </NoFocusWrapper>
          </div>
        </div>
      </div>
      
     
      
      <div id={`comments-${entryDetail.guid}`} className={activity.type === "comment" ? "" : "border-t border-border"} />
      
      {/* User Comment Activity - moved below the entry card */}
      {activity.type === "comment" && (
        <div className="border-b border-t relative">
          <div className="relative z-10">
            <ActivityDescription 
              item={activity} 
              username={username}
              name={name}
              profileImage={profileImage}
              timestamp={activityTimestamp}
            />
          </div>
        </div>
      )}
    </article>
  );
});
// Add display name
ActivityCard.displayName = 'ActivityCard';

/**
 * Define the type for the grouped activity structure
 */
type GroupedActivity = {
  entryGuid: string;
  firstActivity: ActivityItem;
  comments: ActivityItem[];
  hasMultipleComments: boolean;
  type: string;
};

// *** NEW COMPONENT START ***
/**
 * Renders a single group of activities (for one entry) within the feed.
 * Contains hooks previously causing issues in the itemContent callback.
 */
// Define props type for the new component
type ActivityGroupRendererProps = {
  group: GroupedActivity;
  entryDetails: Record<string, RSSEntry>;
  username: string;
  name: string;
  profileImage?: string | null;
  getEntryMetrics: (entryGuid: string) => InteractionStates;
  handleOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  currentTrack: { src: string | null } | null;
  playTrack: (src: string, title: string, image?: string) => void;
};

const ActivityGroupRenderer = React.memo(({
  group,
  entryDetails,
  username,
  name,
  profileImage,
  getEntryMetrics,
  handleOpenCommentDrawer,
  currentTrack,
  playTrack
}: ActivityGroupRendererProps) => { // Use the defined props type

  // Always get entryDetail - move outside conditional
  const entryDetail = entryDetails[group.entryGuid];
  
  // Define default values for when entryDetail is missing
  const entryGuid = entryDetail?.guid || '';
  const feedUrl = entryDetail?.feed_url || '';
  const entryLink = entryDetail?.link || '';
  const entryTitle = entryDetail?.title || '';
  const entryImage = entryDetail?.image;
  const entryMediaType = entryDetail?.post_media_type?.toLowerCase() || '';
  const entryAlternativeMediaType = entryDetail?.mediaType?.toLowerCase() || '';
  const isPodcast = entryMediaType === 'podcast' || entryAlternativeMediaType === 'podcast';
  const currentTrackSrc = currentTrack?.src;
  
  // Always call hooks, conditionally use results
  const isCurrentlyPlaying = useMemo(() => 
    currentTrackSrc === entryLink,
    [currentTrackSrc, entryLink]
  );

  // Always get metrics - move outside conditional
  const interactions = useMemo(() => 
    entryGuid ? getEntryMetrics(entryGuid) : undefined,
    [entryGuid, getEntryMetrics]
  );

  // Always compute timestamps
  const rendererEntryTimestamp = useMemo(() => {
    if (!entryDetail?.pub_date) return '';
    return formatTimeAgo(entryDetail.pub_date);
  }, [entryDetail?.pub_date]);

  // Handle card click - always define
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isPodcast && entryLink) {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entryLink, entryTitle, entryImage);
    }
  }, [isPodcast, entryLink, entryTitle, entryImage, playTrack]);

  // Comment drawer handler - always define
  const rendererHandleCommentClick = useCallback(() => {
    if (entryGuid) {
      handleOpenCommentDrawer(entryGuid, feedUrl, interactions?.comments);
    }
  }, [entryGuid, feedUrl, interactions?.comments, handleOpenCommentDrawer]);

  // Calculate entry timestamp - instead of useMemo inside a loop or callback, pre-compute
  const group_entryTimestamp = useMemo(() => {
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
  // Depend only on pub_date
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDetail?.pub_date]);

   // Memoize the comment drawer click handler for this specific group
  const group_handleCommentClick = useCallback(() => {
    // handleOpenCommentDrawer is stable from parent
    handleOpenCommentDrawer(entryDetail.guid, entryDetail.feed_url || '', interactions?.comments);
  }, [entryDetail.guid, entryDetail.feed_url, interactions, handleOpenCommentDrawer]);

  // Add handler to prevent focus when clicking non-interactive elements
  const handleNonInteractiveMouseDown = useCallback((e: React.MouseEvent) => {
    // Skip focus prevention for drawer content or input fields
    const target = e.target as HTMLElement;
    const isInDrawer = target.closest('[data-drawer-content]') || 
                       target.closest('[role="dialog"]');
    const isInputField = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;
                       
    if (isInDrawer || isInputField) {
      return;
    }
    
    // Only prevent default if this isn't an interactive element
    if (
      target.tagName !== 'BUTTON' && 
      target.tagName !== 'A' && 
      target.tagName !== 'INPUT' && 
      !target.closest('button') && 
      !target.closest('a') && 
      !target.closest('input')
    ) {
      e.preventDefault();
    }
  }, []);

  // Helper function to prevent scroll jumping on link interaction
  const handleLinkInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent propagation to stop the event from reaching parent elements
    e.stopPropagation();
    
    // Let the event continue for the click
    // but prevent the focus-triggered scrolling afterward
    const target = e.currentTarget as HTMLElement;
    
    // Use a one-time event listener that removes itself after execution
    target.addEventListener('focusin', (focusEvent) => {
      focusEvent.preventDefault();
      // Immediately blur to prevent scroll adjustments
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        setTimeout(() => {
          // Use setTimeout to allow the click to complete first
          activeElement.blur();
        }, 0);
      }
    }, { once: true });
  }, []);

  return (
    // Use a unique key for the group
    <article 
      key={`group-${group.entryGuid}-${group.type}`} 
      className="relative"
      tabIndex={-1}
      onMouseDown={handleNonInteractiveMouseDown}
      onClick={(e) => {
        // Stop all click events from bubbling up to parent components
        e.stopPropagation();
        
        // Clear focus after click completes
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }}
      style={{
        WebkitTapHighlightColor: 'transparent',
        outlineStyle: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'manipulation'
      }}
    >
      {/* ... Rest of ActivityGroupRenderer JSX ... */}
      <div className="p-4">
        {/* Activity header with icon and description */}
        <div className="flex items-start mb-2 relative h-[16px]">
          <div className="mr-2">
             {/* Use memoized ActivityIcon */}
            <ActivityIcon type={group.firstActivity.type} />
          </div>
          <div className="flex-1">
            <span className="text-muted-foreground text-sm block leading-none pt-[1px]">
              <span className="font-semibold">{name}</span>{" "}
              <span className="font-semibold">
                {group.type === "retweet" ? "shared" : "commented"}
              </span>
            </span>
          </div>
        </div>

        {/* Featured Image and Title */}
        <div className="flex items-start gap-4 mb-4 relative mt-4">
          {/* Featured Image */}
          <div className="flex-shrink-0 relative">
            {(entryDetail.post_featured_img || entryDetail.image) && (
              <div className="w-12 h-12 relative z-10">
                <NoFocusLinkWrapper>
                  <Link
                    href={entryDetail.post_slug ?
                      (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ?
                        `/newsletters/${entryDetail.post_slug}` :
                        entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast' ?
                          `/podcasts/${entryDetail.post_slug}` :
                          entryDetail.category_slug ?
                            `/${entryDetail.category_slug}/${entryDetail.post_slug}` :
                            entryDetail.link) :
                        entryDetail.link}
                    className="block w-full h-full relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                    target={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                                  entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                        ? "_self" : "_blank"}
                    rel={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                               entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                      ? "" : "noopener noreferrer"}
                    onMouseDown={handleLinkInteraction}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AspectRatio ratio={1}>
                      <Image
                        src={entryDetail.post_featured_img || entryDetail.image || ''}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                        priority={false}
                      />
                    </AspectRatio>
                  </Link>
                </NoFocusLinkWrapper>
              </div>
            )}
          </div>

          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              <div className="flex items-start justify-between gap-2">
                <NoFocusLinkWrapper>
                  <Link
                    href={entryDetail.post_slug ?
                      (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ?
                        `/newsletters/${entryDetail.post_slug}` :
                        entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast' ?
                          `/podcasts/${entryDetail.post_slug}` :
                          entryDetail.category_slug ?
                            `/${entryDetail.category_slug}/${entryDetail.post_slug}` :
                            entryDetail.link) :
                        entryDetail.link}
                    className="hover:opacity-80 transition-opacity"
                    target={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                                  entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                        ? "_self" : "_blank"}
                    rel={entryDetail.post_slug && (entryDetail.post_media_type === 'newsletter' || entryDetail.mediaType === 'newsletter' ||
                                               entryDetail.post_media_type === 'podcast' || entryDetail.mediaType === 'podcast')
                      ? "" : "noopener noreferrer"}
                    onMouseDown={handleLinkInteraction}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-2 mt-[2.5px]">
                      {entryDetail.post_title || entryDetail.feed_title || entryDetail.title}
                      {entryDetail.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h3>
                  </Link>
                </NoFocusLinkWrapper>
                <span
                  className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                  title={entryDetail.pub_date ?
                    format(new Date(entryDetail.pub_date), 'PPP p') :
                    new Date(group.firstActivity.timestamp).toLocaleString()
                  }
                >
                  {/* Use the memoized group_entryTimestamp */}
                  {group_entryTimestamp}
                </span>
              </div>
              {/* Media type badge */}
              {(entryDetail.post_media_type || entryDetail.mediaType) && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
                  {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') &&
                    <Podcast className="h-3 w-3" />
                  }
                  {(entryDetail.post_media_type?.toLowerCase() === 'newsletter' || entryDetail.mediaType?.toLowerCase() === 'newsletter') &&
                    <Mail className="h-3 w-3" strokeWidth={2.5} />
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
          {/* Use the memoized handleCardClick */}
          {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') ? (
            <div>
              <NoFocusWrapper>
                <div
                  onClick={handleCardClick}
                  className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
                >
                  <Card className={`rounded-xl overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                    {entryDetail.image && (
                      <CardHeader className="p-0">
                        <AspectRatio ratio={2/1}>
                          <Image
                            src={entryDetail.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 516px) 100vw, 516px"
                            priority={false}
                          />
                        </AspectRatio>
                      </CardHeader>
                    )}
                    <CardContent className="border-t pt-[11px] pl-4 pr-4 pb-[12px]">
                      <h3 className="text-base font-bold capitalize leading-[1.5]">
                        {entryDetail.title}
                      </h3>
                      {entryDetail.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                          {entryDetail.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </NoFocusWrapper>
            </div>
          ) : (
            <NoFocusWrapper>
              <a
                href={entryDetail.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-80 transition-opacity"
                onMouseDown={handleLinkInteraction}
                onClick={(e) => e.stopPropagation()}
              >
                <Card className="rounded-xl border overflow-hidden shadow-none">
                  {entryDetail.image && (
                    <CardHeader className="p-0">
                      <AspectRatio ratio={2/1}>
                        <Image
                          src={entryDetail.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 516px) 100vw, 516px"
                          priority={false}
                        />
                      </AspectRatio>
                    </CardHeader>
                  )}
                  <CardContent className="pl-4 pr-4 pb-[12px] border-t pt-[11px]">
                    <h3 className="text-base font-bold capitalize leading-[1.5]">
                      {entryDetail.title}
                    </h3>
                    {entryDetail.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                        {entryDetail.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </a>
            </NoFocusWrapper>
          )}
        </div>
        {/* Add engagement buttons below the card */}
        <div className="flex justify-between items-center mt-4 h-[16px]" onClick={(e) => e.stopPropagation()}>
          <NoFocusWrapper className="flex items-center">
            <LikeButtonClient
              entryGuid={entryDetail.guid}
              feedUrl={entryDetail.feed_url || ''}
              title={entryDetail.title}
              pubDate={entryDetail.pub_date}
              link={entryDetail.link}
              // Ensure interactions is stable or default value is memoized
              initialData={interactions?.likes || { isLiked: false, count: 0 }}
            />
          </NoFocusWrapper>
          {/* Use stable handleGroupCommentClick */}
          <NoFocusWrapper 
            className="flex items-center" 
            onClick={group_handleCommentClick}
          >
            <CommentSectionClient
              entryGuid={entryDetail.guid}
              feedUrl={entryDetail.feed_url || ''}
              // Ensure interactions is stable or default value is memoized
              initialData={interactions?.comments || { count: 0 }}
              buttonOnly={true}
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entryDetail.guid}
              feedUrl={entryDetail.feed_url || ''}
              title={entryDetail.title}
              pubDate={entryDetail.pub_date}
              link={entryDetail.link}
              // Ensure interactions is stable or default value is memoized
              initialData={interactions?.retweets || { isRetweeted: false, count: 0 }}
            />
          </NoFocusWrapper>
          <div className="flex items-center gap-4">
            <NoFocusWrapper className="flex items-center">
              <BookmarkButtonClient
                entryGuid={entryDetail.guid}
                feedUrl={entryDetail.feed_url || ''}
                title={entryDetail.title}
                pubDate={entryDetail.pub_date}
                link={entryDetail.link}
                initialData={{ isBookmarked: false }}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entryDetail.link}
                title={entryDetail.title}
              />
            </NoFocusWrapper>
          </div>
        </div>
      </div>



      <div id={`comments-${entryDetail.guid}`} className="" />

      {/* Render all comments in chronological order */}
      <div className="border-b"> {/* Removed border-l and border-r */}
        {group.comments.map((comment) => {
           // Calculate comment timestamp once using useMemo or keep inline
           const commentTimestamp = formatTimeAgo(comment.timestamp);

           return (
            <div
              // Use comment._id for key
              key={`comment-${comment._id?.toString()}`}
              // Remove p-4 from here, keep border-t and relative
              className="border-t relative"
            >
              {/* Comment content */}
              <div className="relative z-10">
                 {/* Use memoized ActivityDescription */}
                <ActivityDescription
                  item={comment}
                  username={username}
                  name={name}
                  profileImage={profileImage}
                  // Pass the memoized comment timestamp
                  timestamp={commentTimestamp}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
});
// ... existing code ...

// Add this reducer below the GroupedActivity type
/**
 * Reducer for feed state management
 */
type FeedState = {
  activities: ActivityItem[];
  isLoading: boolean;
  hasMore: boolean;
  entryDetails: Record<string, RSSEntry>;
  currentSkip: number;
  isInitialLoad: boolean;
};

type FeedAction =
  | { type: 'INITIAL_LOAD'; payload: { activities: ActivityItem[], entryDetails: Record<string, RSSEntry>, hasMore: boolean } }
  | { type: 'LOAD_MORE_START' }
  | { type: 'LOAD_MORE_SUCCESS'; payload: { activities: ActivityItem[], entryDetails: Record<string, RSSEntry>, hasMore: boolean } }
  | { type: 'LOAD_MORE_FAILURE' }
  | { type: 'SET_INITIAL_LOAD_COMPLETE' };

function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'INITIAL_LOAD':
      return {
        ...state,
        activities: action.payload.activities,
        entryDetails: action.payload.entryDetails,
        hasMore: action.payload.hasMore,
        currentSkip: action.payload.activities.length,
        isInitialLoad: false
      };
    case 'LOAD_MORE_START':
      return {
        ...state,
        isLoading: true
      };
    case 'LOAD_MORE_SUCCESS':
      return {
        ...state,
        activities: [...state.activities, ...action.payload.activities],
        entryDetails: {...state.entryDetails, ...action.payload.entryDetails},
        hasMore: action.payload.hasMore,
        currentSkip: state.currentSkip + action.payload.activities.length,
        isLoading: false
      };
    case 'LOAD_MORE_FAILURE':
      return {
        ...state,
        isLoading: false
      };
    case 'SET_INITIAL_LOAD_COMPLETE':
      return {
        ...state,
        isInitialLoad: false
      };
    default:
      return state;
  }
}

/**
 * Client component that displays a user's activity feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
export const UserActivityFeed = React.memo(function UserActivityFeedComponent({
  userId,
  username,
  name,
  profileImage,
  initialData,
  pageSize = 30,
  apiEndpoint = "/api/activity",
  isActive = true
}: UserActivityFeedProps) {
  // Cache extracted values from initialData for hooks
  const initialActivities = initialData?.activities || [];
  const initialEntryDetails = initialData?.entryDetails || {};
  const initialHasMore = initialData?.hasMore || false;
  const initialEntryMetrics = initialData?.entryMetrics;
  
  // Replace multiple useState calls with useReducer
  const [state, dispatch] = useReducer(feedReducer, {
    activities: initialActivities,
    isLoading: false,
    hasMore: initialHasMore,
    entryDetails: initialEntryDetails,
    currentSkip: initialActivities.length,
    isInitialLoad: !initialActivities.length
  });
  
  // For easier reference in the component
  const { activities, isLoading, hasMore, entryDetails, currentSkip, isInitialLoad } = state;
  
  // Use a stable ref for values that shouldn't trigger dependency changes
  const stableRefs = useRef({
    userId,
    apiEndpoint,
    pageSize,
    hasMore,
    isLoading,
    currentSkip,
    activitiesLength: activities.length
  });
  
  // Update refs when their source values change
  useEffect(() => {
    stableRefs.current = {
      ...stableRefs.current,
      userId,
      apiEndpoint,
      pageSize,
      hasMore,
      isLoading,
      currentSkip,
      activitiesLength: activities.length
    };
  }, [userId, apiEndpoint, pageSize, hasMore, isLoading, currentSkip, activities.length]);

  // Initial data effect - with proper dependencies
  useEffect(() => {
    if (initialData?.activities) {
      logger.debug('Initial activity data received from server:', {
        activitiesCount: initialData.activities.length,
        totalCount: initialData.totalCount,
        hasMore: initialData.hasMore,
        entryDetailsCount: Object.keys(initialData.entryDetails || {}).length,
        entryMetricsCount: Object.keys(initialData.entryMetrics || {}).length
      });

      if (initialData.entryMetrics && Object.keys(initialData.entryMetrics).length > 0) {
        logger.debug('Initial metrics will be used for rendering');
      }

      dispatch({
        type: 'INITIAL_LOAD',
        payload: {
          activities: initialData.activities,
          entryDetails: initialData.entryDetails || {},
          hasMore: initialData.hasMore
        }
      });
    }
  }, [initialData]); // Explicit dependency on initialData

  // --- Drawer state for comments (moved to top level) ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Use the shared focus prevention hook to prevent scrolling issues
  useFeedFocusPrevention(isActive && !commentDrawerOpen, '.user-activity-feed-container');

  // Stable callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []); // setState functions are stable

  // Get audio context at the component level
  const { playTrack, currentTrack } = useAudio();

  // Get entry guids as primitive array of strings - memoize to prevent recalculations
  const entryGuids = useMemo(() => 
    activities.map(activity => activity.entryGuid),
    [activities]
  );

  // Use our custom hook for metrics with memoized dependencies
  const { getEntryMetrics, isLoading: isMetricsLoading } = useEntriesMetrics(
    entryGuids,
    initialEntryMetrics
  );

  // Create a ref for the load more container
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Add ref to prevent multiple endReached calls
  const endReachedCalledRef = useRef(false);
  
  // Reset the endReachedCalled flag when activities change
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [activities.length]);
  
  // Function to load more activities with stabilized refs to avoid dependency issues
  const loadMoreActivities = useCallback(async () => {
    const {
      userId,
      apiEndpoint,
      pageSize,
      hasMore,
      isLoading,
      currentSkip
    } = stableRefs.current;
    
    // Avoid redundant requests and early exit when needed
    if (!isActive || isLoading || !hasMore) {
      logger.debug(`⛔ Not loading more activities: isActive=${isActive}, isLoading=${isLoading}, hasMore=${hasMore}`);
      return;
    }

    // Start loading
    dispatch({ type: 'LOAD_MORE_START' });

    try {
      logger.debug(`🔄 Fetching more activities, skip=${currentSkip}, limit=${pageSize}`);

      // Use the API route to fetch the next page
      const result = await fetch(`${apiEndpoint}?userId=${userId}&skip=${currentSkip}&limit=${pageSize}`);

      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }

      const data = await result.json();
      logger.debug(`📦 Received activities data:`, {
        activitiesCount: data.activities?.length || 0,
        hasMore: data.hasMore
      });

      if (!data.activities?.length) {
        logger.debug('⚠️ No activities returned from API');
        dispatch({ 
          type: 'LOAD_MORE_SUCCESS', 
          payload: { 
            activities: [], 
            entryDetails: {}, 
            hasMore: false 
          } 
        });
        return;
      }

      // Use the reducer to update state in one go
      dispatch({
        type: 'LOAD_MORE_SUCCESS',
        payload: {
          activities: data.activities,
          entryDetails: data.entryDetails || {},
          hasMore: data.hasMore
        }
      });

      logger.debug(`✅ Total activities now: ${stableRefs.current.activitiesLength + data.activities.length}`);
    } catch (error) {
      logger.error('❌ Error loading more activities:', error);
      dispatch({ type: 'LOAD_MORE_FAILURE' });
    }
  }, [isActive]); // Only isActive as dependency, everything else uses stable refs
  
  // Use the shared delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMoreActivities, {
    enabled: hasMore && !isLoading,
    isLoading,
    hasMore,
    rootMargin: '800px', // Increased from 300px to 800px in the shared utility
    threshold: 0.1,
    delay: 3000 // 3 second delay to prevent initial page load triggering
  });

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    if (!hasMore || isLoading || !loadMoreRef.current) return;
    
    const checkContentHeight = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && activities.length > 0) {
        logger.debug('📏 Content is shorter than viewport, loading more activities automatically');
        loadMoreActivities();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [activities.length, hasMore, isLoading, loadMoreActivities]);

  // Memoize the Footer component
  const Footer = useMemo(() => {
    // Named function for better debugging
    function VirtuosoFooter() {
      return (
        isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : hasMore ? (
          <div className="h-8" /> // Placeholder for scroll trigger
        ) : null
      );
    }
    VirtuosoFooter.displayName = 'VirtuosoFooter';
    return VirtuosoFooter;
  }, [isLoading, hasMore]);

  // Use a ref to store the itemContent callback to ensure stability - matching RSSEntriesDisplay exactly
  const itemContentCallback = useCallback((index: number, group: GroupedActivity) => (
    <ActivityGroupRenderer
      key={`group-${group.entryGuid}-${group.type}`} // Remove index from key
      group={group}
      entryDetails={entryDetails}
      username={username}
      name={name}
      profileImage={profileImage}
      getEntryMetrics={getEntryMetrics}
      handleOpenCommentDrawer={handleOpenCommentDrawer}
      currentTrack={currentTrack}
      playTrack={playTrack}
    />
  ), [
    entryDetails,
    username,
    name,
    profileImage,
    getEntryMetrics,
    handleOpenCommentDrawer,
    currentTrack,
    playTrack
  ]);

  // Efficiently group activities by entryGuid and type
  const groupedActivities = useMemo(() => {
    // Create a map to store activities by entry GUID and type
    const groupedMap = new Map<string, Map<string, ActivityItem[]>>();

    // First pass: filter out any activities that are not comments or retweets
    activities.forEach(activity => {
      const key = activity.entryGuid;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, new Map());
      }

      // Group only comments together, keep retweets separate
      const typeKey = activity.type === 'comment' ? 'comment' : `${activity.type}-${activity._id}`;

      if (!groupedMap.get(key)!.has(typeKey)) {
        groupedMap.get(key)!.set(typeKey, []);
      }
      groupedMap.get(key)!.get(typeKey)!.push(activity);
    });

    // Second pass: create final structure
    const result: Array<GroupedActivity> = [];

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
          // For retweets, each is a separate entry
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

  // Memoize the Virtuoso configuration
  const updatedVirtuosoConfig = useMemo(() => ({
    useWindowScroll: true,
    data: groupedActivities,
    overscan: 2000,
    itemContent: itemContentCallback,
    components: {
      Footer: () => null
    },
    // Add focus prevention styling
    style: { 
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation'
    },
    className: "focus:outline-none focus-visible:outline-none",
    // Add proper item keying to prevent DOM recycling issues
    computeItemKey: (_: number, group: GroupedActivity) => `${group.entryGuid}-${group.type}`
  }), [groupedActivities, itemContentCallback]);

  // Memoize loading state calculations
  const uiIsInitialLoading = useMemo(() => 
    (isLoading && isInitialLoad) || (isInitialLoad && activities.length > 0 && isMetricsLoading),
    [isLoading, isInitialLoad, activities.length, isMetricsLoading]
  );
  
  const uiHasNoActivities = useMemo(() => 
    activities.length === 0 && !isLoading && !isInitialLoad,
    [activities.length, isLoading, isInitialLoad]
  );

  return (
    <div 
      className="w-full user-activity-feed-container" 
      style={{ 
        // CSS properties to prevent focus scrolling
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent',
        outlineStyle: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'manipulation'
      }}
      tabIndex={-1}
      onMouseDown={(e) => {
        // Prevent focus on non-interactive elements
        const target = e.target as HTMLElement;
        
        // Skip focus prevention for drawer content or input fields
        const isInDrawer = target.closest('[data-drawer-content]') || 
                           target.closest('[role="dialog"]');
        const isInputField = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable;
                           
        if (isInDrawer || isInputField) {
          return;
        }
        
        if (
          target.tagName !== 'BUTTON' && 
          target.tagName !== 'A' && 
          target.tagName !== 'INPUT' && 
          !target.closest('button') && 
          !target.closest('a') && 
          !target.closest('input')
        ) {
          e.preventDefault();
        }
      }}
    >
      {uiIsInitialLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : uiHasNoActivities ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No activity found for this user.</p>
        </div>
      ) : (
        <>
          <Virtuoso 
            useWindowScroll
            data={groupedActivities}
            overscan={2000}
            itemContent={itemContentCallback}
            components={{
              Footer: () => null
            }}
            style={{ 
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
            className="outline-none focus:outline-none focus-visible:outline-none"
            computeItemKey={(_, group) => `${group.entryGuid}-${group.type}`}
            tabIndex={-1}
            increaseViewportBy={800}
            followOutput="auto"
            atTopThreshold={100}
            atBottomThreshold={100}
            defaultItemHeight={400}
            totalListHeightChanged={(height) => {
              // When list height changes, check for short content
              if (height < window.innerHeight && hasMore && !isLoading) {
                loadMoreActivities();
              }
            }}
          />
          
          {/* Fixed position load more container at bottom - exactly like RSSEntriesDisplay */}
          <div 
            ref={loadMoreRef} 
            className="h-52 flex items-center justify-center mb-20"
            tabIndex={-1}
          >
            {hasMore && isLoading && (
              <NoFocusWrapper className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </NoFocusWrapper>
            )}
            {!hasMore && groupedActivities.length > 0 && <div></div>}
          </div>
          
          {selectedCommentEntry && (
            <CommentSectionClient
              entryGuid={selectedCommentEntry.entryGuid}
              feedUrl={selectedCommentEntry.feedUrl || ''}
              initialData={selectedCommentEntry.initialData}
              isOpen={commentDrawerOpen}
              setIsOpen={setCommentDrawerOpen}
            />
          )}
        </>
      )}
    </div>
  );
}, (prevProps: UserActivityFeedProps, nextProps: UserActivityFeedProps): boolean => {
  // Custom prop comparison for the memo - rerender only if critical props change
  // Basic equality checks for primitive props
  if (prevProps.userId !== nextProps.userId) return false;
  if (prevProps.username !== nextProps.username) return false;
  if (prevProps.name !== nextProps.name) return false;
  if (prevProps.profileImage !== nextProps.profileImage) return false;
  if (prevProps.pageSize !== nextProps.pageSize) return false;
  if (prevProps.apiEndpoint !== nextProps.apiEndpoint) return false;
  if (prevProps.isActive !== nextProps.isActive) return false;
  
  // Deep equality check for initialData
  // Skip detailed comparison if both are null
  if (!prevProps.initialData && !nextProps.initialData) return true;
  if (!prevProps.initialData || !nextProps.initialData) return false;
  
  // Compare basic properties
  if (prevProps.initialData.hasMore !== nextProps.initialData.hasMore) return false;
  if (prevProps.initialData.totalCount !== nextProps.initialData.totalCount) return false;
  
  // We're not doing deep equality checks on large arrays and objects
  // Just check if they have the same length as a heuristic
  const prevActivitiesLength = prevProps.initialData.activities?.length || 0;
  const nextActivitiesLength = nextProps.initialData.activities?.length || 0;
  if (prevActivitiesLength !== nextActivitiesLength) return false;
  
  // If we've passed all checks, consider props equal
  return true;
});

// Add display name to the UserActivityFeed component
UserActivityFeed.displayName = 'UserActivityFeed';

ActivityGroupRenderer.displayName = 'ActivityGroupRenderer';