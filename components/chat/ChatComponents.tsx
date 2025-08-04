'use client';

import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { 
  ArrowUp, 
  ThumbsUp, 
  ThumbsDown, 
  Mail, 
  Podcast, 
  Newspaper, 
  SquarePen 
} from 'lucide-react';
import { ActiveButton } from '@/lib/types';

// Memoized typing indicator
export const TypingIndicator = memo(() => (
  <div className="flex space-x-1">
    <div className="animate-bounce h-1.5 w-1.5 bg-muted-foreground rounded-full delay-0"></div>
    <div className="animate-bounce h-1.5 w-1.5 bg-muted-foreground rounded-full delay-150"></div>
    <div className="animate-bounce h-1.5 w-1.5 bg-muted-foreground rounded-full delay-300"></div>
  </div>
));
TypingIndicator.displayName = 'TypingIndicator';

// Memoized message actions
interface MessageActionsProps {
  messageId: string;
  likedMessages: Record<string, boolean>;
  dislikedMessages: Record<string, boolean>;
  onLike: (messageId: string) => void;
  onDislike: (messageId: string) => void;
}

export const MessageActions = memo(({ 
  messageId, 
  likedMessages, 
  dislikedMessages, 
  onLike, 
  onDislike 
}: MessageActionsProps) => {
  const handleLike = useCallback(() => {
    onLike(messageId);
  }, [onLike, messageId]);

  const handleDislike = useCallback(() => {
    onDislike(messageId);
  }, [onDislike, messageId]);

  return (
    <div className="flex items-center gap-1 mt-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full hover:bg-muted"
        title="Like"
        onClick={handleLike}
      >
        <ThumbsUp className={`h-3.5 w-3.5 ${likedMessages[messageId] ? 'fill-current text-primary' : 'text-muted-foreground'}`} />
        <span className="sr-only">Like</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full hover:bg-muted"
        title="Dislike"
        onClick={handleDislike}
      >
        <ThumbsDown className={`h-3.5 w-3.5 ${dislikedMessages[messageId] ? 'fill-current text-primary' : 'text-muted-foreground'}`} />
        <span className="sr-only">Dislike</span>
      </Button>
    </div>
  );
});
MessageActions.displayName = 'MessageActions';

// Memoized filter button
interface FilterButtonProps {
  type: ActiveButton;
  activeButton: ActiveButton;
  activeTouchButton: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onToggle: (type: ActiveButton) => void;
  onTouchStart: (type: string) => void;
  onTouchEnd: () => void;
}

export const FilterButton = memo(({ 
  type, 
  activeButton, 
  activeTouchButton, 
  isAuthenticated, 
  isLoading, 
  onToggle, 
  onTouchStart, 
  onTouchEnd 
}: FilterButtonProps) => {
  const handleClick = useCallback(() => {
    onToggle(type);
  }, [onToggle, type]);

  const handleTouchStart = useCallback(() => {
    onTouchStart(type);
  }, [onTouchStart, type]);

  const getIcon = () => {
    switch (type) {
      case 'newsletters':
        return <Mail className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === type && "text-primary-foreground")} />;
      case 'podcasts':
        return <Podcast className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === type && "text-primary-foreground")} />;
      case 'articles':
        return <Newspaper className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === type && "text-primary-foreground")} />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'newsletters':
        return 'Newsletters';
      case 'podcasts':
        return 'Podcasts';
      case 'articles':
        return 'Articles';
      default:
        return '';
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "chat-filter-button rounded-full h-8 px-3 flex items-center gap-1.5 shrink-0 hover:bg-primary hover:text-primary-foreground group shadow-none bg-background/60 transition-none border disabled:opacity-100",
        activeButton === type && "bg-primary text-primary-foreground",
        activeTouchButton === type && activeButton !== type && "bg-background/80",
        !isAuthenticated && "opacity-50 cursor-not-allowed"
      )}
      data-state={activeButton === type ? "active" : "inactive"}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      disabled={isLoading || !isAuthenticated}
    >
      {getIcon()}
      <span className={cn("text-foreground text-sm group-hover:text-primary-foreground transition-none", activeButton === type && "font-medium text-primary-foreground")}>
        {getLabel()}
      </span>
    </Button>
  );
});
FilterButton.displayName = 'FilterButton';

// Memoized submit button
interface SubmitButtonProps {
  input: string;
  isLoading: boolean;
  activeButton: ActiveButton;
  isAuthenticated: boolean;
}

export const SubmitButton = memo(({ 
  input, 
  isLoading, 
  activeButton, 
  isAuthenticated 
}: SubmitButtonProps) => (
  <Button
    type="submit"
    size="icon"
    disabled={!input.trim() || isLoading || activeButton === "none" || !isAuthenticated}
    className={cn(
      "rounded-full h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0",
      (!input.trim() || activeButton === "none" || !isAuthenticated) && "opacity-50 cursor-not-allowed",
      isLoading && "opacity-100 cursor-not-allowed"
    )}
  >
    <ArrowUp className="h-4 w-4" />
    <span className="sr-only">Send</span>
  </Button>
));
SubmitButton.displayName = 'SubmitButton';

// Memoized reset button
interface ResetButtonProps {
  isLoading: boolean;
  hasMessages: boolean;
  onReset: () => void;
}

export const ResetButton = memo(({ 
  isLoading, 
  hasMessages, 
  onReset 
}: ResetButtonProps) => (
  <Button
    variant="secondary" 
    size="icon"
    onClick={onReset}
    className="rounded-full w-[36px] h-[36px] p-0 shadow-none text-muted-foreground md:hover:bg-transparent md:bg-transparent md:text-muted-foreground md:hover:text-muted-foreground md:rounded-none md:mr-[-0.5rem]"
    style={{ width: '36px', height: '36px', minHeight: '32px', minWidth: '32px' }}
    title="Reset Chat"
    disabled={isLoading || !hasMessages}
  >
    <SquarePen className="!h-[18px] !w-[18px]" strokeWidth={2.25} />
    <span className="sr-only">Reset Chat</span>
  </Button>
));
ResetButton.displayName = 'ResetButton';

// Memoized textarea component
interface ChatTextareaProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
}

export const ChatTextarea = memo(({ 
  textareaRef, 
  placeholder, 
  value, 
  onChange, 
  onKeyDown, 
  disabled 
}: ChatTextareaProps) => (
  <Textarea
    ref={textareaRef}
    placeholder={placeholder}
    className="min-h-[24px] max-h-[160px] w-full rounded-3xl border-0 bg-transparent text-foreground placeholder:text-muted-foreground placeholder:text-base focus-visible:ring-0 focus-visible:ring-offset-0 text-base pl-2 pr-4 pt-0 pb-0 resize-none overflow-y-auto leading-tight disabled:opacity-100"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    disabled={disabled}
  />
));
ChatTextarea.displayName = 'ChatTextarea'; 