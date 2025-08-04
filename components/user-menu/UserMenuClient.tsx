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
import { Bell, LogOut, UserPlus, LogIn, Settings } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar-context";
import UserMenuImage from "./UserMenuImage";
import { clearOnboardingCookieAction } from "@/app/onboarding/actions";

export const UserMenuClientWithErrorBoundary = memo(function UserMenuClientWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <UserMenuClient />
    </ErrorBoundary>
  );
});

// DEDUPLICATION FIX: Use sidebar context instead of duplicate queries
const UserMenuClientComponent = () => {
  
  const { signOut } = useAuthActions();
  const router = useRouter();
  
  // ✅ DEDUPLICATION: Use sidebar context data instead of making duplicate queries
  // This eliminates the duplicate getAuthUserWithNotifications query
  const { 
    isAuthenticated, 
    displayName, 
    username, 
    profileImage, 
    pendingFriendRequestCount,
    isLoading 
  } = useSidebar();

  // Memoized event handlers
  const onSignIn = useCallback(() => {
    router.push("/signin");
  }, [router]);
  
  const onSignOut = useCallback(async () => {
    try {
      await signOut();
      // Clear the httpOnly onboarding cookie using server action
      await clearOnboardingCookieAction();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, [signOut]);

  // ✅ SIMPLIFIED: Use sidebar context loading state directly
  // The sidebar context already handles proper loading state management
  const shouldShowLoading = isLoading;

  if (shouldShowLoading) {
    return (
      <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />
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
            {profileImage && (
              <UserMenuImage 
                key={`user-menu-${profileImage}`}
                src={profileImage} 
                alt={displayName || 'User'} 
              />
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