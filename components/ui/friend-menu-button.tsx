import { Button } from "@/components/ui/button";
import { Ellipsis, Share } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Id } from "@/convex/_generated/dataModel";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface MenuButtonProps {
  onClick?: () => void;
  className?: string;
  userId?: Id<"users"> | null;
  profileUrl?: string;
}

export function MenuButton({ 
  onClick, 
  className,
  userId,
  profileUrl
}: MenuButtonProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const handleShareProfile = useCallback(async (e: React.MouseEvent) => {
    // Prevent the dropdown from closing
    e.preventDefault();
    e.stopPropagation();
    
    if (isSharing) return;
    setIsSharing(true);

    try {
      const shareUrl = profileUrl || window.location.href;
      const shareTitle = "Check out this profile";

      // Try native share API first (works on mobile and some desktop like macOS)
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          url: shareUrl,
        });
        toast({
          description: "Shared successfully",
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast({
          description: "Profile link copied to clipboard",
        });
      }
    } catch (error) {
      // Only show error if it's not a user cancellation
      if (error instanceof Error && error.name !== 'AbortError') {
        toast({
          variant: "destructive",
          description: "Failed to share profile",
        });
      }
    } finally {
      setIsSharing(false);
    }
  }, [profileUrl, toast, isSharing]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className={cn(
            "rounded-full bg-[hsl(var(--background))] border shadow-none hover:bg-accent",
            className
          )}
        >
          <Ellipsis className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={handleShareProfile} disabled={isSharing}>
          <Share className="mr-2 h-4 w-4" />
          Share Profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 