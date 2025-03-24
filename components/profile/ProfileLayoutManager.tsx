import { ReactNode } from "react";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";

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
    <div className="flex flex-col gap-6">
      <SidebarSearch />
      <TrendingWidget />
      
      {/* Legal Widget */}
      <LegalWidget />
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
        {children}
      </StandardSidebarLayout>
    </>
  );
} 