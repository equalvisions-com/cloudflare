import { Metadata } from "next";
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
import { WidgetDataProvider } from "@/components/ui/WidgetDataProvider";
import ProfileSettingsClientWrapper from "@/components/settings/ProfileSettingsClientWrapper";
import { BackButton } from '@/components/back-button';
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';

// Add the Edge Runtime configuration
export const runtime = 'edge';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

/* ----------  a. Page-level metadata ---------- */
export async function generateMetadata(): Promise<Metadata> {
  // Only what humans need to see in the tab title
  return {
    title: 'Settings – FocusFix',
    description: 'Manage your account settings and preferences.',
    robots: {
      index: false,
      follow: false,          // nofollow is fine because no public links here
      googleBot: { index: false, follow: false }
    }
  };
}

// Header component for the settings page
const SettingsHeader = () => {  
  return (
    <div className="w-full border-b py-2">
      <div className="container mx-auto flex items-center px-4">
        <div className="flex-shrink-0 mr-3 h-[36px] w-9">
          <div className="hidden md:block">
            <BackButton />
          </div>
          <div className="md:hidden">
            <UserMenuClientWithErrorBoundary />
          </div>
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-base font-extrabold tracking-tight">Settings</h1>
        </div>
        <div className="flex-shrink-0 w-9 sm:mr-0 md:mr-[-0.5rem]">
          {/* Empty div for symmetry */}
        </div>
      </div>
    </div>
  );
};

export default function SettingsPage() {
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

  return (
    <StandardSidebarLayout
      rightSidebar={rightSidebar}
      useCardStyle={true}
      containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
    >
      <div>
        <SettingsHeader />
        <div className="p-4">
          <ProfileSettingsClientWrapper />
        </div>
      </div>
    </StandardSidebarLayout>
  );
} 