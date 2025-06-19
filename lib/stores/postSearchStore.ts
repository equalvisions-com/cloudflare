import { create } from 'zustand';
import type { PostSearchState, PostSearchActions } from '@/lib/types';

type PostSearchStore = PostSearchState & PostSearchActions;

const initialState: PostSearchState = {
  searchQuery: '',
};

export const usePostSearchStore = create<PostSearchStore>((set, get) => ({
  ...initialState,
  
  setSearchQuery: (query: string) => {
    // Only update if the query actually changed to prevent unnecessary re-renders
    const currentQuery = get().searchQuery;
    if (currentQuery !== query) {
      set({ searchQuery: query });
    }
  },
  
  reset: () => {
    // Only reset if state is not already at initial values
    const currentState = get();
    if (currentState.searchQuery !== initialState.searchQuery) {
      set(initialState);
    }
  },
})); 