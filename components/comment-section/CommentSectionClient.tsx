'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { createPortal } from 'react-dom';

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

export function CommentSectionClient({ 
  entryGuid, 
  feedUrl,
  initialData = { count: 0 }
}: CommentSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [optimisticTimestamp, setOptimisticTimestamp] = useState<number | null>(null);
  
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
        content: comment.trim()
      });
      
      // Clear the comment input
      setComment('');
      
      // Convex will automatically update the UI with the new state
      // No need to manually update as the useQuery hook will receive the update
    } catch (error) {
      console.error('Error adding comment:', error);
      // Revert optimistic update on error
      setOptimisticCount(null);
      setOptimisticTimestamp(null);
    }
  }, [comment, addComment, entryGuid, feedUrl, commentCount]);
  
  const toggleComments = () => {
    setIsOpen(!isOpen);
  };
  
  // Render the comments section
  const renderComments = () => {
    if (!isOpen) return null;
    
    const commentsSection = document.getElementById(`comments-${entryGuid}`);
    if (!commentsSection) return null;
    
    return createPortal(
      <div className="p-4 space-y-4">
        <h3 className="font-medium">Comments ({commentCount})</h3>
        
        {/* Comment input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none"
          />
          <Button onClick={handleSubmit} disabled={!comment.trim()}>Post</Button>
        </div>
        
        {/* Comments list */}
        <div className="space-y-3 mt-4">
          {comments && comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment._id} className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{comment.username || 'Anonymous'}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment._creationTime), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-1">{comment.content}</p>
              </div>
            ))
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