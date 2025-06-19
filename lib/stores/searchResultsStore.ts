import { create } from 'zustand';
import type { PostSearchRSSData } from '@/lib/types';

interface SearchResultsState {
  searchData: PostSearchRSSData | null;
  isLoading: boolean;
  currentPage: number;
}

interface SearchResultsActions {
  setSearchData: (data: PostSearchRSSData | null) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentPage: (page: number) => void;
  appendSearchData: (newData: PostSearchRSSData) => void;
  reset: () => void;
}

type SearchResultsStore = SearchResultsState & SearchResultsActions;

const initialState: SearchResultsState = {
  searchData: null,
  isLoading: false,
  currentPage: 1,
};

export const useSearchResultsStore = create<SearchResultsStore>((set, get) => ({
  ...initialState,
  
  setSearchData: (data: PostSearchRSSData | null) => {
    const currentData = get().searchData;
    if (currentData !== data) {
      set({ searchData: data });
    }
  },
  
  setIsLoading: (loading: boolean) => {
    const currentLoading = get().isLoading;
    if (currentLoading !== loading) {
      set({ isLoading: loading });
    }
  },
  
  setCurrentPage: (page: number) => {
    const currentPage = get().currentPage;
    if (currentPage !== page) {
      set({ currentPage: page });
    }
  },
  
  appendSearchData: (newData: PostSearchRSSData) => {
    const { searchData } = get();
    if (searchData) {
      set({
        searchData: {
          entries: [...searchData.entries, ...newData.entries],
          totalEntries: newData.totalEntries || searchData.totalEntries,
          hasMore: newData.hasMore ?? false
        }
      });
    }
  },
  
  reset: () => {
    const currentState = get();
    const needsReset = 
      currentState.searchData !== initialState.searchData ||
      currentState.isLoading !== initialState.isLoading ||
      currentState.currentPage !== initialState.currentPage;
    
    if (needsReset) {
      set(initialState);
    }
  },
})); 