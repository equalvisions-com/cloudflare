import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { getInitialEntries as getFeaturedEntries } from "@/components/featured/FeaturedFeed";
import { LayoutManagerClientWithErrorBoundary } from "./LayoutManagerClient";

export async function LayoutManager() {
  // Pre-fetch initial data in parallel for better performance
  const [rssData, featuredData] = await Promise.all([
    getInitialEntries(),
    getFeaturedEntries()
  ]);
  
  return (
    <LayoutManagerClientWithErrorBoundary 
      initialData={rssData} 
      featuredData={featuredData}
    />
  );
}