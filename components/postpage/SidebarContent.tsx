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

  // Simplify the class strings to avoid conflicts
  const mainContentClass = useMemo(() => {
    // On mobile: full width, on desktop: original width
    return `w-full ${sidebarCollapsed ? "md:w-[62%]" : "md:w-[56%]"} overflow-y-auto border bg-card rounded-lg mt-6`;
  }, [sidebarCollapsed]);

  const sidebarClass = useMemo(() => {
    // Hidden on mobile, original width on desktop
    return `hidden md:block ${sidebarCollapsed ? "md:w-[29%]" : "md:w-[26%]"} transition-[width]`;
  }, [sidebarCollapsed]);

  return (
    <>
      {/* Interactive sidebar toggle - hidden on mobile */}
      <div className="hidden md:block">
        <CollapsibleSidebarWithErrorBoundary onCollapse={setSidebarCollapsed} />
      </div>
      
      {/* Main content with responsive width */}
      <div className={mainContentClass}>
        {children}
      </div>

      {/* Sidebar content with responsive width - hidden on mobile */}
      <ProfileSidebarWrapper className={sidebarClass}>
        {sidebarContent}
      </ProfileSidebarWrapper>
    </>
  );
}; 