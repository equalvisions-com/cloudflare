import { Suspense } from "react";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { ProfileSettingsPage } from "@/components/settings/ProfileSettingsPage";

export const metadata = {
  title: "Settings - Your Account",
  description: "Manage your account settings and preferences"
};

export default function SettingsPage() {
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
      containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
    >
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <ProfileSettingsPage />
      </div>
    </StandardSidebarLayout>
  );
} 