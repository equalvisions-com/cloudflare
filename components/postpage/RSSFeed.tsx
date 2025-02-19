import { getRSSEntries } from "@/lib/redis";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { decode } from 'html-entities';
import Image from 'next/image';
import { memo, Suspense } from 'react';
import { LikeButtonServer } from "@/components/like-button/LikeButtonServer";
import { CommentSectionServer } from "@/components/comment-section/CommentSectionServer";

interface RSSFeedProps {
  postTitle: string;
  feedUrl: string;
}

// Memoized date formatter for better performance
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const hoursDifference = differenceInHours(now, date);

  if (hoursDifference < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return format(date, 'MMM d, yyyy h:mm a');
};

// Memoized RSS entry component
const RSSEntry = memo(({ 
  title, 
  description, 
  link, 
  pubDate, 
  image,
  guid,
  feedUrl
}: { 
  title: string; 
  description?: string; 
  link: string; 
  pubDate: string;
  image?: string;
  guid: string;
  feedUrl: string;
}) => (
  <div className="group">
    <article className="group-hover:bg-muted/50 rounded-lg transition-colors" data-entry-id={guid}>
      <div className="p-4">
        <div className="flex gap-4">
          {image && (
            <div className="flex-shrink-0 w-24 h-24 relative rounded-md overflow-hidden">
              <Image
                src={image}
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
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="block flex-grow"
              >
                <h3 className="text-lg font-medium group-hover:text-primary transition-colors">
                  {decode(title)}
                </h3>
              </a>
            </div>
            {description && (
              <p className="text-muted-foreground line-clamp-2">
                {decode(description)}
              </p>
            )}
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Suspense>
                    <LikeButtonServer
                      entryGuid={guid}
                      feedUrl={feedUrl}
                      title={title}
                      pubDate={pubDate}
                      link={link}
                    />
                  </Suspense>
                  <Suspense>
                    <CommentSectionServer
                      entryGuid={guid}
                      feedUrl={feedUrl}
                    />
                  </Suspense>
                </div>
                <time 
                  dateTime={pubDate}
                  title={format(new Date(pubDate), 'PPP p')}
                >
                  {formatDate(pubDate)}
                </time>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id={`comments-${guid}`} className="border-t border-muted" />
    </article>
  </div>
));

RSSEntry.displayName = 'RSSEntry';

// Separate async entries fetcher
async function RSSEntriesFetcher({ postTitle, feedUrl }: RSSFeedProps) {
  const entries = await getRSSEntries(postTitle, feedUrl);
  
  if (!entries?.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {entries.map((entry) => (
        <RSSEntry
          key={entry.guid}
          guid={entry.guid}
          title={entry.title}
          description={entry.description}
          link={entry.link}
          pubDate={entry.pubDate}
          image={entry.image}
          feedUrl={entry.feedUrl}
        />
      ))}
    </div>
  );
}

export async function RSSFeed({ postTitle, feedUrl }: RSSFeedProps) {
  return (
    <section className="mt-12 border-t pt-4">
      <Suspense fallback={<div>Loading RSS feed...</div>}>
        <RSSEntriesFetcher postTitle={postTitle} feedUrl={feedUrl} />
      </Suspense>
    </section>
  );
} 