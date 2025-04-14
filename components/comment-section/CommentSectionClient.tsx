'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageCircle, X, ChevronDown } from "lucide-react";
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

// --- Interfaces (same as you had, no changes needed) ---

interface CommentSectionProps {
  entryGuid: string;
  feedUrl: string;
  initialData?: {
    count: number;
  };
}

interface CommentFromAPI {
  _id: Id<"comments">;
  _creationTime: number;
  userId: Id<"users">;
  username: string;
  content: string;
  parentId?: Id<"comments">;
  user?: UserProfile | null;
  entryGuid: string;
  feedUrl: string;
  createdAt: number;
}

interface UserProfile {
  _id: Id<"users">;
  _creationTime: number;
  username?: string;
  name?: string;
  profileImage?: string;
  bio?: string;
  rssKeys?: string[];
  email?: string;
  emailVerificationTime?: number;
  image?: string;
  isAnonymous?: boolean;
  [key: string]: unknown;
}

interface CommentWithReplies extends CommentFromAPI {
  replies: CommentFromAPI[];
}

// --- Main Component ---

export function CommentSectionClientWithErrorBoundary(props: CommentSectionProps) {
  return (
    <ErrorBoundary>
      <CommentSectionClient {...props} />
    </ErrorBoundary>
  );
}

export function CommentSectionClient({ entryGuid, feedUrl, initialData = { count: 0 } }: CommentSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [replyToComment, setReplyToComment] = useState<CommentFromAPI | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  const comments = useQuery(api.comments.getComments, { entryGuid });

  const addComment = useMutation(api.comments.addComment);

  const handleSubmit = useCallback(async () => {
    if (!comment.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const commentContent = comment.trim();
      const parentId = replyToComment?._id;
      setComment('');
      setReplyToComment(null);

      await addComment({ entryGuid, feedUrl, content: commentContent, parentId });
    } catch (error) {
      console.error('❌ Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [comment, addComment, entryGuid, feedUrl, replyToComment, isSubmitting]);

  const cancelReply = () => setReplyToComment(null);

  const organizeCommentsHierarchy = () => {
    if (!comments) return [];
    const commentMap = new Map<string, CommentWithReplies>();
    const topLevelComments: CommentWithReplies[] = [];

    comments.forEach(comment => {
      commentMap.set(comment._id, { ...comment, replies: [] });
    });

    comments.forEach(comment => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) parent.replies.push(comment);
      } else {
        const enhancedComment = commentMap.get(comment._id);
        if (enhancedComment) topLevelComments.push(enhancedComment);
      }
    });

    return topLevelComments;
  };

  const commentHierarchy = organizeCommentsHierarchy();
  const commentCount = metrics?.comments.count ?? initialData.count;

  return (
    <>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-0 hover:bg-transparent w-full"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="h-4 w-4 text-muted-foreground stroke-[2.5]" />
          <span className="text-[14px] text-muted-foreground font-semibold">{commentCount}</span>
        </Button>

        {/* Updated DrawerContent */}
        <DrawerContent className="flex flex-col h-[100dvh] w-full max-w-[550px] mx-auto">
          {/* Header */}
          <DrawerHeader className="px-4 pb-2 shrink-0 text-center">
            <DrawerTitle>Comments</DrawerTitle>
          </DrawerHeader>

          {/* Scrollable comments */}
          <ScrollArea className="flex-1 px-4" scrollHideDelay={0} type="always">
            <div className="mt-2">
              {commentHierarchy.length > 0 ? (
                commentHierarchy.map((comment) => (
                  <div key={comment._id} className="border-t py-4">
                    <div className="flex items-start gap-2">
                      <ProfileImage
                        profileImage={comment.user?.profileImage || comment.user?.image || ''}
                        username={comment.username}
                        size="sm"
                      />
                      <div className="flex flex-col">
                        <div className="font-bold text-sm">{comment.username || "Anonymous"}</div>
                        <div className="text-sm">{comment.content}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground py-4 text-center">No comments yet.</p>
              )}
            </div>
          </ScrollArea>

          {/* Textarea input - pinned above keyboard */}
          <div className="shrink-0 border-t border-border p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder={replyToComment ? `Reply to ${replyToComment.username}...` : "Add a comment..."}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                className="resize-none h-10 flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
                maxLength={500}
                rows={1}
              />
              <Button onClick={handleSubmit} disabled={!comment.trim() || isSubmitting}>
                {isSubmitting ? "Posting..." : "Post"}
              </Button>
            </div>

            {/* Cancel reply */}
            {replyToComment && (
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <button onClick={cancelReply} className="hover:underline">
                  <X className="h-3 w-3 inline mr-1" />
                  Cancel Reply
                </button>
                <span>{comment.length}/500 characters</span>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
