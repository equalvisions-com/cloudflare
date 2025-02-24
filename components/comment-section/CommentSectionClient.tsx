'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";

interface CommentSectionProps {
  entryGuid: string;
  feedUrl: string;
  initialData?: {
    count: number;
  };
}

interface CommentWithUser {
  _id: Id<"comments">;
  userId: Id<"users">;
  username: string;
  content: string;
  createdAt: number;
  parentId?: Id<"comments">;
  user?: {
    userId: Id<"users">;
    username: string;
    name?: string;
    email?: string;
    image?: string;
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  // Use lightweight metrics query when not expanded
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  
  // Only fetch full data when expanded
  const fullData = useQuery(
    api.entries.getEntryWithComments,
    isExpanded ? { entryGuid } : "skip"
  );

  // Use metrics for count when not expanded, full data when expanded
  const commentCount = isExpanded 
    ? fullData?.comments.count ?? initialData.count
    : metrics?.comments.count ?? initialData.count;

  // Get comments array only when expanded
  const comments = (fullData?.comments.items || []) as CommentWithUser[];

  const addComment = useMutation(api.comments.addComment);
  const deleteComment = useMutation(api.comments.deleteComment);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    try {
      await addComment({
        entryGuid,
        feedUrl,
        content: newComment.trim(),
      });
      
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDelete = async (commentId: Id<"comments">) => {
    try {
      await deleteComment({ commentId });
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 px-0 hover:bg-transparent items-end"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <MessageCircle className="h-4 w-4" />
        <span>{commentCount}</span>
      </Button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment._id} className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{comment.user?.username || comment.username}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  {comment.user?.userId === comment.userId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comment._id)}
                      className="h-6 px-2 text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px]"
            />
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim()}
            >
              Post Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 