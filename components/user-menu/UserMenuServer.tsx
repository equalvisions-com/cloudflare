import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Suspense } from "react";
import { UserMenuClient } from "./UserMenuClient";

// Utility function to fetch the user profile
export async function getUserProfile() {
  let displayName = "Guest";
  let isAuthenticated = false;
  let isBoarded = false;
  let profileImage = "";

  try {
    const token = await convexAuthNextjsToken();
    isAuthenticated = !!token;
    if (token) {
      const profile = await fetchQuery(api.users.getProfile, {}, { token });
      if (profile) {
        displayName = profile.username;
        isBoarded = profile.isBoarded ?? false;
        profileImage = profile.profileImage ?? "";
      }
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
  }

  return { displayName, isAuthenticated, isBoarded, profileImage };
}

export async function UserMenuServer() {
  const { displayName, isBoarded, profileImage } = await getUserProfile();

  return (
    <Suspense fallback={<UserMenuFallback />}>
      <UserMenuClientWrapper displayName={displayName} isBoarded={isBoarded} profileImage={profileImage} />
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
function UserMenuClientWrapper({ displayName, isBoarded, profileImage }: { displayName: string; isBoarded: boolean; profileImage: string }) {
  return <UserMenuClient initialDisplayName={displayName} isBoarded={isBoarded} profileImage={profileImage} />;
}