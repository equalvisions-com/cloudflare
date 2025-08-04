import { ReactNode } from "react";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { WidgetDataProvider } from "@/components/ui/WidgetDataProvider";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { Suspense } from "react";
import { ScrollResetter } from "@/components/ui/scroll-resetter";

interface ProfileLayoutManagerProps {
  children: ReactNode;
}

/**
 * Server component that manages the overall layout for profile pages
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export async function ProfileLayoutManager({ children }: ProfileLayoutManagerProps) {
  // Prepare the right sidebar with widgets
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
  
  // Use the standardized layout with mobile header
  return (
    <>
      <StandardSidebarLayout
        rightSidebar={rightSidebar}
        useCardStyle={true}
        containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
      >
        <ScrollResetter>{children}</ScrollResetter>
      </StandardSidebarLayout>
    </>
  );
} 