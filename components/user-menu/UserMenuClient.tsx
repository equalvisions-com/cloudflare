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
  initialDisplayName: string;
  isBoarded?: boolean;
  profileImage?: string;
}

export function UserMenuClientWithErrorBoundary(props: UserMenuClientProps) {
  return (
    <ErrorBoundary>
      <UserMenuClient {...props} />
    </ErrorBoundary>
  );
}

export function UserMenuClient({ initialDisplayName, profileImage }: UserMenuClientProps) {
  const { displayName, isAuthenticated, handleSignIn, handleSignOut } =
    useUserMenuState(initialDisplayName);

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full w-14 h-14 p-0">
            {profileImage ? (
              <Image 
                src={profileImage} 
                alt={displayName}
                width={56}
                height={56}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <PersonIcon className="h-8 w-8" />
            )}
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2 py-0 font-normal">
            Theme
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