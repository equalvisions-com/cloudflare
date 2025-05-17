"use client";

import { SearchProvider } from "./SearchContext";
import { BookmarksHeader } from "./BookmarksHeader";
import { BookmarksContentWrapper } from "./BookmarksContentWrapper";
import { ReactNode } from "react";

interface BookmarksPageClientScopeProps {
  rightSidebar: ReactNode;
}

export function BookmarksPageClientScope({ rightSidebar }: BookmarksPageClientScopeProps) {
  return (
    <SearchProvider>
      {/* StandardSidebarLayout equivalent structure will be in the page.tsx or here if needed */}
      {/* For now, just rendering Header and ContentWrapper within the provider */}
      <BookmarksHeader />
      <BookmarksContentWrapper />
    </SearchProvider>
  );
} 