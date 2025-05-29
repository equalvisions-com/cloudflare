"use client";

import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Share } from "lucide-react";

interface ShareButtonProps {
  onClick?: () => void;
  className?: string;
  shareUrl?: string;
  children?: React.ReactNode;
}

export const ShareButton = React.memo(function ShareButton({ 
  onClick, 
  className, 
  shareUrl, 
  children 
}: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    
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
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      // Silently handle errors
      console.error("Share failed:", error);
    } finally {
      setIsSharing(false);
    }
  }, [shareUrl, isSharing, onClick]);

  return (
    <Button
      onClick={handleShare}
      disabled={isSharing}
      className={cn(
        "rounded-lg bg-[hsl(var(--background))] border shadow-none hover:bg-accent focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none text-muted-foreground hover:text-primary font-semibold",
        className
      )}
    >
      {children || (
        <>
          <Share className="h-4 w-4" />
          Share
        </>
      )}
    </Button>
  );
}); 