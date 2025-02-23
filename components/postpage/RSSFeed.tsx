import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSFeedClient } from "./RSSFeedClient";
import { getRSSEntries } from "@/lib/redis";

interface RSSFeedProps {
  postTitle: string;
  feedUrl: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getInitialEntries>>>;
  featuredImg?: string;
}

// Function to get initial entries with batch data fetching
export const getInitialEntries = cache(async (postTitle: string, feedUrl: string) => {
  // Use Redis-cached entries first
  const entries = await getRSSEntries(postTitle, feedUrl);
  if (!entries || entries.length === 0) return null;

  // Get auth token for Convex queries that need auth
  const token = await convexAuthNextjsToken();

  // Fetch public data (like counts and comment counts) without auth
  const entriesWithPublicData = await Promise.all(
    entries.map(async (entry) => {
      const [likeCount, commentCount] = await Promise.all([
        fetchQuery(api.likes.getLikeCount, { entryGuid: entry.guid }),
        fetchQuery(api.comments.getCommentCount, { entryGuid: entry.guid }),
      ]);

      // If authenticated, also fetch isLiked state
      const isLiked = token 
        ? await fetchQuery(api.likes.isLiked, { entryGuid: entry.guid }, { token })
        : false;

      return {
        entry,
        initialData: {
          likes: { isLiked, count: likeCount },
          comments: { count: commentCount }
        }
      };
    })
  );

  return {
    entries: entriesWithPublicData,
  };
});

export default async function RSSFeed({ postTitle, feedUrl, initialData, featuredImg }: RSSFeedProps) {
  return (
    <RSSFeedClient
      postTitle={postTitle}
      feedUrl={feedUrl}
      initialData={initialData}
      pageSize={10}
      featuredImg={featuredImg}
    />
  );
}