'use client';

import { Button } from "@/components/ui/button";
import { Share } from "lucide-react";
import { useCallback, useState, memo, useRef, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ShareButtonProps {
  url: string;
  title: string;
  internalUrl?: string; // Optional internal URL that takes precedence for sharing
}

export const ShareButtonClientWithErrorBoundary = memo(function ShareButtonClientWithErrorBoundary(props: ShareButtonProps) {
  return (
    <ErrorBoundary>
      <ShareButtonClient {...props} />
    </ErrorBoundary>
  );
});

// Create the component implementation that will be memoized
const ShareButtonClientComponent = ({ url, title, internalUrl }: ShareButtonProps) => {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Use internalUrl if provided, otherwise fall back to url
  const shareUrl = internalUrl || url;

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      // Try native share API first (works on mobile and some desktop like macOS)
      if (navigator.share) {
        await navigator.share({
          title,
          url: shareUrl,
        });
        if (isMountedRef.current) {
          toast({
            description: "Shared successfully",
          });
        }
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        if (isMountedRef.current) {
          toast({
            description: "Link copied to clipboard",
          });
        }
      }
    } catch (error) {
      // Only show error if it's not a user cancellation
      if (isMountedRef.current && error instanceof Error && error.name !== 'AbortError') {
        toast({
          variant: "destructive",
          description: "Failed to share",
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsSharing(false);
      }
    }
  }, [shareUrl, title, toast, isSharing]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full"
      onClick={handleShare}
      disabled={isSharing}
      aria-label={`Share ${title}`}
    >
      <Share className="h-4 w-4 text-muted-foreground stroke-[2.5]" />
    </Button>
  );
};

// Export the memoized version of the component
export const ShareButtonClient = memo(ShareButtonClientComponent); 