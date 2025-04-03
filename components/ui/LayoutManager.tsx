import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { getInitialEntries as getFeaturedEntries } from "@/components/featured/FeaturedFeed";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { FeedTabsContainerClientWrapper } from "@/components/rss-feed/FeedTabsContainerClientWrapper";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";
import { getUserProfile } from "@/components/user-menu/UserMenuServer";

/**
 * Server component that manages the overall layout for the homepage
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export async function LayoutManager() {
  // Pre-fetch initial data in parallel for better performance
  const [rssData, featuredData, userProfile] = await Promise.all([
    getInitialEntries(),
    getFeaturedEntries(),
    getUserProfile()
  ]);
  
  const { displayName, isBoarded, profileImage, isAuthenticated } = userProfile;
  
  // Prepare the feed content
  const mainContent = (
    <FeedTabsContainerClientWrapper
      initialData={rssData}
      featuredData={featuredData}
      pageSize={30}
      displayName={displayName}
      isBoarded={isBoarded}
      profileImage={profileImage}
      isAuthenticated={isAuthenticated}
    />
  );
  
  // Prepare the right sidebar
  const rightSidebar = <RightSidebar />;
  
  // Use the standardized layout with mobile header
  return (
    <>
      <StandardSidebarLayout
        rightSidebar={rightSidebar}
        useCardStyle={false}
        containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
      >
        {mainContent}
      </StandardSidebarLayout>
    </>
  );
}