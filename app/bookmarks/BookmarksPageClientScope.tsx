"use client";

import { BookmarksHeader } from "./BookmarksHeader";
import { BookmarksContentWrapper } from "./BookmarksContentWrapper";
import { ReactNode, memo, useEffect } from "react";
import { useBookmarkStore } from "@/lib/stores/bookmarkStore";

interface BookmarksPageClientScopeProps {
  rightSidebar: ReactNode;
}

const BookmarksPageClientScopeComponent = ({ rightSidebar }: BookmarksPageClientScopeProps) => {
  const { reset } = useBookmarkStore();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <>
      <BookmarksHeader />
      <BookmarksContentWrapper />
    </>
  );
};

export const BookmarksPageClientScope = memo(BookmarksPageClientScopeComponent);
BookmarksPageClientScope.displayName = 'BookmarksPageClientScope'; 