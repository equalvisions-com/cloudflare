import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { Suspense } from "react";

interface HomeLayoutManagerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Server component that manages the layout for the home page
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export const HomeLayoutManager = ({ 
  children,
  className = "",
}: HomeLayoutManagerProps) => {
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

  // Use the standardized layout with card styling for content
  return (
    <StandardSidebarLayout
      rightSidebar={rightSidebar}
      useCardStyle={false}
      // Ensure we have the flex layout classes
      containerClass={`container mx-auto min-h-screen flex flex-col md:flex-row gap-6 p-0 md:px-6 ${className}`}
    >
      {children}
    </StandardSidebarLayout>
  );
}; 