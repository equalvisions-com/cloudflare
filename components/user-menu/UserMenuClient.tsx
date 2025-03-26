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
import { PersonIcon, CaretRightIcon } from "@radix-ui/react-icons";
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
    <div className="w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full px-3 py-2 rounded-lg justify-start group hover:bg-muted transition-all"
          >
            <div className="flex items-center w-full gap-2">
              <div className="relative transition-all duration-200 group-hover:h-6 group-hover:w-6 h-14 w-14 rounded-full overflow-hidden flex-shrink-0">
                {profileImage ? (
                  <Image 
                    src={profileImage} 
                    alt={displayName} 
                    width={56} 
                    height={56} 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PersonIcon className="h-full w-full" />
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-grow overflow-hidden">
                <div className="flex flex-col text-left">
                  <span className="font-medium truncate">{displayName}</span>
                  <span className="text-xs text-muted-foreground truncate">@{displayName.toLowerCase()}</span>
                </div>
              </div>
              <CaretRightIcon className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-4 w-4 flex-shrink-0 ml-auto" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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