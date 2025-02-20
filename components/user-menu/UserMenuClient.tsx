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

interface UserMenuClientProps {
  initialDisplayName: string;
}

export function UserMenuClientWithErrorBoundary(props: UserMenuClientProps) {
  return (
    <ErrorBoundary>
      <UserMenuClient {...props} />
    </ErrorBoundary>
  );
}

export function UserMenuClient({ initialDisplayName }: UserMenuClientProps) {
  const { displayName, isAuthenticated, handleSignIn, handleSignOut } =
    useUserMenuState(initialDisplayName);

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      {displayName}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <PersonIcon className="h-5 w-5" />
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