import { Metadata } from 'next';
import { ChatPage } from '../../components/chat/ChatPage';
import { StandardSidebarLayout } from '@/components/ui/StandardSidebarLayout';
import { LAYOUT_CONSTANTS } from '@/lib/layout-constants';
import { NotificationsWidgetServer } from '@/components/widgets/NotificationsWidgetServer';
import { SidebarSearch } from '@/components/search/SidebarSearch';
import { TrendingWidget } from '@/components/trending/TrendingWidget';
import { TrendingWidgetSkeleton } from '@/components/trending/TrendingWidgetSkeleton';
import { FeaturedPostsWidget } from '@/components/widgets/FeaturedPostsWidget';
import { FeaturedPostsWidgetSkeleton } from '@/components/widgets/FeaturedPostsWidgetSkeleton';
import { LegalWidget } from '@/components/widgets/LegalWidget';
import { Suspense } from 'react';

// Add the Edge Runtime configuration at the top of the file
export const runtime = 'edge';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with our AI assistant',
};

export default function Page() {
  return (
    <div className="fixed inset-0 md:static md:inset-auto w-full">
      <StandardSidebarLayout
        rightSidebar={
          <div className="sticky top-6">
            <div className="flex flex-col gap-6">
              {/* Search Component */}
              <SidebarSearch />
              
              {/* Notifications Widget */}
              <NotificationsWidgetServer />
              
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
        }
        containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
        mainContentClass={LAYOUT_CONSTANTS.MAIN_CONTENT_CLASS}
        rightSidebarClass={LAYOUT_CONSTANTS.RIGHT_SIDEBAR_CLASS}
      >
        <ChatPage />
      </StandardSidebarLayout>
    </div>
  );
}
