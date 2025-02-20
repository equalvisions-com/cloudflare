"use client";

import { useState, useMemo, ReactNode } from "react";
import { CollapsibleSidebarWithErrorBoundary } from "./CollapsibleSidebar";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface LayoutManagerClientProps {
  children: ReactNode;
}

export function LayoutManagerClientWithErrorBoundary(props: LayoutManagerClientProps) {
  return (
    <ErrorBoundary>
      <LayoutManagerClient {...props} />
    </ErrorBoundary>
  );
}

function LayoutManagerClient({ children }: LayoutManagerClientProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const mainContentClass = useMemo(() => {
    return sidebarCollapsed ? "w-[62%]" : "w-[56%]";
  }, [sidebarCollapsed]);

  const rightSidebarClass = useMemo(() => {
    return sidebarCollapsed ? "w-[29%]" : "w-[26%]";
  }, [sidebarCollapsed]);

  return (
    <div className="container flex h-screen gap-6">
      <CollapsibleSidebarWithErrorBoundary onCollapse={setSidebarCollapsed} />
      <main className={mainContentClass}>
        {children}
      </main>
      <RightSidebar className={rightSidebarClass} />
    </div>
  );
} 