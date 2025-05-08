import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Suspense } from "react";
import dynamic from 'next/dynamic';
import { Id } from "@/convex/_generated/dataModel";
import { cookies } from "next/headers";

// Define the prop types that our dynamic component will accept
interface UserMenuClientProps {
  displayName: string;
  username: string;
  isBoarded: boolean;
  profileImage?: string;
  pendingFriendRequestCount?: number;
}

// Import the client component dynamically to isolate edge runtime issues
// Force TypeScript to recognize it has the right props
const UserMenuClient = dynamic<UserMenuClientProps>(() => import('./UserMenuClientWrapper'), {
  ssr: false
});

// Utility function to fetch the user profile
export async function getUserProfile() {
  let displayName = "Guest";
  let username = "Guest";
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
        username = profile.username || "Guest";
        displayName = profile.name || profile.username || "Guest";
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

  return { displayName, username, isAuthenticated, isBoarded, userId, profileImage, pendingFriendRequestCount };
}

export async function UserMenuServer() {
  const { displayName, username, isBoarded, profileImage, pendingFriendRequestCount } = await getUserProfile();

  return (
    <Suspense fallback={<UserMenuFallback />}>
      <UserMenuClient 
        displayName={displayName}
        username={username}
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