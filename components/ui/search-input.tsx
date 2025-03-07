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

  const handleSubmit = () => {
    inputRef.current?.blur(); // Hide keyboard on submit
  };

  return (
    <div className="relative" onSubmit={handleSubmit}>
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
        inputMode="search"
        enterKeyHint="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full pl-9 pr-10 rounded-full border shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          className
        )}
        {...props}
      />
    </div>
  );
} 