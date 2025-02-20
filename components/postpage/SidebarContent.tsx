"use client";

import { useState, useMemo } from "react";
import { CollapsibleSidebarWithErrorBoundary } from "@/components/ui/CollapsibleSidebar";
import { ProfileSidebarWrapper } from "@/components/postpage/ProfileSidebarWrapper";

interface SidebarContentProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
}

export const SidebarContent = ({
  children,
  sidebarContent,
}: SidebarContentProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Memoize width calculations
  const mainContentClass = useMemo(() => {
    return `${sidebarCollapsed ? "w-[62%]" : "w-[56%]"} overflow-y-auto custom-scrollbar`;
  }, [sidebarCollapsed]);

  const sidebarClass = useMemo(() => {
    return `${sidebarCollapsed ? "w-[29%]" : "w-[26%]"} transition-[width] `;
  }, [sidebarCollapsed]);

  return (
    <>
      {/* Interactive sidebar toggle */}
      <CollapsibleSidebarWithErrorBoundary onCollapse={setSidebarCollapsed} />
      
      {/* Main content with responsive width */}
      <div className={mainContentClass}>
        {children}
      </div>

      {/* Sidebar content with responsive width */}
      <ProfileSidebarWrapper className={sidebarClass}>
        {sidebarContent}
      </ProfileSidebarWrapper>
    </>
  );
}; 