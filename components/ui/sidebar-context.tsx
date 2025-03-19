"use client";

import React, { createContext, useContext, useMemo } from "react";

interface SidebarContextType {
  isAuthenticated: boolean;
  username: string;
}

const SidebarContext = createContext<SidebarContextType>({
  isAuthenticated: false,
  username: "Guest",
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({
  children,
  isAuthenticated,
  username = "Guest",
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  username?: string;
}) {
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ isAuthenticated, username }),
    [isAuthenticated, username]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 