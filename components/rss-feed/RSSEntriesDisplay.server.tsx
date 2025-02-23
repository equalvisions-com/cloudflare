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

  // Wait for entries
  const entries = await entriesPromise;
  if (!entries || entries.length === 0) return null;

  // Extract all entry GUIDs
  const guids = entries.map(entry => entry.guid);

  // Batch fetch all data in parallel
  const [likeData, commentCounts] = await Promise.all([
    fetchQuery(api.likes.batchGetLikeData, { entryGuids: guids }, { token: initialData.token }),
    fetchQuery(api.comments.batchGetCommentCounts, { entryGuids: guids })
  ]);

  // Map the batch results back to individual entries
  const entriesWithPublicData = entries.map((entry, index) => ({
    entry,
    initialData: {
      likes: {
        isLiked: likeData[index].isLiked,
        count: likeData[index].count
      },
      comments: {
        count: commentCounts[index]
      }
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