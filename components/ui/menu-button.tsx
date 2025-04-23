"use client";

import { Button } from "@/components/ui/button";
import { Ellipsis, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";

interface MenuButtonProps {
  onClick?: () => void;
  className?: string;
}

export function MenuButton({ onClick, className }: MenuButtonProps) {
  const { toast } = useToast();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          onClick={onClick}
          size="icon"
          variant="ghost"
          className={cn(
            "rounded-full bg-[hsl(var(--background))] shadow-none !hover:bg-transparent !hover:bg-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 active:ring-0 w-4 p-0 flex justify-end",
            className
          )}
          style={{ 
            backgroundColor: "hsl(var(--background))" 
          }}
        >
          <Ellipsis 
            width={18} 
            height={18} 
            className="text-muted-foreground" 
            strokeWidth={2} 
            style={{ minWidth: "18px", minHeight: "18px" }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-red-500 hover:text-red-600">
          <Flag className="mr-2 h-4 w-4" />
          Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 