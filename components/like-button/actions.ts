import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

export function useLikeActions() {
  const likeMutation = useMutation(api.likes.like);
  const unlikeMutation = useMutation(api.likes.unlike);

  const likeEntry = async (
    entryGuid: string,
    feedUrl: string,
    title: string,
    pubDate: string,
    link: string
  ) => {
    try {
      await likeMutation({
        entryGuid,
        feedUrl,
        title,
        pubDate,
        link,
      });
      return true;
    } catch (error) {
      console.error("Failed to like entry:", error);
      return false;
    }
  };

  const unlikeEntry = async (entryGuid: string) => {
    try {
      await unlikeMutation({ entryGuid });
      return true;
    } catch (error) {
      console.error("Failed to unlike entry:", error);
      return false;
    }
  };

  return {
    likeEntry,
    unlikeEntry,
  };
}