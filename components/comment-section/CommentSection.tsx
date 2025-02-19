"use client";
import { useState, useEffect, ChangeEvent, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCommentActions } from "./actions";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface SanitizedComment {
  id: string;
  content: string;
  createdAt: number;
  authorName: string;
  isAuthor: boolean;
}

interface CommentSectionProps {
  entryGuid: string;
  feedUrl: string;
  initialComments: SanitizedComment[];
  isAuthenticated: boolean;
}

export function CommentSection({
  entryGuid,
  feedUrl,
  initialComments,
  isAuthenticated,
}: CommentSectionProps) {
  const router = useRouter();
  // Use Convex's reactive query for live comments.
  const liveComments = useQuery(api.comments.getComments, { entryGuid });
  const [comments, setComments] = useState<SanitizedComment[]>(initialComments);

  useEffect(() => {
    if (liveComments) {
      setComments(
        liveComments.map((comment) => ({
          id: comment._id,
          content: comment.content,
          createdAt: comment.createdAt,
          authorName: comment.username,
          isAuthor: comment.userId === comment.user?._id,
        }))
      );
    }
  }, [liveComments]);

  const { addComment, deleteComment } = useCommentActions();
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const userProfile = useQuery(api.users.getProfile);

  const handleSubmit = () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    if (!newComment.trim() || !userProfile) return;

    startTransition(async () => {
      setIsSubmitting(true);
      // Create an optimistic comment with a temporary ID.
      const optimisticComment: SanitizedComment = {
        id: "temp-" + Date.now(),
        content: newComment,
        createdAt: Date.now(),
        authorName: userProfile.username,
        isAuthor: true,
      };

      // Optimistically update local state.
      setComments((prev) => [optimisticComment, ...prev]);
      const success = await addComment(entryGuid, feedUrl, newComment);
      if (success) {
        setNewComment("");
      } else {
        // Revert the optimistic update on failure.
        setComments((prev) =>
          prev.filter((comment) => comment.id !== optimisticComment.id)
        );
      }
      setIsSubmitting(false);
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="p-4 rounded-lg border bg-card text-card-foreground"
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="font-medium">{comment.authorName}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                </div>
              </div>
              {comment.isAuthor && (
                <ConfirmDeleteDialog
                  onConfirm={async () => {
                    const previousComments = comments;
                    // Optimistically remove the comment.
                    setComments((prev) =>
                      prev.filter((c) => c.id !== comment.id)
                    );
                    const success = await deleteComment(comment.id);
                    if (!success) {
                      setComments(previousComments);
                    }
                  }}
                />
              )}
            </div>
            <div className="mt-2 whitespace-pre-wrap">{comment.content}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center pb-4">
        <Input
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="h-9 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none active:outline-none bg-white"
          disabled={!isAuthenticated || isSubmitting}
        />
        <Button
          onClick={handleSubmit}
          disabled={
            !newComment.trim() || !isAuthenticated || isSubmitting || isPending
          }
          className="h-9 shrink-0"
        >
          {isSubmitting ? "Posting..." : "Post"}
        </Button>
      </div>
    </div>
  );
}