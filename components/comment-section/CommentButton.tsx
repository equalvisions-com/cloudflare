"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { CommentIcon } from "./icons";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface CommentButtonProps {
  entryGuid: string;
  isExpanded: boolean;
  onToggle: () => void;
  commentCount: number; // server-provided initial count
  isAuthenticated: boolean;
}

export function CommentButton({
  entryGuid,
  isExpanded,
  onToggle,
  commentCount: initialCount,
  isAuthenticated,
}: CommentButtonProps) {
  const router = useRouter();

  // Fetch real-time comment count from Convex
  const liveCount = useQuery(api.comments.getCommentCount, { entryGuid });
  const count = liveCount !== undefined ? liveCount : initialCount;

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    onToggle();
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="h-8 flex items-center gap-1 px-2 disabled:opacity-100"
      aria-expanded={isExpanded}
      aria-label={`${count} comments`}
    >
      <CommentIcon className="h-5 w-5" />
      <span className="text-xs min-w-[1rem] text-center">
        {count}
      </span>
    </Button>
  );
}