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
import NotificationsClientWrapper from './NotificationsClientWrapper';

export const metadata: Metadata = {
  title: "Notifications",
  description: "View your friend requests and other notifications",
};

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
    <>
      <StandardSidebarLayout
        rightSidebar={rightSidebar}
        useCardStyle={true}
        containerClass="container gap-0 flex flex-col md:flex-row min-h-mobile-screen md:gap-6 p-0 md:px-0"
      >
        <NotificationsClientWrapper />
      </StandardSidebarLayout>
    </>
  );
}
