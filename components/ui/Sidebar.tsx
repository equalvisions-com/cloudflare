"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Home, Play, User, Mail, Search, Sparkles, Heart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import React from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
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

/**
 * Fixed-width sidebar for navigation
 */
function Sidebar() {
  const pathname = usePathname();

  // Define navigation items with active state based on current path
  const navItems = useMemo<NavItem[]>(() => [
    {
      href: "/",
      label: "Home",
      icon: <Home className="h-5 w-5 shrink-0" strokeWidth={pathname === "/" ? 3 : 2} />,
    },
    {
      href: "/search",
      label: "Explore",
      icon: <Search className="h-5 w-5 shrink-0" strokeWidth={pathname === "/search" ? 3 : 2} />,
    },
    {
      href: "/newsletters",
      label: "Newsletters",
      icon: <Mail className="h-5 w-5 shrink-0" strokeWidth={pathname === "/newsletters" ? 3 : 2} />,
    },
    {
      href: "/player",
      label: "Podcasts",
      icon: <Play className="h-5 w-5 shrink-0" strokeWidth={pathname === "/player" ? 3 : 2} />,
    },
    {
      href: "/likes",
      label: "Likes",
      icon: <Heart className="h-5 w-5 shrink-0" strokeWidth={pathname === "/likes" ? 3 : 2} />,
    },
    {
      href: "/profile",
      label: "Profile",
      icon: <User className="h-5 w-5 shrink-0" strokeWidth={pathname === "/profile" ? 3 : 2} />,
    },
  ], [pathname]);

  return (
    <Card className="sticky top-6 h-fit shadow-none hidden md:block border-none md:basis-[25%] md:w-fit justify-self-end">
      <CardContent className="p-0">
        <nav className="flex flex-col gap-4">
          {/* Navigation items */}
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="w-full"
                prefetch={true}
              >
                <Button
                  variant="ghost"
                  className={`justify-start gap-2 px-3 py-1 rounded-full ${
                    pathname === item.href ? "font-bold" : ""
                  }`}
                >
                  {item.icon}
                  <span className="text-base">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>

          {/* Ask AI Button */}
          <Link href="/ask-ai" className="flex justify-center" prefetch={true}>
            <Button
              variant="default"
              className="w-full rounded-full gap-2"
            >
              <Sparkles className="h-5 w-5 shrink-0" />
              <span className="text-base">Ask AI</span>
            </Button>
          </Link>
        </nav>
      </CardContent>
    </Card>
  );
} 