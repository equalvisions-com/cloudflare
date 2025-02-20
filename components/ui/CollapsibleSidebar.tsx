"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GearIcon,
  HomeIcon,
} from "@radix-ui/react-icons";
import Link from "next/link";
import { useState, useCallback } from "react";

interface CollapsibleSidebarProps {
  onCollapse: (isCollapsed: boolean) => void;
}

export const CollapsibleSidebar = ({ onCollapse }: CollapsibleSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapse(newCollapsed);
  }, [isCollapsed, onCollapse]);

  return (
    <Card className={`${isCollapsed ? "w-[60px]" : "w-[14%]"} h-fit min-w-fit shadow-none mt-6`}>
      <CardContent className="p-4">
        <nav className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="w-full justify-start gap-2 px-2" asChild>
              <Link href="/">
                <HomeIcon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2" asChild>
              <Link href="/analytics">
                <BarChartIcon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Analytics</span>}
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2" asChild>
              <Link href="/settings">
                <GearIcon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Settings</span>}
              </Link>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mt-4 self-end"
            onClick={handleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </Button>
        </nav>
      </CardContent>
    </Card>
  );
};