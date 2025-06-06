'use client';

import { Suspense, memo } from 'react';
import NotificationsClient from './NotificationsClient';
import { Loader2 } from "lucide-react";
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { useSidebar } from '@/components/ui/sidebar-context';
import { BackButton } from '@/components/back-button';
import { AddFriendButton } from '@/components/add-friend-button';
import { ErrorBoundary } from '@/components/ui/error-boundary';

/**
 * Header component for the notifications page - memoized for performance
 */
const NotificationsHeader = memo(() => {
  // Get user profile data from context
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  
  return (
    <ErrorBoundary>
      <div className="w-full border-b py-2">
        <div className="container mx-auto flex items-center px-4">
          <div className="flex-shrink-0 mr-3 h-[36px] w-9">
            <div className="hidden md:block">
              <BackButton />
            </div>
            <div className="md:hidden">
              <UserMenuClientWithErrorBoundary 
                initialDisplayName={displayName}
                initialProfileImage={profileImage}
                isBoarded={isBoarded}
                pendingFriendRequestCount={pendingFriendRequestCount}
              />
            </div>
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-base font-extrabold tracking-tight">Alerts</h1>
          </div>
          <div className="flex-shrink-0 w-9 sm:mr-0 md:mr-[-0.5rem]">
            <AddFriendButton />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
});

NotificationsHeader.displayName = 'NotificationsHeader';

/**
 * Loading fallback component for notifications - memoized for performance
 */
const NotificationsLoading = memo(() => (
  <div className="container p-4">
    <div className="flex items-center justify-center p-10">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  </div>
));

NotificationsLoading.displayName = 'NotificationsLoading';

/**
 * Client wrapper component that properly handles client-side rendering
 * without hydration mismatches - optimized for production
 */
export default function NotificationsClientWrapper() {
  return (
    <>
      <NotificationsHeader />
      <Suspense fallback={<NotificationsLoading />}>
        <NotificationsClient />
      </Suspense>
    </>
  );
} 