import { Button } from "@/components/ui/button";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuButtonProps {
  onClick?: () => void;
  className?: string;
}

export function MenuButton({ onClick, className }: MenuButtonProps) {
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