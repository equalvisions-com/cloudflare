"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react';
import { ActiveButton } from '@/lib/types';

// State interfaces
interface ChatState {
  activeButton: ActiveButton;
  hasTyped: boolean;
  shouldAnimate: boolean;
  lastMessageId: string | null;
  likedMessages: Record<string, boolean>;
  dislikedMessages: Record<string, boolean>;
}

interface ChatLoadingState {
  isLoading: boolean;
  isSubmitting: boolean;
}

interface TouchState {
  activeTouchButton: string | null;
}

interface ChatContextState extends ChatState, ChatLoadingState, TouchState {}

// Action types
type ChatAction =
  | { type: 'SET_ACTIVE_BUTTON'; payload: ActiveButton }
  | { type: 'SET_HAS_TYPED'; payload: boolean }
  | { type: 'SET_SHOULD_ANIMATE'; payload: boolean }
  | { type: 'SET_LAST_MESSAGE_ID'; payload: string | null }
  | { type: 'SET_LOADING'; payload: Partial<ChatLoadingState> }
  | { type: 'SET_ACTIVE_TOUCH_BUTTON'; payload: string | null }
  | { type: 'TOGGLE_LIKE_MESSAGE'; payload: string }
  | { type: 'TOGGLE_DISLIKE_MESSAGE'; payload: string }
  | { type: 'RESET_CHAT' }
  | { type: 'RESET_ALL' };

// Context value interface
interface ChatContextValue {
  state: ChatContextState;
  dispatch: React.Dispatch<ChatAction>;
  // Memoized actions
  setActiveButton: (button: ActiveButton) => void;
  setHasTyped: (hasTyped: boolean) => void;
  setShouldAnimate: (shouldAnimate: boolean) => void;
  setLastMessageId: (id: string | null) => void;
  setLoading: (loading: Partial<ChatLoadingState>) => void;
  setActiveTouchButton: (button: string | null) => void;
  toggleLikeMessage: (messageId: string) => void;
  toggleDislikeMessage: (messageId: string) => void;
  resetChat: () => void;
  reset: () => void;
}

// Initial state
const initialChatState: ChatContextState = {
  // Chat state
  activeButton: 'newsletters' as ActiveButton,
  hasTyped: false,
  shouldAnimate: false,
  lastMessageId: null,
  likedMessages: {},
  dislikedMessages: {},
  
  // Loading state
  isLoading: false,
  isSubmitting: false,
  
  // Touch state
  activeTouchButton: null,
};

// Reducer function
const chatReducer = (state: ChatContextState, action: ChatAction): ChatContextState => {
  switch (action.type) {
    case 'SET_ACTIVE_BUTTON':
      return { ...state, activeButton: action.payload };
    
    case 'SET_HAS_TYPED':
      return { ...state, hasTyped: action.payload };
    
    case 'SET_SHOULD_ANIMATE':
      return { ...state, shouldAnimate: action.payload };
    
    case 'SET_LAST_MESSAGE_ID':
      return { ...state, lastMessageId: action.payload };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading ?? state.isLoading,
        isSubmitting: action.payload.isSubmitting ?? state.isSubmitting,
      };
    
    case 'SET_ACTIVE_TOUCH_BUTTON':
      return { ...state, activeTouchButton: action.payload };
    
    case 'TOGGLE_LIKE_MESSAGE': {
      const messageId = action.payload;
      const newLikedMessages = { ...state.likedMessages };
      const newDislikedMessages = { ...state.dislikedMessages };
      
      // Toggle like
      newLikedMessages[messageId] = !state.likedMessages[messageId];
      
      // Remove dislike if it was there
      if (newDislikedMessages[messageId]) {
        newDislikedMessages[messageId] = false;
      }
      
      return {
        ...state,
        likedMessages: newLikedMessages,
        dislikedMessages: newDislikedMessages,
      };
    }
    
    case 'TOGGLE_DISLIKE_MESSAGE': {
      const messageId = action.payload;
      const newLikedMessages = { ...state.likedMessages };
      const newDislikedMessages = { ...state.dislikedMessages };
      
      // Toggle dislike
      newDislikedMessages[messageId] = !state.dislikedMessages[messageId];
      
      // Remove like if it was there
      if (newLikedMessages[messageId]) {
        newLikedMessages[messageId] = false;
      }
      
      return {
        ...state,
        likedMessages: newLikedMessages,
        dislikedMessages: newDislikedMessages,
      };
    }
    
    case 'RESET_CHAT':
      return {
        ...state,
        lastMessageId: null,
        likedMessages: {},
        dislikedMessages: {},
        shouldAnimate: false,
      };
    
    case 'RESET_ALL':
      return initialChatState;
    
    default:
      return state;
  }
};

// Create context
const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Provider component
interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider = React.memo(({ children }: ChatProviderProps) => {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  
  // Memoized action creators
  const setActiveButton = useCallback((button: ActiveButton) => {
    dispatch({ type: 'SET_ACTIVE_BUTTON', payload: button });
  }, []);
  
  const setHasTyped = useCallback((hasTyped: boolean) => {
    dispatch({ type: 'SET_HAS_TYPED', payload: hasTyped });
  }, []);
  
  const setShouldAnimate = useCallback((shouldAnimate: boolean) => {
    dispatch({ type: 'SET_SHOULD_ANIMATE', payload: shouldAnimate });
  }, []);
  
  const setLastMessageId = useCallback((id: string | null) => {
    dispatch({ type: 'SET_LAST_MESSAGE_ID', payload: id });
  }, []);
  
  const setLoading = useCallback((loading: Partial<ChatLoadingState>) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);
  
  const setActiveTouchButton = useCallback((button: string | null) => {
    dispatch({ type: 'SET_ACTIVE_TOUCH_BUTTON', payload: button });
  }, []);
  
  const toggleLikeMessage = useCallback((messageId: string) => {
    dispatch({ type: 'TOGGLE_LIKE_MESSAGE', payload: messageId });
  }, []);
  
  const toggleDislikeMessage = useCallback((messageId: string) => {
    dispatch({ type: 'TOGGLE_DISLIKE_MESSAGE', payload: messageId });
  }, []);
  
  const resetChat = useCallback(() => {
    dispatch({ type: 'RESET_CHAT' });
  }, []);
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET_ALL' });
  }, []);
  
  // Memoize context value
  const contextValue = useMemo((): ChatContextValue => ({
    state,
    dispatch,
    setActiveButton,
    setHasTyped,
    setShouldAnimate,
    setLastMessageId,
    setLoading,
    setActiveTouchButton,
    toggleLikeMessage,
    toggleDislikeMessage,
    resetChat,
    reset,
  }), [
    state,
    setActiveButton,
    setHasTyped,
    setShouldAnimate,
    setLastMessageId,
    setLoading,
    setActiveTouchButton,
    toggleLikeMessage,
    toggleDislikeMessage,
    resetChat,
    reset,
  ]);
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
});

ChatProvider.displayName = 'ChatProvider';

// Hook to use the context
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}; 