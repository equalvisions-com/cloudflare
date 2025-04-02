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
import { PersonIcon } from "@radix-ui/react-icons";
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

export function UserMenuClient({ initialDisplayName, initialProfileImage }: UserMenuClientProps) {
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
            <Button variant="secondary" size="icon" className="rounded-full h-8 w-8 p-0">
              <PersonIcon className="h-5 w-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2 py-0 font-normal">
            <ThemeToggleWithErrorBoundary />
          </DropdownMenuLabel>
          {!isAuthenticated ? (
            <DropdownMenuItem onClick={handleSignIn}>Sign in</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}