import { Metadata } from 'next';
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { TrendingWidgetSkeleton } from "@/components/trending/TrendingWidgetSkeleton";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";
import { FeaturedPostsWidget } from "@/components/widgets/FeaturedPostsWidget";
import { FeaturedPostsWidgetSkeleton } from "@/components/widgets/FeaturedPostsWidgetSkeleton";
import { NotificationsWidgetServer } from "@/components/widgets/NotificationsWidgetServer";
import { WidgetDataProvider } from "@/components/ui/WidgetDataProvider";
import { Suspense } from "react";
import { BookmarksPageClientScope } from "./BookmarksPageClientScope";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/* ----------  a. Page-level metadata ---------- */
export async function generateMetadata(): Promise<Metadata> {
  // Only what humans need to see in the tab title
  return {
    title: 'Your Bookmarks – FocusFix',
    description: 'All the posts, newsletters and podcasts you\'ve saved in one place.',
    robots: {
      index: false,
      follow: false,          // nofollow is fine because no public links here
      googleBot: { index: false, follow: false }
    }
  };
}

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
      <Suspense>
        <BookmarksPageClientScope rightSidebar={rightSidebar} />
      </Suspense>
    </StandardSidebarLayout>
  );
}
