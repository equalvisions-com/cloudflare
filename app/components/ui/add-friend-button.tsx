import { Button } from "@/components/ui/button";
import { UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ButtonHTMLAttributes } from "react";

interface AddFriendButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function AddFriendButton({ className, ...props }: AddFriendButtonProps) {
  return (
    <Link href="/users">
      <Button
        variant="secondary"
        size="icon"
        className={cn(
          "rounded-full p-0 shadow-none text-muted-foreground",
          className
        )}
        aria-label="Find friends"
        style={{ width: '36px', height: '36px', minHeight: '36px', minWidth: '36px' }}
        {...props}
      >
        <UserSearch style={{ width: '18px', height: '18px' }} strokeWidth={2.25} />
        <span className="sr-only">Find friends</span>
      </Button>
    </Link>
  );
} 