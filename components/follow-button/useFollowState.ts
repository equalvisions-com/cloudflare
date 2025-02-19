import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useFollowActions } from "./actions";

export function useFollowState(
  postId: Id<"posts">, 
  feedUrl: string, 
  postTitle: string,
  initialIsFollowing: boolean
) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const { followPost, unfollowPost } = useFollowActions();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isInCooldown) {
      timeoutId = setTimeout(() => {
        setIsInCooldown(false);
      }, 10000); // 10-second cooldown
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isInCooldown]);

  const toggleFollow = async () => {
    if (isInCooldown) return false;

    // Optimistically update the UI
    setIsFollowing((prev) => !prev);
    setIsInCooldown(true);

    const success = isFollowing
      ? await unfollowPost(postId, postTitle)
      : await followPost(postId, feedUrl, postTitle);

    if (!success) {
      // Revert state if the API call fails
      setIsFollowing((prev) => !prev);
      setIsInCooldown(false);
      // Optionally, display an error message to the user
      alert("An error occurred. Please try again.");
    }

    return success;
  };

  return {
    isFollowing,
    isInCooldown,
    toggleFollow,
  };
}