import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";

export function useCommentActions() {
  const addCommentMutation = useMutation(api.comments.addComment);
  const deleteCommentMutation = useMutation(api.comments.deleteComment);

  const addComment = async (
    entryGuid: string,
    feedUrl: string,
    content: string
  ) => {
    try {
      await addCommentMutation({ entryGuid, feedUrl, content });
      return true;
    } catch (error) {
      console.error("Failed to add comment:", error);
      return false;
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const id = commentId as Id<"comments">;
      await deleteCommentMutation({ commentId: id });
      return true;
    } catch (error) {
      console.error("Failed to delete comment:", error);
      return false;
    }
  };

  return { addComment, deleteComment };
}