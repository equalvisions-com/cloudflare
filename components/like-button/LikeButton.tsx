"use client";

import { Button } from "@/components/ui/button";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { Heart, HeartFilled } from "./icons";
import { api } from "@/convex/_generated/api";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface LikeButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
  initialData?: {
    isLiked: boolean;
    count: number;
  };
}

export function LikeButtonWithErrorBoundary(props: LikeButtonProps) {
  return (
    <ErrorBoundary>
      <LikeButton {...props} />
    </ErrorBoundary>
  );
}

export function LikeButton({ 
  entryGuid,
  feedUrl,
  title,
  pubDate,
  link,
  initialData = { isLiked: false, count: 0 }
}: LikeButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();

  // Query for entry metrics which includes like state and count
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });

  // Use server-provided initial values if the query hasn't returned yet
  const isLiked = metrics?.likes.isLiked ?? initialData.isLiked;
  const likeCount = metrics?.likes.count ?? initialData.count;

  // Mutations for liking/unliking
  const like = useMutation(api.likes.like);
  const unlike = useMutation(api.likes.unlike);

  const handleClick = async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    try {
      if (isLiked) {
        await unlike({ entryGuid });
      } else {
        await like({
          entryGuid,
          feedUrl,
          title,
          pubDate,
          link,
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="h-8 flex items-center gap-1 px-2 disabled:opacity-100"
      disabled={!isAuthenticated}
    >
      {isLiked ? (
        <HeartFilled className="h-5 w-5 text-red-500 transition scale-110" />
      ) : (
        <Heart className="h-5 w-5" />
      )}
      <span className="text-xs min-w-[1rem] text-center">
        {likeCount}
      </span>
    </Button>
  );
}