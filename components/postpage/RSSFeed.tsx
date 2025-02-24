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
  mediaType?: string;
}

// Function to get initial entries with batch data fetching
export const getInitialEntries = cache(async (postTitle: string, feedUrl: string) => {
  // Use Redis-cached entries first
  const entries = await getRSSEntries(postTitle, feedUrl);
  if (!entries || entries.length === 0) return null;

  // Get auth token for Convex queries that need auth
  const token = await convexAuthNextjsToken();

  // Extract all entry GUIDs
  const guids = entries.map(entry => entry.guid);

  // Fetch all entry data in a single consistent query
  const entryData = await fetchQuery(
    api.entries.batchGetEntryData, 
    { entryGuids: guids }, 
    { token }
  );

  // Map the results back to individual entries
  const entriesWithPublicData = entries.map((entry, index) => ({
    entry,
    initialData: entryData[index]
  }));

  return {
    entries: entriesWithPublicData,
  };
});

export default async function RSSFeed({ postTitle, feedUrl, initialData, featuredImg, mediaType }: RSSFeedProps) {
  return (
    <RSSFeedClient
      postTitle={postTitle}
      feedUrl={feedUrl}
      initialData={initialData}
      pageSize={10}
      featuredImg={featuredImg}
      mediaType={mediaType}
    />
  );
}