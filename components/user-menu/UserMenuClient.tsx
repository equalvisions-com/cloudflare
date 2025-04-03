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
import { Settings } from "lucide-react";
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
            <Button variant="secondary" size="icon" className="rounded-full h-8 w-8 p-0 shadow-none text-muted-foreground">
              <Settings className="h-5 w-5" strokeWidth={2.25} />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="ml-4">
          {isAuthenticated ? (
            <>
               <DropdownMenuItem asChild>
                <a href="/notifications" className="cursor-pointer">Alerts</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={`/@${displayName}`} className="cursor-pointer">Profile</a>
              </DropdownMenuItem>
           
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={handleSignIn}>Sign in</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2 py-0 font-normal">
            <ThemeToggleWithErrorBoundary />
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}