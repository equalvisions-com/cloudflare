"use client";

import { useState, useMemo, ReactNode } from "react";
import { CollapsibleSidebar } from "./CollapsibleSidebar";
import { RightSidebar } from "@/components/homepage/RightSidebar";

interface LayoutManagerClientProps {
  children: ReactNode;
}

export const LayoutManagerClient = ({ children }: LayoutManagerClientProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const mainContentClass = useMemo(() => {
    return sidebarCollapsed ? "w-[62%]" : "w-[56%]";
  }, [sidebarCollapsed]);

  const rightSidebarClass = useMemo(() => {
    return sidebarCollapsed ? "w-[29%]" : "w-[26%]";
  }, [sidebarCollapsed]);

  return (
    <div className="container flex h-screen gap-6">
      <CollapsibleSidebar onCollapse={setSidebarCollapsed} />
      <main className={mainContentClass}>
        {children}
      </main>
      <RightSidebar className={rightSidebarClass} />
    </div>
  );
}; 