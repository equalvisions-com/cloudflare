import { ReactNode } from "react";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";
import { UserMenuServer } from "@/components/user-menu/UserMenuServer";

interface ProfileLayoutManagerProps {
  children: ReactNode;
}

/**
 * Server component that manages the overall layout for profile pages
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export async function ProfileLayoutManager({ children }: ProfileLayoutManagerProps) {
  // Prepare the right sidebar with placeholder content
  const rightSidebar = (
    <div className="p-4 rounded-lg">
      <div className="h-8 w-full bg-gray-100 dark:bg-gray-800 rounded mb-4"></div>
      <div className="h-24 w-full bg-gray-100 dark:bg-gray-800 rounded mb-4"></div>
      <div className="h-40 w-full bg-gray-100 dark:bg-gray-800 rounded"></div>
    </div>
  );
  
  // Use the standardized layout with mobile header
  return (
    <>
      <header className="md:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <UserMenuServer />
          </div>
        </div>
      </header>
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