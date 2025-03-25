"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NotificationsWidgetProps {
  isAuthenticated?: boolean;
}

export function NotificationsWidget({ isAuthenticated = false }: NotificationsWidgetProps) {
  // Don't show anything if user is authenticated
  if (isAuthenticated) {
    return null;
  }

  // Only show welcome widget for unauthenticated users
  return (
    <div className="p-4 rounded-xl border">
      <h3 className="text-base font-extrabold flex items-center leading-none tracking-tight mb-3">Welcome to Graspr</h3>
      <p className="text-sm text-muted-foreground mb-4 tracking-tight">
        Sign up to get your own personalized feed
      </p>
      <Button asChild className="w-full rounded-full font-semibold">
        <Link href="/signin">Sign up</Link>
      </Button>
    </div>
  );
} 