import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { LikeButtonClient } from "./LikeButtonClient";

interface LikeButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
}

export default async function LikeButtonServer({
  entryGuid,
  feedUrl,
  title,
  pubDate,
  link,
}: LikeButtonProps) {
  // Default initial data
  let initialData = {
    isLiked: false,
    count: 0
  };

  try {
    // Get auth token for Convex queries
    const token = await convexAuthNextjsToken();
    if (token) {
      // Fetch metrics which includes like state and count
      const metrics = await fetchQuery(
        api.entries.getEntryMetrics,
        { entryGuid },
        { token }
      );
      
      initialData = {
        isLiked: metrics.likes.isLiked,
        count: metrics.likes.count
      };
    }
  } catch (error) {
    console.error('Error fetching initial like data:', error);
  }

  return (
    <LikeButtonClient
      entryGuid={entryGuid}
      feedUrl={feedUrl}
      title={title}
      pubDate={pubDate}
      link={link}
      initialData={initialData}
    />
  );
}