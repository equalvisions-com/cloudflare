"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationsWidgetProps {
  isAuthenticated?: boolean;
}

export function NotificationsWidget({ isAuthenticated = false }: NotificationsWidgetProps) {
  const pendingRequestsCount = useQuery(api.friends.getPendingRequestsCount);
  const isLoading = pendingRequestsCount === undefined;

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
      <h3 className="text-base font-extrabold leading-none tracking-tight mb-[9px]">
        Notifications
      </h3>
      
      <div className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-5 w-36" />
        ) : pendingRequestsCount > 0 ? (
          <Link 
            href="/notifications" 
            className="text-sm hover:text-primary hover:no-underline font-semibold block line-clamp-2 overflow-hidden"
          >
            You have {pendingRequestsCount} friend {pendingRequestsCount === 1 ? 'request' : 'requests'}
          </Link>
        ) : (
          <Link 
          href="/notifications" 
          className="text-sm hover:text-primary hover:no-underline font-semibold block line-clamp-2 overflow-hidden"
        >            No new notifications
</Link>
        )}
        
      </div>
    </div>
  );
} 