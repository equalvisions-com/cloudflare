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
}

const SidebarContext = createContext<SidebarContextType>({
  isAuthenticated: false,
  username: "Guest",
  displayName: "Guest",
  isBoarded: false,
  profileImage: undefined,
  userId: null
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({
  children,
  isAuthenticated,
  username = "Guest",
  displayName = "Guest",
  isBoarded = false,
  profileImage,
  userId
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  username?: string;
  displayName?: string;
  isBoarded?: boolean;
  profileImage?: string;
  userId?: Id<"users"> | null;
}) {
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ 
      isAuthenticated, 
      username, 
      displayName, 
      isBoarded, 
      profileImage,
      userId 
    }),
    [isAuthenticated, username, displayName, isBoarded, profileImage, userId]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 