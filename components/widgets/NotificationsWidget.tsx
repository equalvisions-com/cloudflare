"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { BellIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationsWidgetProps {
  isAuthenticated?: boolean;
}

export function NotificationsWidget({ isAuthenticated = false }: NotificationsWidgetProps) {
  const pendingRequestsCount = useQuery(api.friends.getPendingRequestsCount) ?? 0;

  if (!isAuthenticated) {
    return (
      <div className="p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">Welcome!</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Join our community to connect with other readers and writers.
        </p>
        <Button asChild className="w-full">
          <Link href="/signin">Sign up</Link>
        </Button>
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