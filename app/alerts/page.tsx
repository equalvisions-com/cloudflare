import { Metadata } from "next";
import { StandardSidebarLayout } from '@/components/ui/StandardSidebarLayout';
import { Suspense } from 'react';
import { SidebarSearch } from '@/components/search/SidebarSearch';
import { NotificationsWidgetServer } from '@/components/widgets/NotificationsWidgetServer';
import { TrendingWidget } from '@/components/trending/TrendingWidget';
import { TrendingWidgetSkeleton } from '@/components/trending/TrendingWidgetSkeleton';
import { FeaturedPostsWidget } from '@/components/widgets/FeaturedPostsWidget';
import { FeaturedPostsWidgetSkeleton } from '@/components/widgets/FeaturedPostsWidgetSkeleton';
import { LegalWidget } from '@/components/widgets/LegalWidget';
import { LAYOUT_CONSTANTS } from '@/lib/layout-constants';
import NotificationsClientWrapper from './NotificationsClientWrapper';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/* ----------  a. Page-level metadata ---------- */
export async function generateMetadata(): Promise<Metadata> {
  // Only what humans need to see in the tab title
  return {
    title: 'Notifications – FocusFix',
    description: 'View your friend requests, alerts and other notifications.',
    robots: {
      index: false,
      follow: false,          // nofollow is fine because no public links here
      googleBot: { index: false, follow: false }
    }
  };
}

export default function NotificationsPage() {
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
     <NotificationsClientWrapper />
    </StandardSidebarLayout>
  );
}
