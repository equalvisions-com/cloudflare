'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

interface CommentSectionProps {
  entryGuid: string;
  feedUrl: string;
  initialData?: {
    count: number;
  };
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

// Custom component to handle mobile-friendly textarea auto growing
const MobileAutoGrowTextarea = ({ 
  value, 
  onChange, 
  placeholder, 
  maxLength, 
  className = "",
  onSubmit
}: { 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, 
  placeholder: string, 
  maxLength?: number,
  className?: string,
  onSubmit?: () => void
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Store the last scroll position
  const lastScrollPosition = useRef<number>(0);
  
  // Track if the keyboard is visible
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Update height when value changes
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to get accurate scrollHeight
      textareaRef.current.style.height = 'auto';
      // Set height to scrollHeight
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Detect keyboard visibility changes
  useEffect(() => {
    const detectKeyboard = () => {
      // On iOS, window.visualViewport.height changes when keyboard appears
      // On Android, window.innerHeight changes when keyboard appears
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      
      // If viewport height is significantly less than window height, keyboard is likely visible
      const keyboardVisible = currentViewportHeight < windowHeight * 0.8;
      
      if (keyboardVisible !== isKeyboardVisible) {
        setIsKeyboardVisible(keyboardVisible);
        
        // When keyboard closes, store the current scroll position
        if (!keyboardVisible) {
          lastScrollPosition.current = window.scrollY;
        }
      }
    };

    // Subscribe to resize and visualViewport resize events
    window.addEventListener('resize', detectKeyboard);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectKeyboard);
    }

    return () => {
      window.removeEventListener('resize', detectKeyboard);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', detectKeyboard);
      }
    };
  }, [isKeyboardVisible]);

  // Handle key events (Enter to submit)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Handle focus events to prevent scrolling to top
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    
    // Store current position
    const currentPosition = window.scrollY;
    lastScrollPosition.current = currentPosition;
    
    // Make textarea visible in viewport
    const textareaRect = textareaRef.current?.getBoundingClientRect();
    if (textareaRect) {
      // Get viewport height (accounting for keyboard)
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      
      // Check if textarea is partially offscreen
      if (textareaRect.bottom > viewportHeight) {
        // Adjust scroll to keep textarea above keyboard
        const newScrollY = currentPosition + (textareaRect.bottom - viewportHeight) + 20; // 20px buffer
        
        // Use RAF to ensure this happens after browser's default scroll behavior
        requestAnimationFrame(() => {
          window.scrollTo({
            top: newScrollY,
            behavior: 'smooth'
          });
        });
      } else {
        // Just maintain current scroll position
        requestAnimationFrame(() => {
          window.scrollTo(0, currentPosition);
        });
      }
    }
  };

  // Create a throttled scroll restoration function
  const restoreScrollPosition = useCallback(() => {
    if (document.activeElement !== textareaRef.current) {
      window.scrollTo(0, lastScrollPosition.current);
    }
  }, []);

  // Apply scroll restoration on blur
  const handleBlur = () => {
    // If keyboard is closing (will be detected by the resize listener)
    // the lastScrollPosition will be updated and we'll use it later
  };

  return (
    <div 
      ref={wrapperRef} 
      className="relative w-full"
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={1}
        className={`text-base resize-none py-2 min-h-[36px] overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none ${className}`}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={(e) => {
          // Prevent any default behavior that might cause scrolling
          e.stopPropagation();
          handleFocus(e as unknown as React.FocusEvent<HTMLTextAreaElement>);
        }}
      />
    </div>
  );
};

