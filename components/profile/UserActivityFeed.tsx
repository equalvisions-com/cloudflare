"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Heart, MessageCircle, Repeat, Loader2, ChevronDown, Bookmark, Mail, Podcast, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Virtuoso } from 'react-virtuoso';
import React, { useCallback, useRef, useMemo } from "react";
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
import {
  ActivityFeedItem,
  ActivityFeedRSSEntry,
  ActivityFeedComment,
  ActivityFeedInteractionStates,
  UserActivityFeedComponentProps,
  ActivityFeedGroupedActivity,
  ActivityFeedGroupRendererProps,
  ActivityDescriptionProps
} from '@/lib/types';
import { useUserActivityFeedStore } from '@/lib/stores/userActivityFeedStore';
import { useCommentManagement } from '@/hooks/useCommentManagement';
import { useActivityLoading } from '@/hooks/useActivityLoading';
import { useActivityFeedUI } from '@/hooks/useActivityFeedUI';
import { useEntriesMetrics } from '@/hooks/useEntriesMetrics';

// Custom hooks are now extracted to separate files

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
export const ActivityDescription = React.memo(({ item, username, name, profileImage, timestamp, userId }: ActivityDescriptionProps) => {
  const router = useRouter();
  
  // Use custom hook for comment management
  const {
    repliesExpanded,
    replyText,
    isSubmittingReply,
    replies,
    repliesLoading,
    repliesLoaded,
    deletedReplies,
    isReplying,
    isDeleted,
    isCurrentUserComputed,
    likeCountRef,
    commentRepliesQuery,
    setReplyText,
    setIsSubmittingReply,
    setIsReplying,
    toggleReplies,
    handleReplyClick,
    cancelReplyClick,
    submitReply,
    deleteComment,
    createDeleteReply,
    updateLikeCount,
    setReplyLikeCountRef,
    updateReplyLikeCount,
    addComment,
  } = useCommentManagement(item, userId);

  // Comment management logic is now handled by useCommentManagement hook

  // Extract ReplyRenderer to a separate component to avoid hook issues in loops
  const ReplyRenderer = React.memo(({ reply, index }: { reply: ActivityFeedComment, index: number }) => {
    // Check if this reply is deleted using the component-level state
    const isReplyDeleted = deletedReplies.has(reply._id.toString());

    // Check if this reply belongs to the current user using ID-based authorization
    const { isAuthenticated } = useConvexAuth();
    const viewer = useQuery(api.users.viewer);
    const isReplyFromCurrentUser = isAuthenticated && viewer && reply.userId === viewer._id;

    // Use delete function from custom hook
    const deleteReply = createDeleteReply(reply);

    // If reply is deleted, show a placeholder
    if (isReplyDeleted) {
      return (
        <div key={reply._id.toString()} className="mt-0 border-t pl-4 py-4">
          <div className="text-muted-foreground text-sm">This reply has been deleted.</div>
        </div>
      );
    }

    // Function to set reference for the like count element
    const setReplyLikeCountRefLocal = (el: HTMLDivElement | null) => {
      setReplyLikeCountRef(el, reply._id.toString());
    };

    // Get profile image
    const profileImageUrl = reply.user?.profileImage || null;

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
    const updateReplyLikeCountLocal = (count: number) => {
      updateReplyLikeCount(count, reply._id.toString());
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
                <span className="text-sm font-bold leading-none overflow-anywhere">{displayName}</span>
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
                  ref={setReplyLikeCountRefLocal}
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
                  onCountChange={updateReplyLikeCountLocal}
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

  // All comment management functions are now provided by useCommentManagement hook

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
                    <span className="text-sm font-bold leading-none overflow-anywhere">{name}</span>
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
                      // data-comment-input // REMOVED: To prevent focus
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
                        // data-comment-input // REMOVED: To prevent focus
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
                  {isCurrentUserComputed && (
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
                  data-comment-input // KEPT: Textarea should be focusable
                />
                <Button 
                  onClick={submitReply} 
                  disabled={!replyText.trim() || isSubmittingReply}
                  size="sm" className="h-9 text-sm font-medium"
                  // data-comment-input // REMOVED: To prevent focus
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
                  // data-comment-input // REMOVED: To prevent focus
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
  activity: ActivityFeedItem;
  username: string;
  name: string;
  profileImage?: string | null;
  entryDetail?: ActivityFeedRSSEntry;
  getEntryMetrics: (entryGuid: string) => ActivityFeedInteractionStates;
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
    // Only prevent default if this isn't an interactive element
    const target = e.target as HTMLElement;
    if (
      target.tagName !== 'BUTTON' && 
      target.tagName !== 'A' && 
      target.tagName !== 'INPUT' && 
      target.tagName !== 'TEXTAREA' && 
      !target.closest('button') && 
      !target.closest('a') && 
      !target.closest('input') &&
      !target.closest('textarea') &&
      !target.closest('[data-comment-input]')
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
        <div className="flex items-start mb-2 relative overflow-anywhere h-[16px]">
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
              data-comment-input
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
// Removed inline type - using centralized ActivityFeedGroupedActivity from types file

// Group activities by entry GUID
const groupActivitiesByEntry = (activities: ActivityFeedItem[]): ActivityFeedGroupedActivity[] => {
  const grouped = activities.reduce((acc, activity) => {
    const key = activity.entryGuid;
    if (!acc[key]) {
      acc[key] = {
        entryGuid: key,
        firstActivity: activity,
        comments: [],
        hasMultipleComments: false,
        type: activity.type
      };
    }
    
    if (activity.type === 'comment') {
      acc[key].comments.push(activity);
      acc[key].hasMultipleComments = acc[key].comments.length > 1;
    }
    
    return acc;
  }, {} as Record<string, ActivityFeedGroupedActivity>);
  
  return Object.values(grouped);
};

// *** NEW COMPONENT START ***
/**
 * Renders a single group of activities (for one entry) within the feed.
 * Contains hooks previously causing issues in the itemContent callback.
 */
// Define props type for the new component
const ActivityGroupRenderer = React.memo(({
  group,
  entryDetails,
  username,
  name,
  profileImage,
  userId,
  getEntryMetrics,
  handleOpenCommentDrawer,
  currentTrack,
  playTrack
}: ActivityFeedGroupRendererProps) => { // Use the defined props type

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
    // Only prevent default if this isn't an interactive element
    const target = e.target as HTMLElement;
    if (
      target.tagName !== 'BUTTON' && 
      target.tagName !== 'A' && 
      target.tagName !== 'INPUT' && 
      target.tagName !== 'TEXTAREA' && 
      !target.closest('button') && 
      !target.closest('a') && 
      !target.closest('input') &&
      !target.closest('textarea') &&
      !target.closest('[data-comment-input]')
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
        
        const activeElement = document.activeElement as HTMLElement;

        if (activeElement) {
          // Check if the active element is an input type that should retain focus
          const isTheReplyTextarea =
            activeElement.tagName === 'TEXTAREA' &&
            activeElement.hasAttribute('data-comment-input');

          // Only blur if it's not the reply textarea
          if (!isTheReplyTextarea) {
            activeElement.blur();
          }
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
        <div className="flex items-start mb-2 overflow-anywhere relative h-[16px]">
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
              data-comment-input
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
                  userId={userId}
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
// Removed inline reducer - using Zustand store for state management

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
}: UserActivityFeedComponentProps) {
  // Cache extracted values from initialData for hooks
  const initialActivities = initialData?.activities || [];
  const initialEntryDetails = initialData?.entryDetails || {};
  const initialHasMore = initialData?.hasMore || false;
  const initialEntryMetrics = initialData?.entryMetrics;
  
  // Use custom hooks for business logic
  const {
    activities,
    entryDetails,
    hasMore,
    isLoading,
    isInitialLoad,
    groupedActivities,
    uiIsInitialLoading,
    uiHasNoActivities,
    loadMoreRef,
    loadMoreActivities,
    reset,
    setInitialLoadComplete,
  } = useActivityLoading({
      userId,
      apiEndpoint,
      pageSize,
    isActive,
    initialActivities,
    initialEntryDetails,
    initialHasMore
  });

  const {
    commentDrawerOpen,
    selectedCommentEntry,
    playTrack,
    currentTrack,
    Footer,
    containerStyle,
    virtuosoConfig,
    handleOpenCommentDrawer,
    handleCloseCommentDrawer,
    handleMouseDown,
  } = useActivityFeedUI({ isActive });

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

  // Loading and pagination logic is now handled by useActivityLoading hook

  // Use a ref to store the itemContent callback to ensure stability - matching RSSEntriesDisplay exactly
  const itemContentCallback = useCallback((index: number, group: ActivityFeedGroupedActivity) => (
    <ActivityGroupRenderer
      key={`group-${group.entryGuid}-${group.type}`} // Remove index from key
      group={group}
      entryDetails={entryDetails}
      username={username}
      name={name}
      profileImage={profileImage}
      userId={userId}
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
    userId,
    getEntryMetrics,
    handleOpenCommentDrawer,
    currentTrack,
    playTrack
  ]);

  // Activity grouping and UI state calculations are now handled by custom hooks

  return (
    <div 
      className="w-full user-activity-feed-container" 
      style={containerStyle}
      tabIndex={-1}
      onMouseDown={handleMouseDown}
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
              setIsOpen={(open: boolean) => !open && handleCloseCommentDrawer()}
            />
          )}
        </>
      )}
    </div>
  );
}, (prevProps: UserActivityFeedComponentProps, nextProps: UserActivityFeedComponentProps): boolean => {
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