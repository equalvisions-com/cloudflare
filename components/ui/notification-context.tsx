"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

interface NotificationContextType {
  notificationCount: number;
  setNotificationCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notificationCount: 0,
  setNotificationCount: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notificationCount, setNotificationCount] = useState(0);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ notificationCount, setNotificationCount }),
    [notificationCount]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
} 