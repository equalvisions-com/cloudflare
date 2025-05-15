'use client';

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageCircle, X, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { Textarea } from "@/components/ui/textarea";
import { Id } from "@/convex/_generated/dataModel";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@/components/ui/drawer";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ProfileImage } from "@/components/profile/ProfileImage";
import { CommentLikeButton } from "@/components/comment-section/CommentLikeButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from 'next/link';
import { useRouter } from "next/navigation";

interface CommentSectionProps {
  entryGuid: string;
  feedUrl: string;
  initialData?: {
    count: number;
  };
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  buttonOnly?: boolean;
}

export function CommentSectionClientWithErrorBoundary(props: CommentSectionProps) {
  return (
    <ErrorBoundary>
      <CommentSectionClient {...props} />
    </ErrorBoundary>
  );
}

// Type for a comment from the API
interface CommentFromAPI {
  _id: Id<"comments">;
  _creationTime: number;
  userId: Id<"users">;
  username: string;
  content: string;
  parentId?: Id<"comments">;
  user?: UserProfile | null; // Handle possible null value
  entryGuid: string;
  feedUrl: string;
  createdAt: number;
}

// User profile type matching the actual structure returned by the API
interface UserProfile {
  _id: Id<"users">;
  _creationTime: number;
  userId?: Id<"users">; // Make optional as it might not be present in all contexts
  username?: string;
  name?: string;
  profileImage?: string;
  bio?: string;
  rssKeys?: string[];
  email?: string;
  emailVerificationTime?: number;
  image?: string;
  isAnonymous?: boolean;
  // Use Record<string, unknown> instead of any for additional properties
  // This maintains type safety while allowing for extra properties
  [key: string]: unknown;
}

// Enhanced comment type with replies
interface CommentWithReplies extends CommentFromAPI {
  replies: CommentFromAPI[];
}

