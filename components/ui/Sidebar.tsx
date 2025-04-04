"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Home, Podcast, User, Mail, MessageCircle, Bell, LogIn, Users, Bookmark } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, memo } from "react";
import React from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { Badge } from "@/components/ui/badge";

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
        isActive ? "text-base font-bold leading-none" : ""
      }`}
    >
      <div className="flex items-center gap-2 flex-grow">
        {item.icon}
        <span className="text-base">{item.label}</span>
      </div>
      {item.badgeContent !== undefined && item.badgeContent !== 0 && (
        <Badge variant="default" className="ml-auto h-5 px-1.5 text-xs leading-none rounded-full shadow-none">
          {item.badgeContent}
        </Badge>
      )}
    </Button>
  </Link>
));
NavLink.displayName = 'NavLink';

/**
 * Fixed-width sidebar for navigation
 */
function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated, username, pendingFriendRequestCount } = useSidebar();

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
      {
        href: "/newsletters",
        label: "Newsletters",
        icon: <Mail className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/newsletters") ? 3 : 2.5} />,
      },
      {
        href: "/podcasts",
        label: "Podcasts",
        icon: <Podcast className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/podcasts") ? 2.75 : 2.5 } />,
      },
    
    ];

    // Only add alerts link if user is authenticated
    if (isAuthenticated) {
      items.push({
        href: "/bookmarks",
        label: "Bookmarks",
        icon: <Bookmark className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/bookmarks") ? 3 : 2.5} />,
      });
      
      items.push({
        href: "/notifications",
        label: "Alerts",
        icon: <Bell className="h-5 w-5 shrink-0" strokeWidth={isRouteActive("/notifications") ? 3 : 2.5} />,
        badgeContent: pendingFriendRequestCount
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
        </nav>
      </CardContent>
    </Card>
  );
} 