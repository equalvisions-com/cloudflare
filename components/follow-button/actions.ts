import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { formatRSSKey } from "@/lib/rss";

export function useFollowActions() {
  const followMutation = useMutation(api.following.follow);
  const unfollowMutation = useMutation(api.following.unfollow);

  const followPost = async (postId: Id<"posts">, feedUrl: string, postTitle: string) => {
    try {
      const rssKey = formatRSSKey(postTitle);
      await followMutation({
        postId,
        feedUrl,
        rssKey,
      });
      return true;
    } catch (error) {

      throw error;
    }
  };

  const unfollowPost = async (postId: Id<"posts">, postTitle: string) => {
    try {
      const rssKey = formatRSSKey(postTitle);
      await unfollowMutation({
        postId,
        rssKey,
      });
      return true;
    } catch (error) {

      throw error;
    }
  };

  return {
    followPost,
    unfollowPost,
  };
}