"use client";

import { ReactNode, memo } from "react";
import { ProfileSearchProvider } from "@/lib/contexts/ProfileSearchContext";
import { Id } from "@/convex/_generated/dataModel";
import { useSidebar } from "@/components/ui/sidebar-context";
import { ProfilePageHeader } from "@/components/profile/ProfilePageHeader";

interface ProfilePageClientScopeProps {
  children: ReactNode;
  profileUserId: Id<"users">;
  username: string;
}

/**
 * Client-side wrapper that provides ProfileSearchContext to all profile page components
 * Similar to BookmarksPageClientScope, this ensures search functionality works across
 * ProfilePageHeader and UserProfileTabs components
 */
export const ProfilePageClientScope = memo(({ 
  children, 
  profileUserId, 
  username 
}: ProfilePageClientScopeProps) => {
  // Get current user ID from sidebar context for search provider
  const { userId: currentUserId } = useSidebar();

  return (
    <ProfileSearchProvider
      userId={currentUserId}
      profileUserId={profileUserId}
      username={username}
    >
      <ProfilePageHeader />
      {children}
    </ProfileSearchProvider>
  );
});

ProfilePageClientScope.displayName = 'ProfilePageClientScope';