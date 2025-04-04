import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Suspense } from "react";
import { UserMenuClient } from "./UserMenuClient";
import { Id } from "@/convex/_generated/dataModel";

// Utility function to fetch the user profile
export async function getUserProfile() {
  let displayName = "Guest";
  let isAuthenticated = false;
  let isBoarded = false;
  let userId: Id<"users"> | null = null;
  let profileImage: string | undefined = undefined;
  let pendingFriendRequestCount = 0;

  try {
    const token = await convexAuthNextjsToken();
    isAuthenticated = !!token;
    if (token) {
      const profile = await fetchQuery(api.users.getProfile, {}, { token });
      if (profile) {
        displayName = profile.username;
        isBoarded = profile.isBoarded ?? false;
        userId = profile.userId;
        profileImage = profile.profileImage;

        // Fetch pending friend request count if authenticated
        try {
          pendingFriendRequestCount = await fetchQuery(api.friends.getMyPendingFriendRequestCount, {}, { token });
        } catch (countError) {
          console.error("Error fetching pending friend requests:", countError);
          // Continue with default count of 0
        }
      }
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
  }

  return { displayName, isAuthenticated, isBoarded, userId, profileImage, pendingFriendRequestCount };
}

export async function UserMenuServer() {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = await getUserProfile();

  return (
    <Suspense fallback={<UserMenuFallback />}>
      <UserMenuClientWrapper 
        displayName={displayName} 
        isBoarded={isBoarded} 
        profileImage={profileImage}
        pendingFriendRequestCount={pendingFriendRequestCount}
      />
    </Suspense>
  );
}

// Fallback UI for Suspense during data fetching
function UserMenuFallback() {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      Guest
    </div>
  );
}

// Wrapper to pass the initial display name to the client component
function UserMenuClientWrapper({ 
  displayName, 
  isBoarded, 
  profileImage,
  pendingFriendRequestCount
}: { 
  displayName: string; 
  isBoarded: boolean;
  profileImage?: string;
  pendingFriendRequestCount?: number;
}) {
  return <UserMenuClient 
    initialDisplayName={displayName} 
    isBoarded={isBoarded} 
    initialProfileImage={profileImage}
    pendingFriendRequestCount={pendingFriendRequestCount}
  />;
}