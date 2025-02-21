// components/rss/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getMergedRSSEntries } from "@/lib/redis";
import { cache } from "react";
import { RSSEntriesClient } from "./RSSEntriesDisplay.client";
import { headers } from 'next/headers';

// Cached function to get RSS keys and auth token in parallel
const getInitialData = cache(async () => {
  // Start fetching token early
  const tokenPromise = convexAuthNextjsToken();
  
  // Get headers in parallel but don't block on it
  headers();
  
  const token = await tokenPromise;
  if (!token) return { token: null, rssKeys: null };
  
  // Fetch RSS keys
  const rssKeys = await fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });
  
  return { token, rssKeys };
});

// Function to get initial entries with optimized data fetching
export const getInitialEntries = cache(async () => {
  // Get initial data first to handle the rssKeys properly
  const initialData = await getInitialData();
  if (!initialData.rssKeys) return null;

  // Start fetching entries early
  const entriesPromise = getMergedRSSEntries(initialData.rssKeys);

  // Pre-warm the cache for likes and comments queries
  await Promise.all([
    fetchQuery(api.likes.getLikeCount, { entryGuid: '' }),
    fetchQuery(api.comments.getCommentCount, { entryGuid: '' })
  ]).catch(() => {}); // Ignore errors from pre-warming

  // Wait for entries
  const entries = await entriesPromise;
  if (!entries || entries.length === 0) return null;

  // Batch fetch all public data in parallel
  const publicDataPromises = entries.map(entry => Promise.all([
    fetchQuery(api.likes.getLikeCount, { entryGuid: entry.guid }),
    fetchQuery(api.comments.getCommentCount, { entryGuid: entry.guid }),
    initialData.token ? 
      fetchQuery(api.likes.isLiked, { entryGuid: entry.guid }, { token: initialData.token }) 
      : false
  ]));

  // Wait for all public data to be fetched
  const publicData = await Promise.all(publicDataPromises);

  // Map the results back to entries
  const entriesWithPublicData = entries.map((entry, index) => {
    const [likeCount, commentCount, isLiked] = publicData[index];
    return {
      entry,
      initialData: {
        likes: { isLiked, count: likeCount },
        comments: { count: commentCount }
      }
    };
  });

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