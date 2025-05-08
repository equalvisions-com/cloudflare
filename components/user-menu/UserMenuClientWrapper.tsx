"use client";

import { UserMenuClient } from "./UserMenuClient";
import "../../lib/edge-polyfills";

interface UserMenuClientWrapperProps {
  displayName: string;
  username: string;
  isBoarded: boolean;
  profileImage?: string;
  pendingFriendRequestCount?: number;
}

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