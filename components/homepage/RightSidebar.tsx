import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidget } from "@/components/widgets/NotificationsWidget";
import { NotificationsWidgetSkeleton } from "@/components/widgets/NotificationsWidgetSkeleton";
import { Suspense } from "react";

interface RightSidebarProps {
  className?: string;
}

export function RightSidebar({ className = "" }: RightSidebarProps) {
  return (
    <div className="sticky top-6">
      <div className="flex flex-col gap-6">
        {/* Search Component */}
        <SidebarSearch />
        
        {/* Notifications Widget */}
        <Suspense fallback={<NotificationsWidgetSkeleton />}>
          <NotificationsWidget />
        </Suspense>
        
        {/* Trending Widget */}
        <Suspense fallback={<TrendingWidgetSkeleton />}>
          <TrendingWidget />
        </Suspense>
        
        {/* Featured Posts Widget */}
        <Suspense fallback={<FeaturedPostsWidgetSkeleton />}>
          <FeaturedPostsWidget />
        </Suspense>
        
        {/* Legal Widget */}
        <LegalWidget />
      </div>
    </div>
  );
}