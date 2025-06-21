"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { Id } from "@/convex/_generated/dataModel";
import type { SidebarContextType, SidebarProviderProps } from "@/lib/types";

const SidebarContext = createContext<SidebarContextType>({
  isAuthenticated: false,
  username: "Guest",
  displayName: "Guest",
  isBoarded: false,
  profileImage: undefined,
  userId: null,
  pendingFriendRequestCount: 0,
  updatePendingFriendRequestCount: () => {}
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
}: SidebarProviderProps) {
  // State to keep track of the count that can be updated
  const [requestCount, setRequestCount] = useState(pendingFriendRequestCount);
  
  // Function to update the count
  const updatePendingFriendRequestCount = useCallback((newCount: number) => {
    setRequestCount(newCount);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ 
      isAuthenticated, 
      username, 
      displayName, 
      isBoarded, 
      profileImage,
      userId,
      pendingFriendRequestCount: requestCount,
      updatePendingFriendRequestCount
    }),
    [isAuthenticated, username, displayName, isBoarded, profileImage, userId, requestCount, updatePendingFriendRequestCount]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 