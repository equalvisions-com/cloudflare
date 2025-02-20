'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { Button } from "@/components/ui/button";
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

const fetcher = async (key: string) => {
  // Encode the key for use in URL
  const encodedKey = encodeURIComponent(key);
  const res = await fetch(`/api/comments/${encodedKey}`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
};

export function CommentSectionClient({ 
  entryGuid, 
  feedUrl,
  initialData = { count: 0 }
}: CommentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const { data, error, mutate } = useSWR(
    entryGuid,
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5 seconds
      revalidateIfStale: false,
      revalidateOnMount: !initialData,
    }
  );

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

  if (error) {
    console.error('Error fetching comments:', error);
    return null;
  }

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