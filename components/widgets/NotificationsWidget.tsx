"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { BellIcon, UserPlusIcon } from "lucide-react";

export function NotificationsWidget() {
  const { isAuthenticated } = useConvexAuth();
  const pendingRequestsCount = useQuery(api.friends.getPendingRequestsCount) ?? 0;

  if (!isAuthenticated) {
    return (
      <div className="p-4 rounded-xl border">
        <h3 className="text-lg font-semibold mb-2">Welcome!</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Join our community to connect.
        </p>
        <Link 
          href="/signin" 
          className="text-sm font-medium text-primary hover:underline"
        >
          Sign in or create an account
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border">
      <h3 className="text-lg font-semibold mb-2 flex items-center">
        <BellIcon className="h-5 w-5 mr-2" />
        Notifications
      </h3>
      
      {pendingRequestsCount > 0 ? (
        <Link 
          href="/notifications" 
          className="flex items-center text-sm text-primary hover:underline"
        >
          <UserPlusIcon className="h-4 w-4 mr-1" />
          You have {pendingRequestsCount} pending friend {pendingRequestsCount === 1 ? 'request' : 'requests'}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          No new notifications
        </p>
      )}
    </div>
  );
} 