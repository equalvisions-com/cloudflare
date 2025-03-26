"use client";

import { Button } from "@/components/ui/button";
import { Ellipsis, Share, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface MenuButtonProps {
  onClick?: () => void;
  className?: string;
  shareUrl?: string;
}

export function MenuButton({ onClick, className, shareUrl }: MenuButtonProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    // Prevent the dropdown from closing
    e.preventDefault();
    e.stopPropagation();
    
    if (isSharing) return;
    setIsSharing(true);

    try {
      const url = shareUrl || window.location.href;
      const shareTitle = "Check out this post";

      // Try native share API first (works on mobile and some desktop like macOS)
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          url: url,
        });
        toast({
          description: "Shared successfully",
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        toast({
          description: "Link copied to clipboard",
        });
      }
    } catch (error) {
      // Only show error if it's not a user cancellation
      if (error instanceof Error && error.name !== 'AbortError') {
        toast({
          variant: "destructive",
          description: "Failed to share",
        });
      }
    } finally {
      setIsSharing(false);
    }
  }, [shareUrl, toast, isSharing]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          onClick={onClick}
          size="icon"
          className={cn(
            "rounded-full bg-[hsl(var(--background))] border shadow-none hover:bg-accent focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none",
            className
          )}
        >
          <Ellipsis className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={handleShare} disabled={isSharing}>
          <Share className="mr-2 h-4 w-4" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-500 hover:text-red-600">
          <Flag className="mr-2 h-4 w-4" />
          Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 