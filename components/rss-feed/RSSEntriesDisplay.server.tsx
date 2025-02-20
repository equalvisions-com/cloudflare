// components/rss/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getMergedRSSEntries } from "@/lib/redis";
import { Suspense } from "react";
import { cache } from "react";
import { RSSEntriesClient } from "./RSSEntriesDisplay.client";

// Cached function to get RSS keys
const getRSSKeys = cache(async () => {
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  return fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });
});

// Function to get initial data for an entry
const getEntryInitialData = cache(async (entryGuid: string) => {
  const token = await convexAuthNextjsToken();
  if (!token) return null;

  const [isLiked, likeCount, commentCount] = await Promise.all([
    fetchQuery(api.likes.isLiked, { entryGuid }, { token }),
    fetchQuery(api.likes.getLikeCount, { entryGuid }, { token }),
    fetchQuery(api.comments.getCommentCount, { entryGuid }, { token }),
  ]);

  return {
    likes: { isLiked, count: likeCount },
    comments: { count: commentCount },
  };
});

// Function to get initial entries
async function getInitialEntries() {
  const rssKeys = await getRSSKeys();
  if (!rssKeys) return null;

  // Use Redis-cached entries
  const entries = await getMergedRSSEntries(rssKeys);
  if (!entries || entries.length === 0) return null;

  // Get initial data for ALL entries at once to avoid multiple Redis hits
  const entriesWithData = await Promise.all(
    entries.map(async (entry) => {
      const initialData = await getEntryInitialData(entry.guid);
      return {
        entry,
        initialData: initialData || {
          likes: { isLiked: false, count: 0 },
          comments: { count: 0 },
        },
      };
    })
  );

  return {
    entries: entriesWithData,
    totalEntries: entries.length,
  };
}

// Async component to fetch and display entries
async function EntriesList() {
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

export default async function RSSEntriesDisplay() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading your feeds...</div>}>
      <EntriesList />
    </Suspense>
  );
}