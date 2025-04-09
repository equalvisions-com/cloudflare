import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { Suspense } from "react";
import { BookmarksHeader } from "./BookmarksHeader";
import { BookmarksContentWrapper } from "./BookmarksContentWrapper";

export const metadata = {
  title: "Your Bookmarks | Grasper",
  description: "View all your saved bookmarks in one place",
};

/**
 * Server component for the bookmarks page
 */
export default async function BookmarksPage() {
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
      <BookmarksHeader />

      {/* BookmarksContentWrapper will get userId from context */}
     <div className="sm:pb-[119px] md:pb-[56px]"><BookmarksContentWrapper /></div>
    </StandardSidebarLayout>
  );
}
