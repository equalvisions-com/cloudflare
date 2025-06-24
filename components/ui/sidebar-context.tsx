"use client";

import React, { createContext, useContext, useMemo, useEffect, useState } from "react";
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
  // ✅ INSTANT AUTH HINTS: Get immediate hints from server-side middleware headers
  const [authHints, setAuthHints] = useState<{
    isAuthenticated?: boolean;
    isOnboarded?: boolean;
  }>({});
  
  useEffect(() => {
    // ✅ SIMPLE: Get auth hints from HTML data attributes (set by server-side layout)
    if (typeof window !== 'undefined') {
      const isAuthenticatedHint = document.documentElement.getAttribute('data-user-authenticated') === '1';
      const isOnboardedHint = document.documentElement.getAttribute('data-user-onboarded') === '1';
      
      setAuthHints({
        isAuthenticated: isAuthenticatedHint,
        isOnboarded: isOnboardedHint
      });
    }
  }, []);
  
  // ✅ Convex reactive queries (only when we need real data)
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  // ✅ CONDITIONAL QUERY: Only query when authenticated (eliminates unnecessary queries for guests)
  const authData = useQuery(
    api.users.getAuthUserWithNotifications, 
    isAuthenticated ? {} : "skip"
  );
  
  // ✅ Extract data from combined query result
  const viewer = authData?.user || null;
  const pendingFriendRequestCount = authData?.pendingFriendRequestCount || 0;

  // ✅ FLASH-FREE STATE: Use hints until real data loads, then switch to real data
  // Note: Hints follow middleware logic - authenticated users without onboarding cookies
  // are redirected to /onboarding, so hints only show authenticated nav for fully onboarded users
  const effectiveIsAuthenticated = authHints.isAuthenticated !== undefined 
    ? (isLoading ? authHints.isAuthenticated : isAuthenticated)
    : isAuthenticated;
    
  const effectiveIsOnboarded = authHints.isOnboarded !== undefined
    ? (isLoading || !authData ? authHints.isOnboarded : (viewer?.isBoarded ?? false))
    : (viewer?.isBoarded ?? false);

  // ✅ Derive all state with zero loading flashes
  const contextValue = useMemo(
    () => ({ 
      isAuthenticated: effectiveIsAuthenticated,
      username: viewer?.username || "",
      displayName: viewer?.name || viewer?.username || "",
      isBoarded: effectiveIsOnboarded,
      profileImage: viewer?.profileImage,
      userId: viewer?._id || null,
      pendingFriendRequestCount,
      // ✅ ZERO LOADING: Never show loading when we have hints
      isLoading: authHints.isAuthenticated === undefined && isLoading,
    }),
    [effectiveIsAuthenticated, effectiveIsOnboarded, viewer, pendingFriendRequestCount, authData, authHints, isLoading]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 