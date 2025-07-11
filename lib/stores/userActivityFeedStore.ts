import { create } from 'zustand';
import { 
  ActivityFeedItem, 
  ActivityFeedRSSEntry, 
  ActivityFeedState,
  ActivityFeedAction 
} from '@/lib/types';

interface UserActivityFeedStore extends ActivityFeedState {
  // Actions
  setInitialData: (payload: { 
    activities: ActivityFeedItem[], 
    entryDetails: Record<string, ActivityFeedRSSEntry>, 
    hasMore: boolean 
  }) => void;
  startLoadingMore: () => void;
  loadMoreSuccess: (payload: { 
    activities: ActivityFeedItem[], 
    entryDetails: Record<string, ActivityFeedRSSEntry>, 
    hasMore: boolean 
  }) => void;
  loadMoreFailure: () => void;
  setInitialLoadComplete: () => void;
  reset: () => void;
}

const initialState: ActivityFeedState = {
  activities: [],
  isLoading: false,
  hasMore: false,
  entryDetails: {},
  currentSkip: 0,
  isInitialLoad: true,
};

export const useUserActivityFeedStore = create<UserActivityFeedStore>((set, get) => ({
  ...initialState,
  
  setInitialData: (payload) =>
    set({
      activities: payload.activities,
      entryDetails: payload.entryDetails,
      hasMore: payload.hasMore,
      currentSkip: payload.activities.length,
      isLoading: false,
      isInitialLoad: false,
    }),
  
  startLoadingMore: () =>
    set({ isLoading: true }),
  
  loadMoreSuccess: (payload) =>
    set((state) => ({
      activities: [...state.activities, ...payload.activities],
      entryDetails: { ...state.entryDetails, ...payload.entryDetails },
      hasMore: payload.hasMore,
      currentSkip: state.currentSkip + payload.activities.length,
      isLoading: false,
    })),
  
  loadMoreFailure: () =>
    set({ isLoading: false }),
  
  setInitialLoadComplete: () =>
    set({ isInitialLoad: false }),
  
  reset: () =>
    set(initialState),
})); 