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

  const token = await convexAuthNextjsToken();
  const guids = entries.map(entry => entry.guid);
  const entryData = await fetchQuery(
    api.entries.batchGetEntryData,
    { entryGuids: guids },
    { token }
  );

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