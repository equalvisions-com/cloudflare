import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...props}
        className="w-full pl-9 rounded-full border shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none placeholder:text-muted-foreground"
        placeholder="Search"
      />
    </div>
  );
} 