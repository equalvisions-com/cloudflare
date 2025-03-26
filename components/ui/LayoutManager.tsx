import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { getInitialEntries as getFeaturedEntries } from "@/components/featured/FeaturedFeed";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { FeedTabsContainerClientWrapper } from "@/components/rss-feed/FeedTabsContainerClientWrapper";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";
import { UserMenuServer } from "@/components/user-menu/UserMenuServer";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { FriendActivityGroup } from "@/components/friends-feed/FriendsFeedClient";

// Helper function to get Convex client
function getConvexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
}

// Get friend activity data
async function getFriendActivityData() {
  try {
    // Get Convex client
    const convex = getConvexClient();
    
    // Get the current user using Convex
    const currentUser = await convex.query(api.users.viewer);
    const userId = currentUser?._id;
    
    if (!userId) {
      console.log("No user ID found, cannot fetch friend activities");
      return null;
    }
    
    // Fetch friend activity data
    console.log("Fetching friend activities for user:", userId);
    const friendActivities = await convex.query(api.friends.getFriendActivities, {
      userId,
      skip: 0,
      limit: 30
    });
    
    console.log("Friend activities fetched:", JSON.stringify(friendActivities, null, 2));
    
    // If activities are null or empty, return null to avoid type errors
    if (!friendActivities || !friendActivities.activityGroups || friendActivities.activityGroups.length === 0) {
      console.log("No friend activities found");
      return {
        activityGroups: [],
        hasMore: false
      };
    }
    
    // Cast to expected type for the FriendsFeedClient
    return {
      activityGroups: friendActivities.activityGroups as unknown as FriendActivityGroup[],
      hasMore: friendActivities.hasMore
    };
  } catch (error) {
    console.error("Error fetching friend activity data:", error);
    // Return empty data rather than null to avoid rendering issues
    return {
      activityGroups: [],
      hasMore: false
    };
  }
}

/**
 * Server component that manages the overall layout for the homepage
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export async function LayoutManager() {
  // Pre-fetch initial data in parallel for better performance
  const [rssData, featuredData, friendsData] = await Promise.all([
    getInitialEntries(),
    getFeaturedEntries(),
    getFriendActivityData()
  ]);
  
  // Prepare the feed content
  const mainContent = (
    <FeedTabsContainerClientWrapper
      initialData={rssData}
      featuredData={featuredData}
      friendsData={friendsData}
      pageSize={30}
    />
  );
  
  // Prepare the right sidebar
  const rightSidebar = <RightSidebar />;
  
  // Use the standardized layout with mobile header
  return (
    <>
      <header className="hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <UserMenuServer />
          </div>
        </div>
      </header>
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