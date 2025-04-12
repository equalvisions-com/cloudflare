'use client';

import { useState, useEffect } from 'react';
import NotificationsClient from './NotificationsClient';
import { Loader2 } from "lucide-react";
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { useSidebar } from '@/components/ui/sidebar-context';
import { BackButton } from '@/app/components/ui/back-button';
import { AddFriendButton } from '@/app/components/ui/add-friend-button';

/**
 * Header component for the notifications page
 */
const NotificationsHeader = () => {
  // Get user profile data from context
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  
  return (
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
  );
};

/**
 * A client wrapper component that ensures the NotificationsClient
 * only renders on the client side
 */
export default function NotificationsClientWrapper() {
  // Use state to control when to render the component
  const [isMounted, setIsMounted] = useState(false);
  
  // Only render the component after mounting on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Show simple loading message during server-side rendering or initial hydration
  if (!isMounted) {
    return (
      <>
        <NotificationsHeader />
        <div className="container p-4">
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </div>
      </>
    );
  }
  
  // Once mounted on the client, render the actual component with the header
  return (
    <>
      <NotificationsHeader />
        <NotificationsClient />
    </>
  );
} 