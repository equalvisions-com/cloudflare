"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Home, Podcast, User, Mail, Bell, LogIn, Bookmark } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, memo, useCallback } from "react";
import React from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut } from "lucide-react";
import { ThemeToggleWithErrorBoundary } from "@/components/user-menu/ThemeToggle";
import Image from "next/image";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMountedRef } from "@/hooks";
import { SIDEBAR_CONSTANTS } from "@/lib/layout-constants";
import type { NavItem } from "@/lib/types";

/**
 * Fixed-width sidebar component with error boundary
 */
export function SidebarWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Sidebar />
    </ErrorBoundary>
  );
}

// Memoized NavLink component - only re-renders when props actually change
const NavLink = memo(({ item, isActive }: { item: NavItem; isActive: boolean }) => (
  <Link href={item.href} className="w-full" prefetch={item.prefetch === false ? false : true}>
    <Button
      variant="ghost"
      className={`w-full justify-start gap-2 px-3 py-1 rounded-lg flex items-center ${
        isActive ? "text-base font-extrabold flex leading-none tracking-tight" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          {item.icon}
          {item.badgeContent !== undefined && item.badgeContent !== 0 && (
            <Badge 
              variant="default" 
              className="absolute h-3.5 w-auto hover:!opacity-100 p-0 text-[9px] p-1 leading-none font-extrabold flex items-center justify-center rounded-full shadow-none"
              style={{ 
                top: SIDEBAR_CONSTANTS.BADGE_OFFSET.TOP, 
                right: SIDEBAR_CONSTANTS.BADGE_OFFSET.RIGHT 
              }}
            >
              {item.badgeContent}
            </Badge>
          )}
        </div>
        <span className="text-base">{item.label}</span>
      </div>
    </Button>
  </Link>
));
NavLink.displayName = 'NavLink';

// Memoized UserMenu component - isolated from navigation re-renders
const UserMenu = memo(({ 
  displayName, 
  profileImage, 
  username, 
  onSignOut 
}: { 
  displayName: string; 
  profileImage?: string; 
  username: string; 
  onSignOut: () => void; 
}) => (
  <div className="flex flex-col gap-3 mt-[-3px]" style={{ width: SIDEBAR_CONSTANTS.WIDTH }}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-start gap-2 cursor-pointer hover:bg-accent rounded-lg py-2 px-3 transition-colors">
          <div className="relative">
            {profileImage ? (
              <div className="h-8 w-8 overflow-hidden rounded-full">
                <Image 
                  src={profileImage} 
                  alt={displayName || ""} 
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
                <User className="h-5 w-5" strokeWidth={SIDEBAR_CONSTANTS.INACTIVE_STROKE_WIDTH} />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            )}
          </div>
          <div className="mt-[-3px]">
            <div className="font-bold text-sm line-clamp-1 overflow-anywhere">{displayName}</div>
            <div className="text-muted-foreground text-xs line-clamp-1 overflow-anywhere">@{username}</div>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="ml-4">
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center px-0 gap-2 py-0 font-normal">
          <ThemeToggleWithErrorBoundary />
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
));
UserMenu.displayName = 'UserMenu';

// Navigation wrapper that accepts children - React best practice
const NavigationWrapper = memo(({ children }: { children: React.ReactNode }) => (
  <Card className={`sticky ${SIDEBAR_CONSTANTS.TOP_OFFSET} h-fit shadow-none hidden md:block border-none md:basis-[25%]`} style={{ width: SIDEBAR_CONSTANTS.WIDTH, marginLeft: 'auto' }}>
    <CardContent className="p-0">
      <nav className="flex flex-col gap-4">
        {children}
      </nav>
    </CardContent>
  </Card>
));
NavigationWrapper.displayName = 'NavigationWrapper';

/**
 * Fixed-width sidebar for navigation
 * Optimized following React best practices:
 * 1. Uses children pattern to prevent unnecessary re-renders
 * 2. Separates concerns with memoized sub-components
 * 3. Minimal context subscriptions
 */
const SidebarComponent = () => {
  const pathname = usePathname();
  const router = useRouter();
  
  // Single context subscription - minimizes re-renders
  const { isAuthenticated, username, displayName, profileImage, pendingFriendRequestCount } = useSidebar();
  const { signOut } = useAuthActions();
  
  // Use custom hook to track component mount status
  const isMountedRef = useMountedRef();

  // Memoize route matching logic
  const isRouteActive = useMemo(() => {
    return (route: string) => {
      if (route === '/') return pathname === route;
      return pathname === route || pathname.startsWith(route + '/');
    };
  }, [pathname]);

  // Helper function to get stroke width - memoized for performance
  const getStrokeWidth = useCallback((route: string, isActive: boolean) => {
    if (!isActive) return SIDEBAR_CONSTANTS.INACTIVE_STROKE_WIDTH;
    if (route === '/podcasts') return SIDEBAR_CONSTANTS.PODCAST_ACTIVE_STROKE_WIDTH;
    return SIDEBAR_CONSTANTS.ACTIVE_STROKE_WIDTH;
  }, []);

  // Custom sign out handler with redirect
  const handleSignOutWithRedirect = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, [signOut, router, isMountedRef]);

  // Memoize navigation items - only recalculates when dependencies change
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        href: "/",
        label: "Home",
        icon: <Home className="h-5 w-5 shrink-0" strokeWidth={getStrokeWidth("/", isRouteActive("/"))} />,
      },
    ];

    if (isAuthenticated) {
              items.push({
          href: "/alerts",
          label: "Alerts",
          icon: <Bell className="h-5 w-5 shrink-0" strokeWidth={getStrokeWidth("/alerts", isRouteActive("/alerts"))} />,
          badgeContent: pendingFriendRequestCount
        });
    }

    items.push(
      {
        href: "/newsletters",
        label: "Newsletters",
        icon: <Mail className="h-5 w-5 shrink-0" strokeWidth={getStrokeWidth("/newsletters", isRouteActive("/newsletters"))} />,
      },
      {
        href: "/podcasts",
        label: "Podcasts",
        icon: <Podcast className="h-5 w-5 shrink-0" strokeWidth={getStrokeWidth("/podcasts", isRouteActive("/podcasts"))} />,
      }
    );

    if (isAuthenticated) {
      items.push({
        href: "/bookmarks",
        label: "Bookmarks",
        icon: <Bookmark className="h-5 w-5 shrink-0" strokeWidth={getStrokeWidth("/bookmarks", isRouteActive("/bookmarks"))} />,
      });
    }

    const userProfileRoute = `/@${username}`;
    items.push(
      isAuthenticated
        ? {
            href: userProfileRoute,
            label: "Profile",
            icon: <User className="h-5 w-5 shrink-0" strokeWidth={getStrokeWidth(userProfileRoute, isRouteActive(userProfileRoute))} />,
            prefetch: false
          }
        : {
            href: "/signin",
            label: "Sign In",
            icon: <LogIn className="h-5 w-5 shrink-0" strokeWidth={getStrokeWidth("/signin", isRouteActive("/signin"))} />,
          }
    );

    return items;
  }, [isRouteActive, isAuthenticated, username, pendingFriendRequestCount, getStrokeWidth]);

  // Memoize navigation items JSX - prevents re-creation on every render
  const navigationItems = useMemo(() => (
    <div className="flex flex-col gap-3">
      {navItems.map((item) => (
        <NavLink 
          key={item.href} 
          item={item} 
          isActive={isRouteActive(item.href)}
        />
      ))}
    </div>
  ), [navItems, isRouteActive]);

  // Use children pattern - NavigationWrapper won't re-render when this component's state changes
  return (
    <NavigationWrapper>
      {navigationItems}
      {isAuthenticated && (
        <UserMenu
          displayName={displayName}
          profileImage={profileImage}
          username={username}
          onSignOut={handleSignOutWithRedirect}
        />
      )}
    </NavigationWrapper>
  );
};

// Export the memoized version of the component
const Sidebar = memo(SidebarComponent); 