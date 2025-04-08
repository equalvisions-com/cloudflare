"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";

interface PostSearchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  title?: string;
}

export function PostSearchButton({ className, title, ...props }: PostSearchButtonProps) {
  return (
    <Button 
      variant="secondary"
      size="icon" 
      className={cn(
        "p-0 shadow-none text-muted-foreground rounded-full",
        "md:hover:bg-transparent md:bg-transparent md:text-muted-foreground md:hover:text-muted-foreground md:rounded-none md:mr-[-0.5rem]",
        className
      )}
      aria-label={`Search ${title || 'content'}`}
      style={{ width: '36px', height: '36px', minHeight: '36px', minWidth: '36px' }}
      {...props}
    >
      <Search style={{ width: '18px', height: '18px' }} strokeWidth={2.25} />
      <span className="sr-only">Search</span>
    </Button>
  );
} 