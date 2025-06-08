import { create } from 'zustand';
import { UsersState } from '@/lib/types';

interface UsersStore extends UsersState {
  // Actions
  setSearchQuery: (query: string) => void;
  setPendingSearchQuery: (query: string) => void;
  setIsSearching: (searching: boolean) => void;
  resetSearch: () => void;
}

const initialState: UsersState = {
  searchQuery: '',
  pendingSearchQuery: '',
  isSearching: false,
};

export const useUsersStore = create<UsersStore>((set) => ({
  ...initialState,
  
  setSearchQuery: (query) =>
    set({ searchQuery: query }),
  
  setPendingSearchQuery: (query) =>
    set({ pendingSearchQuery: query }),
  
  setIsSearching: (searching) =>
    set({ isSearching: searching }),
  
  resetSearch: () =>
    set(initialState),
})); 