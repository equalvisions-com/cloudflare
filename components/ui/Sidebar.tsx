"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Home, Podcast, User, Mail, MessageCircle, Bell, LogIn, Users, Bookmark } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, memo } from "react";
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
import { useUserMenuState } from "@/components/user-menu/useUserMenuState";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badgeContent?: number | string;
}

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

// Memoized NavLink component to prevent unnecessary re-renders
const NavLink = memo(({ item, isActive }: { item: NavItem; isActive: boolean }) => (
  <Link href={item.href} className="w-full" prefetch={true}>
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
              className="absolute -top-[6px] -right-1 h-3.5 w-auto hover:!opacity-100 p-0 text-[9px] p-1 leading-none font-extrabold flex items-center justify-center rounded-full shadow-none"
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

/**
 * Fixed-width sidebar for navigation
 */
function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, username, displayName, profileImage, pendingFriendRequestCount, isBoarded } = useSidebar();
  const { handleSignOut } = useUserMenuState(displayName, profileImage, username);

  // Custom sign out handler with redirect
  const handleSignOutWithRedirect = async () => {
    await handleSignOut();
    router.push('/');
  };

  // Memoize route matching logic
  const isRouteActive = useMemo(() => {
    return (route: string) => pathname === route;
  }, [pathname]);

  // Define navigation items with active state based on current path
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        href: "/",
        label: "Home",
        icon: <Home className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/") ? 3 : 2.5} />,
      },
    ];

    // Add alerts as second item if user is authenticated
    if (isAuthenticated) {
      items.push({
        href: "/alerts",
        label: "Alerts",
        icon: <Bell className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/alerts") ? 3 : 2.5} />,
        badgeContent: pendingFriendRequestCount
      });
    }

    // Add remaining navigation items
    items.push(
      {
        href: "/newsletters",
        label: "Newsletters",
        icon: <Mail className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/newsletters") ? 3 : 2.5} />,
      },
      {
        href: "/podcasts",
        label: "Podcasts",
        icon: <Podcast className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/podcasts") ? 2.75 : 2.5 } />,
      }
    );

    // Add bookmarks if user is authenticated
    if (isAuthenticated) {
      items.push({
        href: "/bookmarks",
        label: "Bookmarks",
        icon: <Bookmark className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/bookmarks") ? 3 : 2.5} />,
      });
    }

    const userProfileRoute = `/@${username}`;

    // Conditionally add profile or sign in based on auth status
    items.push(
      isAuthenticated
        ? 
        {
            href: userProfileRoute,
            label: "Profile",
            icon: <User className="h-5 w-5 shrink-0" strokeWidth={isRouteActive(userProfileRoute) ? 3 : 2.5} />,
          }
        : {
            href: "/signin",
            label: "Sign In",
            icon: <LogIn className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/signin") ? 3 : 2.5} />,
          }
    );

    return items;
  }, [isRouteActive, isAuthenticated, username, pendingFriendRequestCount]);

  return (
    <Card className="sticky top-6 h-fit shadow-none hidden md:block border-none md:basis-[25%] md:w-[142.95px] ml-auto">
      <CardContent className="p-0">
        <nav className="flex flex-col gap-4">
          {/* Navigation items */}
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <NavLink 
                key={item.href} 
                item={item} 
                isActive={isRouteActive(item.href)} 
              />
            ))}
          </div>
          
          {/* User menu for authenticated users */}
          {isAuthenticated && (
            <div className="flex flex-col gap-3 w-[142.95px] mt-[-3px]">
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
                          <User className="h-5 w-5" strokeWidth={2.5} />
                          <span className="sr-only">Toggle user menu</span>
                        </Button>
                      )}
                    </div>
                    <div className="mt-[-3px]">
                      <div className="font-bold text-sm line-clamp-1">{displayName}</div>
                      <div className="text-muted-foreground text-xs line-clamp-1">@{username}</div>
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
                  <DropdownMenuItem onClick={handleSignOutWithRedirect} className="flex items-center">
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
          )}
        </nav>
      </CardContent>
    </Card>
  );
} 