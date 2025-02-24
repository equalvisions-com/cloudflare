// components/rss-feed/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getMergedRSSEntries } from "@/lib/redis";
import { cache } from "react";
import { RSSEntriesClient } from "./RSSEntriesDisplay.client";
import { Id } from "@/convex/_generated/dataModel";

interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
}

export const getInitialEntries = cache(async () => {
  const token = await convexAuthNextjsToken();
  if (!token) return null;

  // 1. First, get the user's RSS keys
  const rssKeys = await fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });
  if (!rssKeys || rssKeys.length === 0) return null;

  // 2. Fetch entries first to get the actual feedUrls
  const entries = await getMergedRSSEntries(rssKeys);
  if (!entries || entries.length === 0) return null;

  // 3. Get unique feedUrls from the entries
  const feedUrls = [...new Set(entries.map(entry => entry.feedUrl))];

  // 4. Fetch posts data using the actual feedUrls
  const postsData = await fetchQuery(
    api.posts.getPostsByFeedUrls,
    { feedUrls },
    { token }
  );

  // 5. Create a map of feedUrl to post metadata for O(1) lookups
  const postMetadataMap = new Map<string, PostMetadata>(
    postsData.map(post => [post.feedUrl, {
      title: post.title,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug
    }])
  );

  // 6. Batch fetch entry data for all entries at once
  const guids = entries.map(entry => entry.guid);
  const entryData = await fetchQuery(
    api.entries.batchGetEntryData,
    { entryGuids: guids },
    { token }
  );

  // 7. Combine all data efficiently
  const entriesWithPublicData = entries.map((entry, index) => ({
    entry,
    initialData: entryData[index],
    postMetadata: postMetadataMap.get(entry.feedUrl) || {
      title: '',
      featuredImg: undefined,
      mediaType: undefined,
      postSlug: '',
      categorySlug: ''
    }
  }));

  return {
    entries: entriesWithPublicData,
    totalEntries: entries.length,
  };
});

export default async function RSSEntriesDisplay() {
  const initialData = await getInitialEntries();
  
  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found. Please sign in and add some RSS feeds to get started.
      </div>
    );
  }

  return (
    <RSSEntriesClient
      initialData={initialData}
      pageSize={10}
    />
  );
}