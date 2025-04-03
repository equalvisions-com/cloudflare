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
import Image from "next/image";

interface UserMenuClientProps {
  initialDisplayName?: string;
  initialProfileImage?: string;
  isBoarded?: boolean;
}

export function UserMenuClientWithErrorBoundary(props: UserMenuClientProps) {
  return (
    <ErrorBoundary>
      <UserMenuClient {...props} />
    </ErrorBoundary>
  );
}

export function UserMenuClient({ initialDisplayName, initialProfileImage, isBoarded }: UserMenuClientProps) {
  const { displayName, profileImage, isAuthenticated, handleSignIn, handleSignOut } =
    useUserMenuState(initialDisplayName, initialProfileImage);

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {profileImage ? (
            <div className="cursor-pointer h-8 w-8 overflow-hidden rounded-full">
              <Image 
                src={profileImage} 
                alt={displayName} 
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </div>
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="ml-4">
          {isAuthenticated ? (
            <>
               <DropdownMenuItem asChild>
                <a href="/notifications" className="cursor-pointer flex items-center">
                  <Bell className="mr-1 h-4 w-4" />
                  Alerts
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
              <DropdownMenuItem onClick={handleSignOut} className="flex items-center">
                <LogOut className="mr-1 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={handleSignIn} className="flex items-center">
                <UserPlus className="mr-1 h-4 w-4" />
                Sign up
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignIn} className="flex items-center">
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
}