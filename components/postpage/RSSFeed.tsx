// components/postpage/RSSFeed.tsx
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

export const getInitialEntries = cache(async (postTitle: string, feedUrl: string) => {
  const entries = await getRSSEntries(postTitle, feedUrl);
  if (!entries || entries.length === 0) return null;

  // Only use the first 10 entries for initial data
  const initialEntries = entries.slice(0, 10);
  
  const token = await convexAuthNextjsToken();
  const guids = initialEntries.map(entry => entry.guid);
  const entryData = await fetchQuery(
    api.entries.batchGetEntryData,
    { entryGuids: guids },
    { token }
  );

  const entriesWithPublicData = initialEntries.map((entry, index) => ({
    entry,
    initialData: entryData[index]
  }));

  return {
    entries: entriesWithPublicData,
    totalEntries: entries.length, // Include total count for pagination
    hasMore: entries.length > 10 // Let client know if there are more entries
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