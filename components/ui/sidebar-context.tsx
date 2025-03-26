"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useNotification } from "@/components/ui/notification-context";

interface SidebarContextType {
  isAuthenticated: boolean;
  username: string;
  notificationCount: number;
}

const SidebarContext = createContext<SidebarContextType>({
  isAuthenticated: false,
  username: "Guest",
  notificationCount: 0,
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
  // Get notification count from the notification context
  const { notificationCount } = useNotification();

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ isAuthenticated, username, notificationCount }),
    [isAuthenticated, username, notificationCount]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
} 