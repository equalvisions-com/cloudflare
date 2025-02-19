"use client";

import { Button } from "@/components/ui/button";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useLikeActions } from "./actions";
import { Heart, HeartFilled } from "./icons";
import { useTransition } from "react";
import { api } from "@/convex/_generated/api";

interface LikeButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
  initialIsLiked: boolean;
  initialLikeCount: number;
}

export function LikeButton({
  entryGuid,
  feedUrl,
  title,
  pubDate,
  link,
  initialIsLiked,
  initialLikeCount,
}: LikeButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { likeEntry, unlikeEntry } = useLikeActions();
  const [isPending, startTransition] = useTransition();

  // Query for the like state and like count
  const queriedIsLiked = useQuery(api.likes.isLiked, { entryGuid });
  const queriedLikeCount = useQuery(api.likes.getLikeCount, { entryGuid });

  // Use server-provided initial values if the query hasn't returned yet
  const isLiked = queriedIsLiked === undefined ? initialIsLiked : queriedIsLiked;
  const likeCount =
    queriedLikeCount === undefined ? initialLikeCount : queriedLikeCount;

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    startTransition(async () => {
      if (isLiked) {
        await unlikeEntry(entryGuid);
      } else {
        await likeEntry(entryGuid, feedUrl, title, pubDate, link);
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="h-8 flex items-center gap-1 px-2 disabled:opacity-100"
      disabled={!isAuthenticated || isPending}
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