import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSFeedClient } from "./RSSFeedClient";
import { getRSSEntries } from "@/lib/redis";

function EntryCount({ count }: { count: number }) {
  return (
    <div className="max-w-4xl mx-auto px-4 mb-4 text-sm text-muted-foreground">
      {count} entries in feed
    </div>
  );
}

interface RSSFeedProps {
  postTitle: string;
  feedUrl: string;
}

// Function to get initial entries with batch data fetching
const getInitialEntries = cache(async (postTitle: string, feedUrl: string) => {
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
    totalEntries: entries.length,
  };
});

export default async function RSSFeed({ postTitle, feedUrl }: RSSFeedProps) {
  const initialData = await getInitialEntries(postTitle, feedUrl);
  
  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in this feed.
      </div>
    );
  }

  return (
    <>
      <EntryCount count={initialData.totalEntries} />
      <RSSFeedClient
        postTitle={postTitle}
        feedUrl={feedUrl}
        initialData={initialData}
        pageSize={10}
      />
    </>
  );
}