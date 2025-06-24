"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface SidebarContextType {
  isAuthenticated: boolean;
  username: string;
  displayName: string;
  isBoarded: boolean;
  profileImage?: string;
  userId: Id<"users"> | null;
  pendingFriendRequestCount: number;
  isLoading: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isAuthenticated: false,
  username: "",
  displayName: "",
  isBoarded: false,
  profileImage: undefined,
  userId: null,
  pendingFriendRequestCount: 0,
  isLoading: true,
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // ✅ Single source of truth: Convex reactive queries
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  // ✅ Reactive viewer query for user data
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  
  // ✅ Reactive pending friend requests count
  const pendingFriendRequestCount = useQuery(
    api.friends.getMyPendingFriendRequestCount, 
    isAuthenticated ? {} : "skip"
  ) ?? 0;

  // ✅ Derive all state from Convex queries
  const contextValue = useMemo(
    () => ({ 
      isAuthenticated,
      username: viewer?.username || "",
      displayName: viewer?.name || viewer?.username || "",
      isBoarded: viewer?.isBoarded ?? false,
      profileImage: viewer?.profileImage,
      userId: viewer?._id || null,
      pendingFriendRequestCount,
      isLoading: isLoading || (isAuthenticated && !viewer),
    }),
    [isAuthenticated, isLoading, viewer, pendingFriendRequestCount]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 