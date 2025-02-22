'use client';

import { Button } from "@/components/ui/button";
import { Share } from "lucide-react";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface ShareButtonProps {
  url: string;
  title: string;
}

export function ShareButtonClient({ url, title }: ShareButtonProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      // Try native share API first (works on mobile and some desktop like macOS)
      if (navigator.share) {
        await navigator.share({
          title,
          url,
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
  }, [url, title, toast, isSharing]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      onClick={handleShare}
      disabled={isSharing}
    >
      <Share className="h-4 w-4 p-0" />
    </Button>
  );
} 