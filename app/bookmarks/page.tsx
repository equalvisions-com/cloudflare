import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { Suspense } from "react";
import { getUserProfile } from "@/components/user-menu/UserMenuServer";
import { BookmarksContent } from "./BookmarksContent";
import { getBookmarksData } from "@/app/actions/bookmarkActions";
import { cache } from "react";

export const metadata = {
  title: "Your Bookmarks | Grasper",
  description: "View all your saved bookmarks in one place",
};

// Cache the initial data fetching - make it a regular function, not exported
const getInitialBookmarksData = cache(async (userId: any) => {
  try {
    console.log(`📡 Fetching initial bookmarks data for user: ${userId}`);
    const startTime = Date.now();
    
    // Use the action to fetch bookmark data with details
    const data = await getBookmarksData(userId, 0, 30);
    
    console.log(`✅ Fetched initial bookmarks data in ${Date.now() - startTime}ms`);
    return data;
  } catch (error) {
    console.error("❌ Error fetching initial bookmarks data:", error);
    return {
      bookmarks: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {},
      entryMetrics: {}
    };
  }
});

/**
 * Server component for the bookmarks page
 */
export default async function BookmarksPage() {
  // Get authentication info at the server level
  const { isAuthenticated, userId } = await getUserProfile();
  
  // Fetch initial bookmarks data on the server if the user is authenticated
  const initialData = userId ? await getInitialBookmarksData(userId) : null;
  
  // Prepare sidebar content on the server
  const rightSidebar = (
    <div className="sticky top-6">
      <div className="flex flex-col gap-6">
        <SidebarSearch />
        
        {/* Notifications Widget */}
        <NotificationsWidgetServer />
        
        <Suspense fallback={<TrendingWidgetSkeleton />}>
          <TrendingWidget />
        </Suspense>
        <Suspense fallback={<FeaturedPostsWidgetSkeleton />}>
          <FeaturedPostsWidget />
        </Suspense>
        
        {/* Legal Widget */}
        <LegalWidget />
      </div>
    </div>
  );

  return (
    <StandardSidebarLayout
      rightSidebar={rightSidebar}
      useCardStyle={true}
      containerClass="container gap-0 flex flex-col md:flex-row min-h-screen md:gap-6 p-0 md:px-0"
    >
                    <div className="flex items-center justify-center h-[45px] border-b font-bold">Bookmarks</div>

      <BookmarksContent 
        isAuthenticated={isAuthenticated} 
        userId={userId} 
        initialData={initialData} 
      />
    </StandardSidebarLayout>
  );
}
