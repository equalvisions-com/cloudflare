"use client";

import React, { createContext, useContext, useMemo } from "react";

interface SidebarContextType {
  isAuthenticated: boolean;
  username: string;
  profileImage?: string;
}

const SidebarContext = createContext<SidebarContextType>({
  isAuthenticated: false,
  username: "Guest",
  profileImage: "",
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({
  children,
  isAuthenticated,
  username = "Guest",
  profileImage = "",
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  username?: string;
  profileImage?: string;
}) {
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ isAuthenticated, username, profileImage }),
    [isAuthenticated, username, profileImage]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 