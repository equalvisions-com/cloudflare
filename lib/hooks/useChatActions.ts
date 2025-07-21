import { useCallback, useRef } from 'react';
import { useChatContext } from '@/lib/contexts/ChatContext';
import { ActiveButton, SelectionState, ChatMessage } from '@/lib/types';
import { type Message as UIMessage } from 'ai/react';
import { useToast } from '@/components/ui/use-toast';

export const useChatActions = () => {
  const {
    state: {
      activeButton,
      hasTyped,
      shouldAnimate,
      lastMessageId,
      likedMessages,
      dislikedMessages,
      activeTouchButton,
    },
    setActiveButton,
    setHasTyped,
    setShouldAnimate,
    setLastMessageId,
    setActiveTouchButton,
    toggleLikeMessage,
    toggleDislikeMessage,
    resetChat: contextResetChat,
  } = useChatContext();

  const { toast } = useToast();
  const selectionStateRef = useRef<SelectionState>({ start: null, end: null });

  // Safely attempt to vibrate if supported
  const safeVibrate = useCallback((pattern: number | number[]) => {
    try {
      if (typeof window !== 'undefined' && navigator?.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Silently fail if vibration is not supported
    }
  }, []);

  // Toggle button handler
  const toggleButton = useCallback((buttonType: ActiveButton) => {
    if (buttonType === activeButton) {
      setActiveButton("none");
    } else {
      setActiveButton(buttonType);
    }
    safeVibrate(50);
  }, [activeButton, setActiveButton, safeVibrate]);

  // Touch handlers
  const handleTouchStart = useCallback((buttonType: string) => {
    setActiveTouchButton(buttonType);
  }, [setActiveTouchButton]);

  const handleTouchEnd = useCallback(() => {
    setActiveTouchButton(null);
  }, [setActiveTouchButton]);

  // Selection state management
  const saveSelectionState = useCallback((textareaRef: React.RefObject<HTMLTextAreaElement | null>) => {
    if (textareaRef.current) {
      selectionStateRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  }, []);

  const restoreSelectionState = useCallback((textareaRef: React.RefObject<HTMLTextAreaElement | null>) => {
    if (textareaRef.current && selectionStateRef.current.start !== null && selectionStateRef.current.end !== null) {
      textareaRef.current.setSelectionRange(
        selectionStateRef.current.start,
        selectionStateRef.current.end
      );
    }
  }, []);

  // Input container click handler
  const handleInputContainerClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    inputContainerRef: React.RefObject<HTMLDivElement | null>,
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
  ) => {
    if (
      e.target === e.currentTarget ||
      (e.currentTarget === inputContainerRef.current && !(e.target as HTMLElement).closest("button"))
    ) {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, []);

  // Key down handler
  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    input: string,
    isLoading: boolean,
    onSubmit: () => void
  ) => {
    if (isLoading) return;

    // Handle Cmd+Enter on both mobile and desktop
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      if (input.trim()) {
        onSubmit();
      }
      return;
    }

    // Handle regular Enter key (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSubmit();
      }
    }
  }, []);

  // Input change handler
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLTextAreaElement>,
    textareaRef: React.RefObject<HTMLTextAreaElement | null>,
    originalHandler: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  ) => {
    const newValue = e.target.value;

    // Call the original handler
    originalHandler(e);

    // Update hasTyped state
    if (newValue.trim() !== "" && !hasTyped) {
      setHasTyped(true);
    } else if (newValue.trim() === "" && hasTyped) {
      setHasTyped(false);
    }

    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.max(24, Math.min(textarea.scrollHeight, 160));
      textarea.style.height = `${newHeight}px`;
    }
  }, [hasTyped, setHasTyped]);

  // Like/dislike handlers
  const handleLike = useCallback((messageId: string) => {
    safeVibrate(50);
    toggleLikeMessage(messageId);
  }, [safeVibrate, toggleLikeMessage]);

  const handleDislike = useCallback((messageId: string) => {
    safeVibrate(50);
    toggleDislikeMessage(messageId);
  }, [safeVibrate, toggleDislikeMessage]);

  // Reset chat handler
  const resetChat = useCallback((
    messages: UIMessage[],
    setMessages: (messages: UIMessage[]) => void,
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
  ) => {
    if (messages.length > 0) {
      safeVibrate(100);
      setShouldAnimate(false);
      
      setTimeout(() => {
        setMessages([]);
        contextResetChat();
        
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 300);
    }
  }, [safeVibrate, setShouldAnimate, contextResetChat]);

  // Topic click handler
  const handleTopicClick = useCallback((
    title: string,
    subtopic: string,
    textareaRef: React.RefObject<HTMLTextAreaElement | null>,
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  ) => {
    if (textareaRef.current) {
      const questionText = `Tell me about ${subtopic}.`;
      
      const e = {
        target: {
          value: questionText
        }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      handleInputChange(e);
      textareaRef.current.focus();
    }
  }, []);

  return {
    // State
    activeButton,
    hasTyped,
    shouldAnimate,
    lastMessageId,
    likedMessages,
    dislikedMessages,
    activeTouchButton,
    
    // Actions
    toggleButton,
    handleTouchStart,
    handleTouchEnd,
    saveSelectionState,
    restoreSelectionState,
    handleInputContainerClick,
    handleKeyDown,
    handleInputChange,
    handleLike,
    handleDislike,
    resetChat,
    handleTopicClick,
    setLastMessageId,
    setShouldAnimate,
    safeVibrate,
  };
}; 