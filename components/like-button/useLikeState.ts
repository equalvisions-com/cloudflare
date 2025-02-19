import { useState, useRef } from "react";
import { useLikeActions } from "./actions";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useLikeState(
  entryGuid: string,
  feedUrl: string,
  title: string,
  pubDate: string,
  link: string,
  initialIsLiked: boolean
) {
  const [isLoading, setIsLoading] = useState(false);
  const isProcessing = useRef(false);
  const { likeEntry, unlikeEntry } = useLikeActions();

  // ✅ Get real-time like status from Convex
  const isLiked = useQuery(api.likes.isLiked, { entryGuid }) ?? initialIsLiked;

  const toggleLike = async () => {
    if (isProcessing.current) return false;
    isProcessing.current = true;
    setIsLoading(true);

    try {
      if (isLiked) {
        await unlikeEntry(entryGuid);
      } else {
        await likeEntry(entryGuid, feedUrl, title, pubDate, link);
      }
      return true;
    } catch (error) {
      console.error("Error toggling like:", error);
      return false;
    } finally {
      isProcessing.current = false;
      setIsLoading(false);
    }
  };

  return {
    isLiked,
    isLoading,
    toggleLike,
  };
}