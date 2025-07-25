import { Id } from "@/convex/_generated/dataModel";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { WidgetDataProvider } from "@/components/ui/WidgetDataProvider";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { Suspense } from "react";
import type { PostLayoutManagerProps } from "@/lib/types";

type Post = {
  _id: Id<"posts">;
  title: string;
  category: string;
  body: string;
  featuredImg?: string;
  feedUrl: string;
  categorySlug: string;
};

/**
 * Server component that manages the layout for individual post pages
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export const PostLayoutManager = ({ 
  children,
  post,
  className = ""
}: PostLayoutManagerProps) => {
  // Prepare sidebar content on the server
  const rightSidebar = (
    <div className="sticky top-6">
      <div className="flex flex-col gap-6">
        <SidebarSearch />
        
        {/* Notifications Widget */}
        <NotificationsWidgetServer />
        
        {/* Widget Data Provider - eliminates duplicate queries between TrendingWidget and FeaturedPostsWidget */}
        <WidgetDataProvider>
          <Suspense fallback={<TrendingWidgetSkeleton />}>
            <TrendingWidget />
          </Suspense>
          <Suspense fallback={<FeaturedPostsWidgetSkeleton />}>
            <FeaturedPostsWidget />
          </Suspense>
        </WidgetDataProvider>
        
        {/* Legal Widget */}
        <LegalWidget />
      </div>
    </div>
  );

  // Use the standardized layout with card styling for post content
  return (
    <StandardSidebarLayout
      rightSidebar={rightSidebar}
      useCardStyle={true}
      // Ensure we have the flex layout classes
      containerClass={`container gap-0 flex flex-col md:flex-row min-h-screen md:gap-6 p-0 md:px-0 ${className}`}
    >
    {children}
    </StandardSidebarLayout>
  );
}; 