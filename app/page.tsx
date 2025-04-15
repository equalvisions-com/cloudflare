import { HomeLayoutManager } from "@/components/ui/HomeLayoutManager";
import { Metadata } from "next";
import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { getInitialEntries as getFeaturedEntries } from "@/components/featured/FeaturedFeed";
import { FeedTabsContainerClientWrapper } from "@/components/rss-feed/FeedTabsContainerClientWrapper";

// Add preload hints for critical resources and proper metadata
export const metadata: Metadata = {
  title: "RSS Feed Reader",
  description: "A modern RSS feed reader with real-time updates and social features",
  other: {
    // Preload critical data endpoints with proper priority
    'Link': [
      '</api/rss-keys>; rel=preload; as=fetch; crossorigin=anonymous; priority=high',
      // Only preload the first page with post metadata
      '</api/convex/batchGetEntryData>; rel=preload; as=fetch; crossorigin=anonymous',
    ].join(', '),
  },
};

export default async function HomePage() {
  // Pre-fetch initial data in parallel for better performance
  const [rssData, featuredData] = await Promise.all([
    getInitialEntries(),
    getFeaturedEntries()
  ]);
  
  return (
    <HomeLayoutManager>
      <FeedTabsContainerClientWrapper
        initialData={rssData}
        featuredData={featuredData}
        pageSize={30}
      />
    </HomeLayoutManager>
  );
}
