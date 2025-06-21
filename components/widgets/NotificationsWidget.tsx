import Link from "next/link";
import { Button } from "@/components/ui/button";
import { memo } from "react";
import type { NotificationsWidgetProps } from "@/lib/types";

export const NotificationsWidget = memo<NotificationsWidgetProps>(({ isAuthenticated = false }) => {
  // Don't show anything if user is authenticated
  if (isAuthenticated) {
    return null;
  }

  // Only show welcome widget for unauthenticated users
  return (
    <div className="p-4 rounded-xl border">
      <h3 className="text-base font-extrabold flex items-center leading-none tracking-tight mb-3">Welcome to Name</h3>
      <p className="text-sm text-muted-foreground mb-[16px]">
        Sign up to get your personalized feed
      </p>
      <Button asChild className="w-full rounded-full font-semibold">
        <Link href="/signin">Sign up</Link>
      </Button>
    </div>
  );
});

NotificationsWidget.displayName = 'NotificationsWidget'; 