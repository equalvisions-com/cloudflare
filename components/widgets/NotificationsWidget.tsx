"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NotificationsWidgetProps {
  isAuthenticated?: boolean;
}

export function NotificationsWidget({ isAuthenticated = false }: NotificationsWidgetProps) {
  const pendingRequestsCount = useQuery(api.friends.getPendingRequestsCount);
  
  if (pendingRequestsCount === undefined) {
    throw new Promise((resolve) => {
    });
  }

  if (!isAuthenticated) {
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

  return (
    <div className="p-4 rounded-xl border">
      <h3 className="text-base font-extrabold flex items-center leading-none tracking-tight mb-3">
        Notifications
      </h3>
      
      {pendingRequestsCount > 0 ? (
        <div className="space-y-4">
          <Link 
            href="/notifications" 
            className="flex items-center text-sm text-primary hover:underline tracking-tight"
          >
            You have {pendingRequestsCount} pending friend {pendingRequestsCount === 1 ? 'request' : 'requests'}
          </Link>
          
          <Link
            href="/notifications"
            className="text-sm font-semibold p-0 h-auto hover:no-underline text-left justify-start mt-0 tracking-tight leading-none"
          >
            View all
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground tracking-tight">
            No new notifications
          </p>
          
          <Link
            href="/notifications"
            className="text-sm font-semibold p-0 h-auto hover:no-underline text-left justify-start mt-0 tracking-tight leading-none"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
} 