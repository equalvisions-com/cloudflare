"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, memo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon, UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import Image from 'next/image';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useNotificationActions } from '@/lib/hooks/useNotificationActions';
import type { 
  NotificationsData, 
  NotificationItemProps 
} from '@/lib/types';

// Memoized notification item component to prevent unnecessary re-renders
const NotificationItemComponent = memo(({ 
  notification, 
  isAccepting, 
  isDeclining, 
  onAccept, 
  onDecline, 
  onRemove 
}: NotificationItemProps) => {
  const isLoading = isAccepting || isDeclining;
  const profileUrl = `/@${notification.profile.username}`;
  
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3">
        <Link href={profileUrl} className="block">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {notification.profile.profileImage ? (
              <Image 
                src={notification.profile.profileImage} 
                alt={notification.profile.username || "User"} 
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </Link>
        <div>
          <Link href={profileUrl} className="hover:none">
            <p className="font-bold text-sm">
              {notification.profile.name || notification.profile.username}
            </p>
          </Link>
          <p className="text-xs text-muted-foreground">
            {notification.friendship.type === "friend_request" && 
              "Sent you a friend request"}
            {notification.friendship.type === "friend_accepted" && 
              "Accepted your friend request"}
            {notification.friendship.type === "friend_you_accepted" && 
              "You accepted their friend request"}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {notification.friendship.type === "friend_request" ? (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onAccept(notification.friendship._id)}
              disabled={isLoading}
              className="rounded-full bg-muted/90 hover:bg-muted shadow-none"
            >
              <CheckIcon className="h-4 w-4" strokeWidth={2.25} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDecline(notification.friendship._id)}
              disabled={isLoading}
              className="rounded-full bg-muted/90 hover:bg-muted shadow-none"
            >
              <XIcon className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full shadow-none font-semibold text-sm"
                disabled={isLoading}
              >
                Friends
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => onRemove(notification.friendship._id)}
                className="text-red-500 focus:text-red-500 focus:bg-red-50"
              >
                <XIcon className="mr-2 h-4 w-4" />
                Remove friend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});

NotificationItemComponent.displayName = 'NotificationItemComponent';

export default function NotificationsClient() {
  // Get notifications data
  const data = useQuery(api.friends.getNotifications) as NotificationsData | undefined;
  
  // Use Zustand store for loading states
  const { isAccepting, isDeclining, reset } = useNotificationStore();
  
  // Use custom hook for actions
  const { handleAcceptRequest, handleDeclineRequest, handleRemoveFriend } = useNotificationActions();

  // Cleanup effect - one of the legitimate uses of useEffect
  useEffect(() => {
    return () => {
      // Reset loading states when component unmounts
      reset();
    };
  }, [reset]);

  // Memoize the empty state component
  const EmptyState = useMemo(() => (
    <div className="p-8 text-center">
      <div className="mx-auto h-10 w-10 text-muted-foreground mb-4 flex items-center justify-center">
        <CheckIcon className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
      <p className="text-muted-foreground">You have no new notifications.</p>
    </div>
  ), []);

  // Memoize the unauthenticated state component
  const UnauthenticatedState = useMemo(() => (
    <div className="p-8 rounded-lg bg-muted/50 text-center">
      <UserIcon className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Sign in to view notifications</h2>
      <p className="text-muted-foreground">You need to be signed in to view your notifications.</p>
    </div>
  ), []);
  
  // If data is not available yet, simply return null to let Suspense handle loading state
  if (!data) {
    return null;
  }
  
  const { user, notifications } = data;
  
  if (!user) {
    return UnauthenticatedState;
  }
  
  if (notifications.length === 0) {
    return EmptyState;
  }

  return (
    <div className="">
      {notifications.map((notification) => (
        <NotificationItemComponent
          key={notification.friendship._id}
          notification={notification}
          isAccepting={isAccepting(notification.friendship._id)}
          isDeclining={isDeclining(notification.friendship._id)}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
          onRemove={handleRemoveFriend}
        />
      ))}
    </div>
  );
} 