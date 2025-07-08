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
  displayName?: string; // Optional display name for the share title
  shareText?: string;
  imageUrl?: string;
}

export const ShareButton = React.memo(function ShareButton({ 
  onClick, 
  className, 
  shareUrl, 
  children,
  displayName,
  shareText,
  imageUrl
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
      const shareTitle = displayName ? `${displayName} on FocusFix` : "Check out this post on FocusFix";
      
      const shareData: ShareData = {
        title: shareTitle,
        url: url,
        text: shareText
      };

      if (imageUrl) {
        try {
          const response = await fetch(imageUrl);
          if (response.ok) {
            const blob = await response.blob();
            const fileExtension = blob.type.split('/')[1] || 'png';
            const fileName = `image.${fileExtension}`;
            const file = new File([blob], fileName, { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              shareData.files = [file];
            }
          }
        } catch (error) {
          console.error("Could not fetch image for sharing:", error);
          // Fail silently, share will proceed without the image
        }
      }

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      // Silently handle errors
    } finally {
      setIsSharing(false);
    }
  }, [shareUrl, isSharing, onClick, displayName, shareText, imageUrl]);

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