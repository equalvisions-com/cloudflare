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
import { useUserMenuState } from "./useUserMenuState";
import { memo, useCallback } from "react";
import dynamic from "next/dynamic";
import type { UserMenuClientProps } from "@/lib/types";

// Dynamically import the Image component optimized for Edge runtime
// Uses Next.js 14+ optimizations for better Edge performance
const UserMenuImage = dynamic(() => import("./UserMenuImage"), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />
  )
});

export const UserMenuClientWithErrorBoundary = memo(function UserMenuClientWithErrorBoundary(props: UserMenuClientProps) {
  return (
    <ErrorBoundary>
      <UserMenuClient {...props} />
    </ErrorBoundary>
  );
});

// Create the component implementation that will be memoized
const UserMenuClientComponent = ({ 
  initialDisplayName, 
  initialUsername,
  initialProfileImage, 
  isBoarded,
  pendingFriendRequestCount = 0
}: UserMenuClientProps) => {
  // Get state and handlers from our custom hook
  const { displayName, username, profileImage, isAuthenticated, handleSignIn, handleSignOut } =
    useUserMenuState(initialDisplayName, initialProfileImage, initialUsername);
  
  // Memoize event handlers with useCallback - no need for mounted checks
  // React's built-in cleanup handles component unmounting properly
  const onSignIn = useCallback(() => {
    handleSignIn();
  }, [handleSignIn]);
  
  const onSignOut = useCallback(() => {
    handleSignOut();
  }, [handleSignOut]);

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