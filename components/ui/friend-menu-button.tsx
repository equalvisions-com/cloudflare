import { Button } from "@/components/ui/button";
import { Ellipsis, UserCheck, UserPlus, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Id } from "@/convex/_generated/dataModel";

interface MenuButtonProps {
  onClick?: () => void;
  className?: string;
  friendshipStatus?: string | null;
  friendshipDirection?: string | null;
  onAcceptFriend?: () => void;
  onUnfriend?: () => void;
  userId?: Id<"users"> | null;
}

export function MenuButton({ 
  onClick, 
  className,
  friendshipStatus,
  friendshipDirection,
  onAcceptFriend,
  onUnfriend,
  userId
}: MenuButtonProps) {
  // Special handling for self profile or when no status
  if (friendshipStatus === "self" || !friendshipStatus || !userId) {
    return (
      <Button
        onClick={onClick}
        size="icon"
        className={cn(
          "rounded-full bg-[hsl(var(--background))] border shadow-none hover:bg-accent",
          className
        )}
      >
        <Ellipsis className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

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
        {friendshipStatus === "pending" && friendshipDirection === "received" && (
          <>
            <DropdownMenuItem onClick={onAcceptFriend}>
              <UserCheck className="mr-2 h-4 w-4" />
              Accept Request
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUnfriend}>
              <UserX className="mr-2 h-4 w-4" />
              Decline Request
            </DropdownMenuItem>
          </>
        )}
        {friendshipStatus === "pending" && friendshipDirection === "sent" && (
          <DropdownMenuItem onClick={onUnfriend}>
            <UserX className="mr-2 h-4 w-4" />
            Cancel Request
          </DropdownMenuItem>
        )}
        {friendshipStatus === "accepted" && (
          <DropdownMenuItem onClick={onUnfriend}>
            <UserX className="mr-2 h-4 w-4" />
            Unfriend
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 