export function CommentSectionClient({ 
  entryGuid, 
  feedUrl,
  initialData = { count: 0 }
}: CommentSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
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
  
  // Track keyboard visibility
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // Reference to the comment input container
  const commentInputRef = useRef<HTMLDivElement>(null);
  
  // Authentication and current user
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Track deleted comments/replies
  const [deletedComments, setDeletedComments] = useState<Set<string>>(new Set());
  
  // Ensure the textarea scrolls into view when the keyboard appears
  useEffect(() => {
    if (isKeyboardVisible && commentInputRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        commentInputRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      });
    }
  }, [isKeyboardVisible]);
  
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Detect keyboard visibility changes
    const detectKeyboard = () => {
      if (!isMountedRef.current) return;
      
      // On iOS, window.visualViewport.height changes when keyboard appears
      // On Android, window.innerHeight changes when keyboard appears
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      
      // If viewport height is significantly less than window height, keyboard is likely visible
      const keyboardVisible = currentViewportHeight < windowHeight * 0.8;
      
      if (keyboardVisible !== isKeyboardVisible) {
        setIsKeyboardVisible(keyboardVisible);
      }
    };

    // Subscribe to resize and visualViewport resize events
    window.addEventListener('resize', detectKeyboard);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectKeyboard);
    }
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', detectKeyboard);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', detectKeyboard);
      }
    };
  }, [isKeyboardVisible]);
  
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
  const commentCount = optimisticCount ?? (metricsLoaded ? (metrics?.comments.count ?? initialData.count) : initialData.count);
  
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
        parentId // Add parentId if replying to a comment
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
  }, [comment, addComment, entryGuid, feedUrl, commentCount, replyToComment, isSubmitting]);
  
  // Function to handle initiating a reply to a comment
  const handleReply = (comment: CommentFromAPI) => {
    setReplyToComment(comment);
  };
  
  // Function to cancel reply
  const cancelReply = () => {
    setReplyToComment(null);
  };
  
  // Group top-level comments and their replies
  const organizeCommentsHierarchy = () => {
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
  };
  
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
  
  const deleteComment = async (commentId: Id<"comments">) => {
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
  };
  
  // Function to set reference for the like count element
  const setCommentLikeCountRef = (commentId: string, el: HTMLDivElement | null) => {
    if (el && commentId) {
      commentLikeCountRefs.current.set(commentId, el);
    }
  };
  
  // Helper to format time difference
  const formatTimeDifference = (creationTime: number) => {
    const now = new Date();
    const commentDate = new Date(creationTime);
    
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
  };
  
  // Toggle reply visibility for a comment
  const toggleRepliesVisibility = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };
  
  // Render a single comment with its replies
  const renderComment = (comment: CommentWithReplies | CommentFromAPI, isReply = false) => {
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
    const handleDeleteComment = async () => {
      await deleteComment(comment._id);
    };
    
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
                  {formatTimeDifference(comment._creationTime)}
                </div>
                
                {/* Like count for comment */}
                <div 
                  ref={(el) => setCommentLikeCountRef(comment._id.toString(), el)}
                  className="leading-none font-semibold text-muted-foreground text-xs hidden"
                >
                  <span>0 Likes</span>
                </div>
                
                {/* Reply button - only show on top-level comments, not replies */}
                {!isReply && (
                  <button 
                    onClick={() => handleReply(comment)}
                    className="leading-none font-semibold text-muted-foreground text-xs cursor-pointer hover:underline"
                  >
                    Reply
                  </button>
                )}
                
                {/* View/Hide Replies button - only show if comment has replies */}
                {!isReply && hasReplies && (
                  <button 
                    onClick={() => toggleRepliesVisibility(comment._id.toString())}
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
                  onCountChange={(count) => updateCommentLikeCount(comment._id.toString(), count)}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Display replies if this is a top-level comment with replies and replies are expanded */}
        {hasReplies && areRepliesExpanded && (
          <div style={{ paddingLeft: '44px' }}>
            {(comment as CommentWithReplies).replies.map(reply => 
              renderComment(reply, true)
            )}
          </div>
        )}
      </div>
    );
  };
  
  // Organize comments into a hierarchy
  const commentHierarchy = organizeCommentsHierarchy();
  
  return (
    <>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="h-4 w-4 text-muted-foreground stroke-[2.5] transition-colors duration-200" />
          <span className="text-[14px] text-muted-foreground font-semibold transition-all duration-200">{commentCount}</span>
        </Button>
        <DrawerContent 
          className={`w-full max-w-[550px] mx-auto bottom-0 flex flex-col ${isKeyboardVisible ? 'h-[50vh]' : 'h-[75vh]'}`} 
          style={{ 
            position: 'fixed',
            zIndex: 50
          }}
        >
          <DrawerHeader className="px-4 pb-2 text-center flex-shrink-0">
            <DrawerClose className="absolute right-4 top-4">
              <X className="h-4 w-4" />
            </DrawerClose>
            <DrawerTitle>Comments</DrawerTitle>
          </DrawerHeader>
          
          {/* Comments list with ScrollArea */}
          <ScrollArea className="flex-grow overflow-y-auto" scrollHideDelay={0} type="always">
            <div className="mt-2">
              {commentHierarchy.length > 0 ? (
                commentHierarchy.map(comment => renderComment(comment))
              ) : (
                <p className="text-muted-foreground py-4 text-center">No comments yet. Be the first to comment!</p>
              )}
            </div>
          </ScrollArea>
          
          {/* Comment input - stays at bottom */}
          <div 
            ref={commentInputRef}
            className="flex flex-col gap-2 mt-2 border-t border-border p-4 sticky bottom-0 bg-background flex-shrink-0"
          >
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <MobileAutoGrowTextarea
                  placeholder={replyToComment 
                    ? `Reply to ${replyToComment.username}...`
                    : "Add a comment..."}
                  value={comment}
                  onChange={(e) => {
                    // Limit to 500 characters
                    const newValue = e.target.value.slice(0, 500);
                    setComment(newValue);
                  }}
                  className="text-base resize-none h-9 py-2 min-h-0 overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
                  maxLength={500}
                  onSubmit={handleSubmit}
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