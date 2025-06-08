import { create } from 'zustand';
import { ChatState, ChatLoadingState, TouchState, ActiveButton } from '@/lib/types';

interface ChatStore extends ChatState, ChatLoadingState, TouchState {
  // Actions
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

const initialState = {
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

export const useChatStore = create<ChatStore>((set, get) => ({
  ...initialState,
  
  setActiveButton: (button) =>
    set({ activeButton: button }),
  
  setHasTyped: (hasTyped) =>
    set({ hasTyped }),
  
  setShouldAnimate: (shouldAnimate) =>
    set({ shouldAnimate }),
  
  setLastMessageId: (id) =>
    set({ lastMessageId: id }),
  
  setLoading: (loading) =>
    set((state) => ({
      isLoading: loading.isLoading ?? state.isLoading,
      isSubmitting: loading.isSubmitting ?? state.isSubmitting,
    })),
  
  setActiveTouchButton: (button) =>
    set({ activeTouchButton: button }),
  
  toggleLikeMessage: (messageId) =>
    set((state) => {
      const newLikedMessages = { ...state.likedMessages };
      const newDislikedMessages = { ...state.dislikedMessages };
      
      // Toggle like
      newLikedMessages[messageId] = !state.likedMessages[messageId];
      
      // Remove dislike if it was there
      if (newDislikedMessages[messageId]) {
        newDislikedMessages[messageId] = false;
      }
      
      return {
        likedMessages: newLikedMessages,
        dislikedMessages: newDislikedMessages,
      };
    }),
  
  toggleDislikeMessage: (messageId) =>
    set((state) => {
      const newLikedMessages = { ...state.likedMessages };
      const newDislikedMessages = { ...state.dislikedMessages };
      
      // Toggle dislike
      newDislikedMessages[messageId] = !state.dislikedMessages[messageId];
      
      // Remove like if it was there
      if (newLikedMessages[messageId]) {
        newLikedMessages[messageId] = false;
      }
      
      return {
        likedMessages: newLikedMessages,
        dislikedMessages: newDislikedMessages,
      };
    }),
  
  resetChat: () =>
    set({
      lastMessageId: null,
      likedMessages: {},
      dislikedMessages: {},
      shouldAnimate: false,
    }),
  
  reset: () => set(initialState),
})); 