// Memoized Comment component for better performance
const Comment = memo(({ 
  comment, 
  isReply = false,
  isAuthenticated,
  viewer,
  deletedComments,
  expandedReplies,
  onReply,
  onDeleteComment,
  onToggleReplies,
  onSetCommentLikeCountRef,
  onUpdateCommentLikeCount,
}: { 
  comment: CommentWithReplies | CommentFromAPI;
  isReply?: boolean;
  isAuthenticated: boolean;
  viewer: any;
  deletedComments: Set<string>;
  expandedReplies: Set<string>;
  onReply: (comment: CommentFromAPI) => void;
  onDeleteComment: (commentId: Id<"comments">) => Promise<void>;
  onToggleReplies: (commentId: string) => void;
  onSetCommentLikeCountRef: (commentId: string, el: HTMLDivElement | null) => void;
  onUpdateCommentLikeCount: (commentId: string, count: number) => void;
}) => {
  const hasReplies = 'replies' in comment && comment.replies.length > 0;
  const isDeleted = deletedComments.has(comment._id.toString());
  const areRepliesExpanded = expandedReplies.has(comment._id.toString());
  
  // Check if this comment belongs to the current user
  const isCommentFromCurrentUser = isAuthenticated && viewer && 
    (viewer._id === comment.userId);
  
  // Get profile image - check multiple possible locations based on data structure
  const profileImageUrl = 
    comment.user?.profileImage || // From profiles table
    comment.user?.image ||        // From users table
    null;                         // Fallback
    
  // Get display name from various possible locations
  const displayName = 
    comment.user?.name ||      // From profiles or users table
    comment.username ||        // Fallback to username in comment
    'Anonymous';               // Last resort fallback
  
  // Get username for profile link
  const username = comment.username || (comment.user?.username || '');
  
  // Handle comment deletion
  const handleDeleteComment = useCallback(async () => {
    await onDeleteComment(comment._id);
  }, [comment._id, onDeleteComment]);
  
  // Format time difference for this comment
  const formattedTime = useMemo(() => {
    const now = new Date();
    const commentDate = new Date(comment._creationTime);
    
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
  }, [comment._creationTime]);
  
  // If comment is deleted, don't render anything
  if (isDeleted) {
    return null;
  }
  
  return (
    <div key={comment._id} className={`${isReply ? '' : 'border-t border-border'}`}>
      <div className={`flex items-start gap-4 ${isReply ? 'pb-4' : 'py-4 pl-4'}`}>
        {username ? (
          <Link href={`/@${username}`} className="flex-shrink-0">
            <ProfileImage 
              profileImage={profileImageUrl}
              username={comment.username}
              size="md-lg"
            />
          </Link>
        ) : (
          <ProfileImage 
            profileImage={profileImageUrl}
            username={comment.username}
            size="md-lg"
            className="flex-shrink-0"
          />
        )}
        <div className="flex-1 flex">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              {username ? (
                <Link href={`/@${username}`} className="text-sm font-bold leading-none hover:underline">
                  {displayName}
                </Link>
              ) : (
                <span className="text-sm font-bold leading-none">{displayName}</span>
              )}
            </div>
            <p className="text-sm">{comment.content}</p>
            
            {/* Actions row with timestamp and like count */}
            <div className="flex items-center gap-4 mt-1">
              {/* Timestamp */}
              <div className="leading-none font-semibold text-muted-foreground text-xs">
                {formattedTime}
              </div>
              
              {/* Like count for comment */}
              <div 
                ref={(el) => onSetCommentLikeCountRef(comment._id.toString(), el)}
                className="leading-none font-semibold text-muted-foreground text-xs hidden"
              >
                <span>0 Likes</span>
              </div>
              
              {/* Reply button - only show on top-level comments, not replies */}
              {!isReply && (
                <button 
                  onClick={() => onReply(comment)}
                  className="leading-none font-semibold text-muted-foreground text-xs cursor-pointer hover:underline"
                >
                  Reply
                </button>
              )}
              
              {/* View/Hide Replies button - only show if comment has replies */}
              {!isReply && hasReplies && (
                <button 
                  onClick={() => onToggleReplies(comment._id.toString())}
                  className="leading-none font-semibold text-muted-foreground text-xs cursor-pointer hover:underline"
                >
                  {areRepliesExpanded 
                    ? "Hide Replies" 
                    : `View Replies (${(comment as CommentWithReplies).replies.length})`
                  }
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-shrink-0 flex items-center ml-2 pr-4">
            <div className="flex flex-col items-end w-full">
              {/* Add menu for comment owner at the top */}
              {isCommentFromCurrentUser && (
                <div className="mb-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent">
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={handleDeleteComment}
                        className="text-red-500 focus:text-red-500 cursor-pointer"
                      >
                        Delete Comment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              
              {/* Like button */}
              <CommentLikeButton 
                commentId={comment._id}
                size="sm"
                hideCount={true}
                onCountChange={(count) => onUpdateCommentLikeCount(comment._id.toString(), count)}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Display replies if this is a top-level comment with replies and replies are expanded */}
      {hasReplies && areRepliesExpanded && (
        <div style={{ paddingLeft: '44px' }}>
          {(comment as CommentWithReplies).replies.map(reply => (
            <Comment
              key={reply._id}
              comment={reply}
              isReply={true}
              isAuthenticated={isAuthenticated}
              viewer={viewer}
              deletedComments={deletedComments}
              expandedReplies={expandedReplies}
              onReply={onReply}
              onDeleteComment={onDeleteComment}
              onToggleReplies={onToggleReplies}
              onSetCommentLikeCountRef={onSetCommentLikeCountRef}
              onUpdateCommentLikeCount={onUpdateCommentLikeCount}
            />
          ))}
        </div>
      )}
    </div>
  );
});

Comment.displayName = 'Comment';

// Memoized comment button component
const CommentButton = memo(({ 
  onClick, 
  commentCount 
}: { 
  onClick: () => void, 
  commentCount: number 
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
      onClick={onClick}
      data-comment-input
    >
      <MessageCircle className="h-4 w-4 text-muted-foreground stroke-[2.5] transition-colors duration-200" />
      <span className="text-[14px] text-muted-foreground font-semibold transition-all duration-200">{commentCount}</span>
    </Button>
  );
});

CommentButton.displayName = 'CommentButton';

export function CommentSectionClient({ 
  entryGuid, 
  feedUrl,
  initialData = { count: 0 },
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  buttonOnly = false
}: CommentSectionProps) {
  const [internalIsOpen, internalSetIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen !== undefined ? externalSetIsOpen : internalSetIsOpen;
  const [comment, setComment] = useState('');
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [optimisticTimestamp, setOptimisticTimestamp] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State to track which comment is being replied to
  const [replyToComment, setReplyToComment] = useState<CommentFromAPI | null>(null);
  // Track which comments have expanded replies
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  
  // Track refs for like counts
  const commentLikeCountRefs = useRef(new Map<string, HTMLDivElement>());
  
  // Authentication and current user
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const viewer = useQuery(api.users.viewer);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Track deleted comments/replies
  const [deletedComments, setDeletedComments] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Use Convex's real-time query with proper loading state handling
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  const comments = useQuery(
    api.comments.getComments,
    { entryGuid }
  );
  
  // Track if the metrics have been loaded at least once
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  
  // Update metricsLoaded when metrics are received
  useEffect(() => {
    if (metrics && !metricsLoaded) {
      setMetricsLoaded(true);
    }
  }, [metrics, metricsLoaded]);
  
  // Get the comment count, prioritizing optimistic updates
  // If metrics haven't loaded yet, use initialData to prevent flickering
  const commentCount = useMemo(() => {
    return optimisticCount ?? (metricsLoaded ? (metrics?.comments.count ?? initialData.count) : initialData.count);
  }, [optimisticCount, metricsLoaded, metrics, initialData.count]);
  
  // Only reset optimistic count when real data arrives and matches our expected state
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (metrics && optimisticCount !== null && optimisticTimestamp !== null) {
      // Only clear optimistic state if:
      // 1. The server count is equal to or greater than our optimistic count (meaning our update was processed)
      // 2. OR if the optimistic update is older than 5 seconds (fallback)
      const serverCountReflectsOurUpdate = metrics.comments.count >= optimisticCount;
      const isOptimisticUpdateStale = Date.now() - optimisticTimestamp > 5000;
      
      if (serverCountReflectsOurUpdate || isOptimisticUpdateStale) {
        setOptimisticCount(null);
        setOptimisticTimestamp(null);
      }
    }
  }, [metrics, optimisticCount, optimisticTimestamp]);
  
  const addComment = useMutation(api.comments.addComment);
  
  const handleSubmit = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    if (!comment.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Optimistic update with timestamp
    setOptimisticCount(prevCount => (prevCount ?? commentCount) + 1);
    setOptimisticTimestamp(Date.now());
    
    // Store values before awaiting to prevent closure issues
    const commentContent = comment.trim();
    const parentId = replyToComment?._id;
    
    try {
      // Clear the comment input and reset reply state immediately for better UX
      setComment('');
      setReplyToComment(null);
      
      const result = await addComment({
        entryGuid,
        feedUrl,
        content: commentContent,
        parentId
      });
      
      // Successful submission - no need to do anything as Convex will update the UI
      console.log('💬 Comment added successfully', result);
      
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      // Revert optimistic update on error
      if (isMountedRef.current) {
        setOptimisticCount(null);
        setOptimisticTimestamp(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [comment, addComment, entryGuid, feedUrl, commentCount, replyToComment, isSubmitting, isAuthenticated, router]);
  
  // Function to handle initiating a reply to a comment
  const handleReply = useCallback((comment: CommentFromAPI) => {
    setReplyToComment(comment);
  }, []);
  
  // Function to cancel reply
  const cancelReply = useCallback(() => {
    setReplyToComment(null);
  }, []);
  
  // Group top-level comments and their replies
  const organizeCommentsHierarchy = useCallback(() => {
    if (!comments) return [];
    
    const commentMap = new Map<string, CommentWithReplies>();
    const topLevelComments: CommentWithReplies[] = [];
    
    // First pass: create enhanced comment objects and build map
    comments.forEach(comment => {
      commentMap.set(comment._id, { ...comment, replies: [] });
    });
    
    // Second pass: organize into hierarchy
    comments.forEach(comment => {
      if (comment.parentId) {
        // This is a reply
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        // This is a top-level comment
        const enhancedComment = commentMap.get(comment._id);
        if (enhancedComment) {
          topLevelComments.push(enhancedComment);
        }
      }
    });
    
    return topLevelComments;
  }, [comments]);
  
  // Function to update the like count text
  const updateCommentLikeCount = useCallback((commentId: string, count: number) => {
    const commentLikeCountElement = commentLikeCountRefs.current.get(commentId);
    if (commentLikeCountElement) {
      if (count > 0) {
        const countText = `${count} ${count === 1 ? 'Like' : 'Likes'}`;
        const countElement = commentLikeCountElement.querySelector('span');
        if (countElement) {
          countElement.textContent = countText;
        }
        commentLikeCountElement.classList.remove('hidden');
      } else {
        commentLikeCountElement.classList.add('hidden');
      }
    }
  }, []);
  
  // Function to handle comment deletion - updated to use Convex mutation
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  
  const deleteComment = useCallback(async (commentId: Id<"comments">) => {
    try {
      // Use Convex mutation instead of fetch
      await deleteCommentMutation({ commentId });
      // Mark this comment as deleted
      setDeletedComments(prev => {
        const newSet = new Set(prev);
        newSet.add(commentId.toString());
        return newSet;
      });
      console.log('🗑️ Comment deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting comment:', error);
    }
  }, [deleteCommentMutation]);
  
  // Function to set reference for the like count element
  const setCommentLikeCountRef = useCallback((commentId: string, el: HTMLDivElement | null) => {
    if (el && commentId) {
      commentLikeCountRefs.current.set(commentId, el);
    }
  }, []);
  
  // Toggle reply visibility for a comment
  const toggleRepliesVisibility = useCallback((commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);
  
  // Memoize the comment hierarchy
  const commentHierarchy = useMemo(() => organizeCommentsHierarchy(), [organizeCommentsHierarchy]);
  
  // Memoize the handler for opening the drawer
  const handleOpenDrawer = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);
  
  // Only render the button if buttonOnly is true
  if (buttonOnly) {
    return (
      <CommentButton onClick={handleOpenDrawer} commentCount={commentCount} />
    );
  }
  
  return (
    <>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="h-[75vh] w-full max-w-[550px] mx-auto" data-drawer-content="comment-section">
          <DrawerHeader 
             className={`px-4 pb-4 ${commentHierarchy.length === 0 ? 'border-b' : ''}`}
           >
            <DrawerTitle className="text-center text-base font-extrabold leading-none tracking-tight">Comments</DrawerTitle>
          </DrawerHeader>
          
          {/* Comments list with ScrollArea */}
          <ScrollArea className="h-[calc(75vh-160px)]" scrollHideDelay={0} type="always">
            <div className="mt-0">
              {commentHierarchy.length > 0 ? (
                commentHierarchy.map(comment => (
                  <Comment
                    key={comment._id}
                    comment={comment}
                    isAuthenticated={isAuthenticated}
                    viewer={viewer}
                    deletedComments={deletedComments}
                    expandedReplies={expandedReplies}
                    onReply={handleReply}
                    onDeleteComment={deleteComment}
                    onToggleReplies={toggleRepliesVisibility}
                    onSetCommentLikeCountRef={setCommentLikeCountRef}
                    onUpdateCommentLikeCount={updateCommentLikeCount}
                  />
                ))
              ) : (
                <p className="text-muted-foreground py-4 text-center">No comments yet. Be the first to comment!</p>
              )}
            </div>
          </ScrollArea>
          
          {/* Comment input - stays at bottom */}
          <div className="flex flex-col gap-2 mt-2 border-t border-border p-4">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Textarea
                  placeholder={replyToComment 
                    ? `Reply to ${replyToComment.username}...`
                    : "Add a comment..."}
                  value={comment}
                  onChange={(e) => {
                    // Limit to 500 characters
                    const newValue = e.target.value.slice(0, 500);
                    setComment(newValue);
                  }}
                  className="resize-none h-9 py-2 min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  maxLength={500}
                  rows={1}
                  data-comment-input
                />
                <Button 
                  onClick={handleSubmit} 
                  disabled={!comment.trim() || isSubmitting}
                >
                  {isSubmitting ? "Posting..." : "Post"}
                </Button>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                {replyToComment && (
                  <button 
                    onClick={cancelReply}
                    className="text-xs text-muted-foreground hover:underline flex items-center font-semibold"
                  >
                    <X className="h-3.5 w-3.5 mr-1 stroke-[2.5]" />
                    Cancel Reply
                  </button>
                )}
                <div className={`${replyToComment ? '' : 'w-full'} text-right`}>
                  {comment.length}/500 characters
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
} 