import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { WidgetDataProvider } from "@/components/ui/WidgetDataProvider";
import { Suspense } from "react";

interface RightSidebarProps {
  className?: string;
  showSearch?: boolean;
}

export function RightSidebar({ className = "", showSearch = true }: RightSidebarProps) {
  return (
    <div className="sticky top-6">
      <div className="flex flex-col gap-6">
        {/* Search Component */}
        {showSearch && <SidebarSearch />}
        
        {/* Notifications Widget */}
        <NotificationsWidgetServer />
        
        {/* Widget Data Provider - eliminates duplicate queries between TrendingWidget and FeaturedPostsWidget */}
        <WidgetDataProvider>
          {/* Trending Widget */}
          <Suspense fallback={<TrendingWidgetSkeleton />}>
            <TrendingWidget />
          </Suspense>
          
          {/* Featured Posts Widget */}
          <Suspense fallback={<FeaturedPostsWidgetSkeleton />}>
            <FeaturedPostsWidget />
          </Suspense>
        </WidgetDataProvider>
        
        {/* Legal Widget */}
        <LegalWidget />
      </div>
    </div>
  );
}