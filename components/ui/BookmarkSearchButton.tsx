"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface BookmarkSearchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function BookmarkSearchButton({ className, ...props }: BookmarkSearchButtonProps) {
  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center focus:outline-none", 
        className
      )}
      aria-label="Search bookmarks"
      {...props}
    >
      <Search className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
    </button>
  );
} 