'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageCircle, CornerDownRight, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { createPortal } from 'react-dom';
import { Id } from "@/convex/_generated/dataModel";

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

export function CommentSectionClient({ 
  entryGuid, 
  feedUrl,
  initialData = { count: 0 }
}: CommentSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [optimisticTimestamp, setOptimisticTimestamp] = useState<number | null>(null);
  // State to track which comment is being replied to
  const [replyToComment, setReplyToComment] = useState<CommentFromAPI | null>(null);
  
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
    if (!comment.trim()) return;
    
    // Optimistic update with timestamp
    setOptimisticCount(commentCount + 1);
    setOptimisticTimestamp(Date.now());
    
    try {
      await addComment({
        entryGuid,
        feedUrl,
        content: comment.trim(),
        parentId: replyToComment?._id // Add parentId if replying to a comment
      });
      
      // Clear the comment input and reset reply state
      setComment('');
      setReplyToComment(null);
      
      // Convex will automatically update the UI with the new state
      // No need to manually update as the useQuery hook will receive the update
    } catch (error) {
      console.error('Error adding comment:', error);
      // Revert optimistic update on error
      setOptimisticCount(null);
      setOptimisticTimestamp(null);
    }
  }, [comment, addComment, entryGuid, feedUrl, commentCount, replyToComment]);
  
  const toggleComments = () => {
    setIsOpen(!isOpen);
  };
  
  // Function to handle initiating a reply to a comment
  const handleReply = (comment: CommentFromAPI) => {
    setReplyToComment(comment);
    // Focus on comment input (we could add a ref to handle this)
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
  
  // Render a single comment with its replies
  const renderComment = (comment: CommentWithReplies | CommentFromAPI, isReply = false) => {
    const hasReplies = 'replies' in comment && comment.replies.length > 0;
    
    return (
      <div key={comment._id} className={`${isReply ? 'ml-6 mt-2' : 'border-b pb-3'}`}>
        <div className="flex justify-between items-center">
          <span className="font-medium">{comment.username || 'Anonymous'}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment._creationTime), { addSuffix: true })}
          </span>
        </div>
        <p className="mt-1">{comment.content}</p>
        
        {/* Reply button */}
        <div className="mt-1 flex">
          <Button 
            variant="ghost" 
            size="sm" 
            className="px-2 h-6 text-xs" 
            onClick={() => handleReply(comment)}
          >
            <CornerDownRight className="h-3 w-3 mr-1" />
            Reply
          </Button>
        </div>
        
        {/* Render replies */}
        {hasReplies && (
          <div className="mt-2 border-l-2 pl-3 border-muted">
            {(comment as CommentWithReplies).replies.map(reply => 
              renderComment(reply, true)
            )}
          </div>
        )}
      </div>
    );
  };
  
  // Render the comments section
  const renderComments = () => {
    if (!isOpen) return null;
    
    const commentsSection = document.getElementById(`comments-${entryGuid}`);
    if (!commentsSection) return null;
    
    // Organize comments into a hierarchy
    const commentHierarchy = organizeCommentsHierarchy();
    
    return createPortal(
      <div className="p-4 space-y-4">
        <h3 className="font-medium">Comments ({commentCount})</h3>
        
        {/* Comment input */}
        <div className="flex flex-col gap-2">
          {/* Show who we're replying to */}
          {replyToComment && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/30 rounded">
              <CornerDownRight className="h-3 w-3" />
              <span>Replying to {replyToComment.username}&apos;s comment</span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={cancelReply}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <Textarea
              placeholder={replyToComment ? "Write a reply..." : "Add a comment..."}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
            />
            <Button onClick={handleSubmit} disabled={!comment.trim()}>
              {replyToComment ? "Reply" : "Post"}
            </Button>
          </div>
        </div>
        
        {/* Comments list */}
        <div className="space-y-3 mt-4">
          {commentHierarchy.length > 0 ? (
            commentHierarchy.map(comment => renderComment(comment))
          ) : (
            <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
          )}
        </div>
      </div>,
      commentsSection
    );
  };
  
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full"
        onClick={toggleComments}
      >
        <MessageCircle className="h-4 w-4 transition-colors duration-200" />
        <span className="transition-all duration-200">{commentCount}</span>
      </Button>
      {renderComments()}
    </>
  );
} 