"use client";

import { useEffect } from "react";
import { useNotification } from "@/components/ui/notification-context";
import { usePathname } from "next/navigation";

export default function ResetNotificationCounter() {
  const { setNotificationCount } = useNotification();
  const pathname = usePathname();

  // Reset notification count when on the notifications page
  useEffect(() => {
    if (pathname === "/notifications") {
      setNotificationCount(0);
    }
  }, [pathname, setNotificationCount]);

  // This component doesn't render anything
  return null;
} 