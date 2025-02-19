"use client";

import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useFollowState } from "./useFollowState";

interface FollowButtonProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
  initialIsFollowing: boolean;
}

export function FollowButton({ postId, feedUrl, postTitle, initialIsFollowing }: FollowButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { isFollowing, isInCooldown, toggleFollow } = useFollowState(
    postId,
    feedUrl,
    postTitle,
    initialIsFollowing
  );

  const handleClick = async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    await toggleFollow();
  };

  return (
    <Button
      variant={isFollowing ? "secondary" : "default"}
      onClick={handleClick}
      className="w-28 disabled:opacity-100"
      disabled={!isAuthenticated || isInCooldown}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}