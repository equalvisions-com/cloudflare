"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";

interface BookmarkSearchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function BookmarkSearchButton({ className, ...props }: BookmarkSearchButtonProps) {
  return (
    <Button 
      variant="secondary" 
      size="icon" 
      className={cn(
        "rounded-full p-0 shadow-none text-muted-foreground",
        className
      )}
      aria-label="Search bookmarks"
      style={{ width: '32px', height: '32px', minHeight: '32px', minWidth: '32px' }}
      {...props}
    >
      <Search className="h-4 w-4" strokeWidth={2.5} />
      <span className="sr-only">Search</span>
    </Button>
  );
}