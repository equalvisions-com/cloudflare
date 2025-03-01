"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  BarChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GearIcon,
  HomeIcon,
} from "@radix-ui/react-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useMemo } from "react";
import React from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface CollapsibleSidebarProps {
  onCollapse: (isCollapsed: boolean) => void;
}

export function CollapsibleSidebarWithErrorBoundary(props: CollapsibleSidebarProps) {
  return (
    <ErrorBoundary>
      <CollapsibleSidebar {...props} />
    </ErrorBoundary>
  );
}

// Memoized collapse button to prevent unwanted animations
const CollapseButton = React.memo(({ 
  isCollapsed, 
  onClick 
}: { 
  isCollapsed: boolean; 
  onClick: () => void 
}) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="mt-4 self-end collapse-button"
      onClick={onClick}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {isCollapsed ? (
        <ChevronRightIcon className="h-4 w-4" />
      ) : (
        <ChevronLeftIcon className="h-4 w-4" />
      )}
    </Button>
  );
});
CollapseButton.displayName = 'CollapseButton';

function CollapsibleSidebar({ onCollapse }: CollapsibleSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = useMemo<NavItem[]>(() => [
    {
      href: "/",
      label: "Dashboard",
      icon: <HomeIcon className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/analytics",
      label: "Analytics",
      icon: <BarChartIcon className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: <GearIcon className="h-4 w-4 shrink-0" />,
    },
  ], []);

  const handleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapse(newCollapsed);
  }, [isCollapsed, onCollapse]);

  return (
    <Card className={`${isCollapsed ? "w-[60px]" : "w-[14%]"} h-fit min-w-fit shadow-none mt-6 hidden md:block sidebar-card`}>
      <CardContent className="p-4">
        <nav className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="w-full"
                prefetch={true}
              >
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-2 px-2 ${
                    pathname === item.href ? "bg-primary/10" : ""
                  }`}
                >
                  {item.icon}
                  {!isCollapsed && <span>{item.label}</span>}
                </Button>
              </Link>
            ))}
          </div>
          
          {/* Use the memoized collapse button with a stable key */}
          <CollapseButton 
            key="collapse-button" 
            isCollapsed={isCollapsed} 
            onClick={handleCollapse} 
          />
        </nav>
      </CardContent>
    </Card>
  );
}