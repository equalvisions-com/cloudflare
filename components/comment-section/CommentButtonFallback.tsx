"use client";

import { Button } from "@/components/ui/button";
import { CommentIcon } from "./icons";

export function CommentButtonFallback() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 relative"
      disabled
      aria-label="Loading comments..."
    >
      <CommentIcon className="h-5 w-5" />
    </Button>
  );
}