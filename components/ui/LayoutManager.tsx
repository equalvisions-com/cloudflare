import { RightSidebar } from "@/components/homepage/RightSidebar";
import { FeedTabsContainerClientWrapper } from "@/components/rss-feed/FeedTabsContainerClientWrapper";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";

/**
 * Server component that manages the overall layout for the homepage
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export async function LayoutManager() {
  // We now use a fully lazy loading approach for both tabs
  // Data will be fetched via API routes when the user views each tab
  
  // Prepare the feed content - Components are dynamically imported in FeedTabsContainer
  // with custom skeleton loaders while content is being loaded
  const mainContent = (
    <FeedTabsContainerClientWrapper
      initialData={null} // RSS data will be fetched when needed
      featuredData={null} // Featured data will be fetched when needed
      pageSize={30}
    />
  );
  
  // Prepare the right sidebar
  const rightSidebar = <RightSidebar />;
  
  // Custom class for main content to add padding at the bottom on all screen sizes
  const customMainContentClass = `${LAYOUT_CONSTANTS.MAIN_CONTENT_CLASS} sm:pb-[128px] md:pb-0`;
  
  // Use the standardized layout with mobile header
  return (
    <>
      <StandardSidebarLayout
        rightSidebar={rightSidebar}
        useCardStyle={false}
        containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
        mainContentClass={customMainContentClass}
      >
        {mainContent}
      </StandardSidebarLayout>
    </>
  );
}