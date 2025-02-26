// components/rss-feed/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getMergedRSSEntries } from "@/lib/redis";
import { cache } from "react";
import { RSSEntriesClient } from "./RSSEntriesDisplay.client";

interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
}

export const getInitialEntries = cache(async () => {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return null;

    // 1. First, get the user's RSS keys
    const rssKeys = await fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });
    if (!rssKeys || rssKeys.length === 0) return null;

    // 2. Fetch entries from Redis using the RSS keys
    const pageSize = 10; // Match the default pageSize in client
    const entries = await getMergedRSSEntries(rssKeys, 0, pageSize);
    if (!entries || entries.length === 0) return null;

    // 3. Get unique feedUrls from the entries
    const feedUrls = [...new Set(entries.filter(entry => entry.feedUrl).map(entry => entry.feedUrl))];
    
    if (feedUrls.length === 0) {
      console.error('No valid feed URLs found in entries');
      return null;
    }
    
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

    // 8. Check if there are more entries
    const nextPageEntries = await getMergedRSSEntries(rssKeys, pageSize, 1);
    const hasMore = nextPageEntries !== null && nextPageEntries.length > 0;

    return {
      entries: entriesWithPublicData,
      totalEntries: entries.length,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching initial entries:', error);
    return null;
  }
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