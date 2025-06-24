"use client";

import { ThemeToggleWithErrorBoundary } from "@/components/user-menu/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, User, LogOut, UserPlus, LogIn, Settings } from "lucide-react";
import { memo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

// Dynamically import the Image component optimized for Edge runtime
// Uses Next.js 14+ optimizations for better Edge performance
const UserMenuImage = dynamic(() => import("./UserMenuImage"), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />
  )
});

export const UserMenuClientWithErrorBoundary = memo(function UserMenuClientWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <UserMenuClient />
    </ErrorBoundary>
  );
});

// Pure client reactive component - single source of truth via Convex queries
const UserMenuClientComponent = () => {
  
  // ✅ Convex best practice: Use reactive queries as single source of truth
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  
  // ✅ Single source of truth: Convex reactive viewer query
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  
  // ✅ Single source of truth: Reactive pending friend requests
  const pendingFriendRequestCount = useQuery(
    api.friends.getMyPendingFriendRequestCount, 
    isAuthenticated ? {} : "skip"
  ) ?? 0;

  // ✅ Derive all state from Convex queries - no server props needed
  const displayName = viewer?.name || viewer?.username || "";
  const username = viewer?.username || "";
  const profileImage = viewer?.profileImage;
  
  // Memoized event handlers
  const onSignIn = useCallback(() => {
    router.push("/signin");
  }, [router]);
  
  const onSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, [signOut]);

  // Show loading state during auth resolution
  if (isLoading) {
    return (
      <div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="relative cursor-pointer">
            {pendingFriendRequestCount > 0 && (
              <div className="absolute -top-0 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-background z-10"></div>
            )}
            {profileImage ? (
              <UserMenuImage src={profileImage} alt={displayName || 'User'} />
            ) : (
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full h-8 w-8 p-0 shadow-none text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none" 
              >
                <User className="h-5 w-5" strokeWidth={2.5} />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="ml-4">
          {isAuthenticated ? (
            <>
               <DropdownMenuItem asChild>
                <a href="/alerts" className="cursor-pointer flex items-center">
                  <Bell className="mr-1 h-4 w-4" />
                  Alerts
                  {pendingFriendRequestCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 ml-2">
                      {pendingFriendRequestCount}
                    </span>
                  )}
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/settings" className="cursor-pointer flex items-center">
                  <Settings className="mr-1 h-4 w-4" />
                  Settings
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="flex items-center">
                <LogOut className="mr-1 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={onSignIn} className="flex items-center">
                <UserPlus className="mr-1 h-4 w-4" />
                Sign up
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignIn} className="flex items-center">
                <LogIn className="mr-1 h-4 w-4" />
                Sign in
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center px-0 gap-2 py-0 font-normal">
            <ThemeToggleWithErrorBoundary />
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Export the memoized version of the component
export const UserMenuClient = memo(UserMenuClientComponent);