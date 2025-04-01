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
        "inline-flex items-center justify-center rounded-full p-2 text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none", 
        className
      )}
      aria-label="Search bookmarks"
      {...props}
    >
      <Search className="h-4 w-4" />
    </button>
  );
} 