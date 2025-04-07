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
        "p-0 shadow-none text-muted-foreground rounded-full",
        "md:hover:bg-transparent md:bg-transparent md:text-muted-foreground md:hover:text-muted-foreground md:rounded-none md:mr-[-0.5rem]",
        className
      )}
      aria-label="Search bookmarks"
      style={{ width: '36px', height: '36px', minHeight: '36px', minWidth: '36px' }}
      {...props}
    >
      <Search style={{ width: '18px', height: '18px' }} strokeWidth={2.25} />
      <span className="sr-only">Search</span>
    </Button>
  );
}