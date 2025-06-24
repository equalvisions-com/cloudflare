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

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // ✅ Single source of truth: Convex reactive queries
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  // ✅ ULTRA OPTIMIZED: Single combined query for user data + friend requests
  // Reduced from 3 separate queries to just 2 parallel database operations:
  // 1. User data lookup (primary key)  
  // 2. Friend requests count (single index query with OR filter)
  // Now perfectly synchronized with UserMenuClient using identical optimized query
  const authData = useQuery(
    api.users.getAuthUserWithNotifications, 
    isAuthenticated ? {} : "skip"
  );
  
  // ✅ Extract data from combined query result
  const viewer = authData?.user || null;
  const pendingFriendRequestCount = authData?.pendingFriendRequestCount || 0;

  // ✅ Derive all state from combined query with improved loading detection
  const contextValue = useMemo(
    () => ({ 
      isAuthenticated,
      username: viewer?.username || "",
      displayName: viewer?.name || viewer?.username || "",
      isBoarded: viewer?.isBoarded ?? false,
      profileImage: viewer?.profileImage,
      userId: viewer?._id || null,
      pendingFriendRequestCount,
      // ✅ Better loading state: Consider both auth loading and data loading
      isLoading: isLoading || (isAuthenticated && authData === undefined),
    }),
    [isAuthenticated, isLoading, viewer, pendingFriendRequestCount, authData]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 