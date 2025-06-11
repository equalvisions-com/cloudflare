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
    set({ searchData: data });
  },
  
  setIsLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  
  setCurrentPage: (page: number) => {
    set({ currentPage: page });
  },
  
  appendSearchData: (newData: PostSearchRSSData) => {
    const { searchData } = get();
    if (searchData) {
      set({
        searchData: {
          entries: [...searchData.entries, ...newData.entries],
          totalEntries: newData.totalEntries || searchData.totalEntries,
          hasMore: newData.hasMore || false
        }
      });
    }
  },
  
  reset: () => {
    set(initialState);
  },
})); 