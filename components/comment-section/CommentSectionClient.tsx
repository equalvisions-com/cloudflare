'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";

interface CommentSectionProps {
  entryGuid: string;
  feedUrl: string;
  initialData?: {
    count: number;
  };
}

interface Comment {
  _id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: number;
  parentId?: string;
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
  
  // Fetch comments when expanded
  const comments = useQuery(
    api.comments.getComments,
    isExpanded ? { entryGuid } : "skip"
  ) || [];

  const addComment = useMutation(api.comments.addComment);
  const getCommentCount = useQuery(api.comments.getCommentCount, { entryGuid });

  // Use the count from Convex instead of SWR
  const commentCount = getCommentCount ?? initialData.count;

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

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 px-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <MessageCircle className="h-4 w-4" />
        <span>{commentCount}</span>
      </Button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="space-y-4">
            {comments.map((comment: Comment) => (
              <div key={comment._id} className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{comment.username}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                  </span>
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