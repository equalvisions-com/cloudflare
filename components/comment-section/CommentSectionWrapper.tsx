"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CommentButton } from "./CommentButton";
import { CommentSection } from "./CommentSection";
import { cn } from "@/lib/utils";

interface SanitizedComment {
  id: string;
  content: string;
  createdAt: number;
  authorName: string;
  isAuthor: boolean;
}

interface CommentSectionWrapperProps {
  entryGuid: string;
  feedUrl: string;
  initialCommentCount: number;
  initialComments: SanitizedComment[];
  isAuthenticated: boolean;
}

export function CommentSectionWrapper({
  entryGuid,
  feedUrl,
  initialCommentCount,
  initialComments,
  isAuthenticated,
}: CommentSectionWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Effect to toggle the background of the parent entry
  useEffect(() => {
    const entry = document.querySelector(`[data-entry-id="${entryGuid}"]`);
    if (entry) {
      if (isExpanded) {
        entry.classList.add('bg-muted/50');
      } else {
        entry.classList.remove('bg-muted/50');
      }
    }
  }, [isExpanded, entryGuid]);

  const expandingSection = (
    <div
      className={cn(
        "grid transition-all",
        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="overflow-hidden">
        <div className="px-4 pt-4">
          <CommentSection
            entryGuid={entryGuid}
            feedUrl={feedUrl}
            initialComments={initialComments}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CommentButton
        entryGuid={entryGuid}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        commentCount={initialCommentCount}
        isAuthenticated={isAuthenticated}
      />
      {mounted && createPortal(
        expandingSection,
        document.getElementById(`comments-${entryGuid}`) || document.body
      )}
    </>
  );
}