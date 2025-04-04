"use client";

import React, { createContext, useContext, useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";

interface SidebarContextType {
  isAuthenticated: boolean;
  username: string;
  displayName: string;
  isBoarded: boolean;
  profileImage?: string;
  userId?: Id<"users"> | null;
  pendingFriendRequestCount: number;
}

const SidebarContext = createContext<SidebarContextType>({
  isAuthenticated: false,
  username: "Guest",
  displayName: "Guest",
  isBoarded: false,
  profileImage: undefined,
  userId: null,
  pendingFriendRequestCount: 0
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({
  children,
  isAuthenticated,
  username = "Guest",
  displayName = "Guest",
  isBoarded = false,
  profileImage,
  userId,
  pendingFriendRequestCount = 0
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  username?: string;
  displayName?: string;
  isBoarded?: boolean;
  profileImage?: string;
  userId?: Id<"users"> | null;
  pendingFriendRequestCount?: number;
}) {
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ 
      isAuthenticated, 
      username, 
      displayName, 
      isBoarded, 
      profileImage,
      userId,
      pendingFriendRequestCount
    }),
    [isAuthenticated, username, displayName, isBoarded, profileImage, userId, pendingFriendRequestCount]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 