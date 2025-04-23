import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchButtonProps {
  onClick?: () => void;
  className?: string;
}

export function SearchButton({ onClick, className }: SearchButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        "rounded-full bg-[hsl(var(--background))] shadow-none border hover:bg-accent w-9 h-9 p-0",
        className
      )}
    >
      <Search className="h-4 w-4 text-muted-foreground ml-auto" />
    </Button>
  );
} 