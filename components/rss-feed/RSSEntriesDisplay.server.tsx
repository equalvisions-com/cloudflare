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

export default async function RSSEntriesDisplay() {
  const token = await convexAuthNextjsToken();
  
  // Redirect to login if not authenticated 
  if (!token) {
    redirect("/signin");
  }

  // Get RSS keys from Convex 
  const rssKeys = await fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });

  if (!rssKeys || rssKeys.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No RSS feeds found. Add some feeds to get started.
      </div>
    );
  }

  // Fetch and merge entries from Redis
  const entries = await getMergedRSSEntries(rssKeys);

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in your RSS feeds.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {entries.map((entry) => (
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
                        <LikeButtonServer
                          entryGuid={entry.guid}
                          feedUrl={entry.feedUrl}
                          title={entry.title}
                          pubDate={entry.pubDate}
                          link={entry.link}
                        />
                        <CommentSectionServer
                          entryGuid={entry.guid}
                          feedUrl={entry.feedUrl}
                        />
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
      ))}
    </div>
  );
}