// components/rss/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { LikeButtonServer } from "@/components/like-button/LikeButtonServer";
import { CommentSectionServer } from "@/components/comment-section/CommentSectionServer";
import { decode } from 'html-entities';
import { getMergedRSSEntries } from "@/lib/redis";
import { Suspense } from "react";
import { cache } from "react";
import type { RSSItem } from "@/lib/redis";
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

// Memoized RSS entry component
const RSSEntry = ({ entry }: { entry: RSSItem }) => (
  <Card key={entry.guid} className="overflow-hidden">
    <div className="group-hover:bg-muted/50 rounded-lg transition-colors group">
      <article className="p-4">
        <div className="flex gap-4">
          {entry.image && (
            <div className="flex-shrink-0 w-24 h-24 relative rounded-md overflow-hidden">
              <Image
                src={entry.image}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-grow min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <a
                href={entry.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block flex-grow"
              >
                <h3 className="text-lg font-medium group-hover:text-primary transition-colors">
                  {decode(entry.title)}
                </h3>
              </a>
            </div>
            {entry.description && (
              <p className="text-muted-foreground line-clamp-2">
                {decode(entry.description)}
              </p>
            )}
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Suspense>
                    <LikeButtonServer
                      entryGuid={entry.guid}
                      feedUrl={entry.feedUrl}
                      title={entry.title}
                      pubDate={entry.pubDate}
                      link={entry.link}
                    />
                  </Suspense>
                  <Suspense>
                    <CommentSectionServer
                      entryGuid={entry.guid}
                      feedUrl={entry.feedUrl}
                    />
                  </Suspense>
                </div>
                <time 
                  dateTime={entry.pubDate}
                  title={format(new Date(entry.pubDate), 'PPP p')}
                >
                  {formatDistanceToNow(new Date(entry.pubDate), { addSuffix: true })}
                </time>
              </div>
            </div>
          </div>
        </div>
      </article>
      <div id={`comments-${entry.guid}`} className="border-t border-muted" />
    </div>
  </Card>
);

// Function to get initial entries
async function getInitialEntries() {
  const rssKeys = await getRSSKeys();
  if (!rssKeys) return null;

  // Use Redis-cached entries
  const entries = await getMergedRSSEntries(rssKeys);
  if (!entries || entries.length === 0) return null;

  const pageSize = 10;
  const initialEntries = entries.slice(0, pageSize);

  // Get initial data for each entry
  const entriesWithData = await Promise.all(
    initialEntries.map(async (entry) => {
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
    hasMore: entries.length > pageSize,
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