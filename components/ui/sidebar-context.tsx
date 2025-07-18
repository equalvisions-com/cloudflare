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
  // ✅ REACT BEST PRACTICE: Read auth hints synchronously during initial render
  // This follows React's purity rules by avoiding side effects in useEffect
  // and eliminates the post-render state update that caused unnecessary re-renders
  const authHints = useMemo(() => {
    if (typeof window === 'undefined') {
      return { isAuthenticated: undefined, isOnboarded: undefined };
    }
    
    const isAuthenticatedHint = document.documentElement.getAttribute('data-user-authenticated') === '1';
    const isOnboardedHint = document.documentElement.getAttribute('data-user-onboarded') === '1';
    
    return {
      isAuthenticated: isAuthenticatedHint,
      isOnboarded: isOnboardedHint
    };
  }, []); // Empty dependency array - hints are static after initial render
  
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

  // ✅ STABILIZED CONTEXT: Only change when actual user data changes, not auth mechanisms
  // This prevents remounting during auth refresh while maintaining reactivity
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
    // CRITICAL FIX: Remove authData and isLoading from dependencies to prevent remounts during auth refresh
    // Only include the actual computed values that should trigger context updates
    [
      effectiveIsAuthenticated, 
      effectiveIsOnboarded, 
      viewer?.username,
      viewer?.name, 
      viewer?.profileImage,
      viewer?._id,
      pendingFriendRequestCount,
      authHints.isAuthenticated
    ]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 