"use client";

import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SidebarWithErrorBoundary } from "@/components/ui/Sidebar";
import { LAYOUT_CONSTANTS } from "@/lib/layout-constants";
import { ReactNode, useEffect, useState } from "react";

interface StandardSidebarLayoutProps {
  children: ReactNode;
  rightSidebar: ReactNode;
  mainContentClass?: string;
  rightSidebarClass?: string;
  containerClass?: string;
  useCardStyle?: boolean;
}

/**
 * Standardized layout component with left navigation sidebar and right content sidebar
 * Used by both the main feed layout and post layout for consistency
 */
export function StandardSidebarLayout({
  children,
  rightSidebar,
  mainContentClass,
  rightSidebarClass,
  containerClass,
  useCardStyle = false
}: StandardSidebarLayoutProps) {
  // State to track if we're in a mobile environment
  const [isMounted, setIsMounted] = useState(false);

  // Wait for mount to ensure we have access to window
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use provided classes or defaults from constants
  const finalContainerClass = containerClass || LAYOUT_CONSTANTS.CONTAINER_CLASS;
  const finalMainContentClass = mainContentClass || 
    (useCardStyle ? LAYOUT_CONSTANTS.MAIN_CONTENT_WITH_CARD_STYLE : LAYOUT_CONSTANTS.MAIN_CONTENT_CLASS);
  const finalRightSidebarClass = rightSidebarClass || LAYOUT_CONSTANTS.RIGHT_SIDEBAR_CLASS;

  // Ensure the container has flex layout classes
  const containerWithFlex = finalContainerClass.includes('flex') 
    ? finalContainerClass 
    : `${finalContainerClass} flex flex-col md:flex-row`;

  // Add dynamic viewport class for better mobile height handling
  const containerWithDynamicHeight = isMounted 
    ? `${containerWithFlex} dynamic-viewport` 
    : containerWithFlex;

  return (
    <div className={containerWithDynamicHeight}>
      {/* Left navigation sidebar (hidden on mobile) */}
      <div className={LAYOUT_CONSTANTS.LEFT_SIDEBAR_WRAPPER_CLASS}>
        <SidebarWithErrorBoundary />
      </div>
      
      {/* Main content area with error boundary - use flex-fill to expand content */}
      <main className={`${finalMainContentClass} flex-fill`}>
        <ErrorBoundary>
            {children}
        </ErrorBoundary>
      </main>
      
      {/* Right sidebar */}
      <div className={finalRightSidebarClass}>
        <ErrorBoundary>
          {rightSidebar}
        </ErrorBoundary>
      </div>
    </div>
  );
} 