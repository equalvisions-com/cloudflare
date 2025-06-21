"use client";

import { UserMenuClient } from "./UserMenuClient";
import type { UserMenuClientWrapperProps } from "@/lib/types";

/**
 * This wrapper isolates the client component from the server component
 * and applies the necessary polyfills for Edge Runtime compatibility
 */
export default function UserMenuClientWrapper({ 
  displayName,
  username,
  isBoarded, 
  profileImage,
  pendingFriendRequestCount
}: UserMenuClientWrapperProps) {
  return (
    <UserMenuClient 
      initialDisplayName={displayName}
      initialUsername={username}
      isBoarded={isBoarded} 
      initialProfileImage={profileImage}
      pendingFriendRequestCount={pendingFriendRequestCount}
    />
  );
} 