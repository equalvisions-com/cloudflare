import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Suspense } from "react";
import { cache } from "react";
import { RSSFeedClient } from "./RSSFeedClient";
import { getRSSEntries } from "@/lib/redis";

// Function to get initial data for an entry
const getEntryInitialData = cache(async (entryGuid: string) => {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return {
      likes: { isLiked: false, count: 0 },
      comments: { count: 0 },
    };
  }

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

interface RSSFeedProps {
  postTitle: string;
  feedUrl: string;
}

// Function to get initial entries
async function getInitialEntries(postTitle: string, feedUrl: string) {
  // Use Redis-cached entries
  const entries = await getRSSEntries(postTitle, feedUrl);
  if (!entries || entries.length === 0) return null;

  // Get initial data for ALL entries
  const entriesWithData = await Promise.all(
    entries.map(async (entry) => {
      const initialData = await getEntryInitialData(entry.guid);
      return {
        entry,
        initialData,
      };
    })
  );

  return {
    entries: entriesWithData,
    totalEntries: entries.length,
  };
}

// Async component to fetch and display entries
async function FeedContent({ postTitle, feedUrl }: RSSFeedProps) {
  const initialData = await getInitialEntries(postTitle, feedUrl);
  
  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in this feed.
      </div>
    );
  }

  return (
    <RSSFeedClient
      postTitle={postTitle}
      feedUrl={feedUrl}
      initialData={initialData}
      pageSize={10}
    />
  );
}

export default async function RSSFeed({ postTitle, feedUrl }: RSSFeedProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading feed entries...</div>}>
      <FeedContent postTitle={postTitle} feedUrl={feedUrl} />
    </Suspense>
  );
}