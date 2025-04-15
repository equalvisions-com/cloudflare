import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { getInitialEntries as getFeaturedEntries } from "@/components/featured/FeaturedFeed";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { FeedTabsContainerClientWrapper } from "@/components/rss-feed/FeedTabsContainerClientWrapper";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";

/**
 * Server component that manages the overall layout for the homepage
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export async function LayoutManager() {
  // Pre-fetch initial data in parallel for better performance
  const [rssData, featuredData] = await Promise.all([
    getInitialEntries(),
    getFeaturedEntries()
  ]);
  
  // Prepare the feed content - no need to pass user profile props
  // as they're available from the context provider
  const mainContent = (
    <FeedTabsContainerClientWrapper
      initialData={rssData}
      featuredData={featuredData}
      pageSize={30}
    />
  );
  
  // Prepare the right sidebar
  const rightSidebar = <RightSidebar />;
  
  // Use the standardized layout with mobile header, matching post page layout style
  return (
    <>
      <StandardSidebarLayout
        rightSidebar={rightSidebar}
        useCardStyle={false}
        containerClass="w-full max-w-full container gap-0 flex flex-col md:flex-row min-h-screen md:gap-6 p-0 md:px-0"
      >
        {mainContent}
      </StandardSidebarLayout>
    </>
  );
}