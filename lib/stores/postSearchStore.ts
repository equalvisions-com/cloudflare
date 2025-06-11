import { create } from 'zustand';
import type { PostSearchState, PostSearchActions } from '@/lib/types';

type PostSearchStore = PostSearchState & PostSearchActions;

const initialState: PostSearchState = {
  searchQuery: '',
};

export const usePostSearchStore = create<PostSearchStore>((set) => ({
  ...initialState,
  
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },
  
  reset: () => {
    set(initialState);
  },
})); 