"use client";

import { useState, useMemo } from "react";
import { CollapsibleSidebar } from "@/components/ui/CollapsibleSidebar";
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
      <CollapsibleSidebar onCollapse={setSidebarCollapsed} className="hidden md:block" />
      
      {/* Main content with responsive width */}
      <div className={`w-full md:${mainContentClass} overflow-y-auto custom-scrollbar`}>
        {children}
      </div>

      {/* Sidebar content with responsive width */}
      <ProfileSidebarWrapper className={`hidden md:block ${sidebarClass}`}>
        {sidebarContent}
      </ProfileSidebarWrapper>
    </>
  );
}; 