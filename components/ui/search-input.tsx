import { Input } from "@/components/ui/input";
import { Search, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  onKeyDown,
  onClear,
  placeholder = "Search...",
  className,
  ...props
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <XCircle className="h-4 w-4 text-muted-foreground hover:text-foreground mr-1" />
        </button>
      )}
      <Input
        ref={inputRef}
        type="search"
        role="searchbox"
        enterKeyHint="search"
        inputMode="search"
        maxLength={100}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        returnKeyType="search"
        className={cn(
          "w-full pl-9 pr-10 rounded-full border shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          className
        )}
        {...props}
      />
    </div>
  );
} 