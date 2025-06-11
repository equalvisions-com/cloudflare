import { create } from 'zustand';
import { 
  UserLikesActivityItem, 
  UserLikesRSSEntry, 
  InteractionStates 
} from '@/lib/types';

interface UserLikesFeedState {
  activities: UserLikesActivityItem[];
  isLoading: boolean;
  hasMore: boolean;
  entryDetails: Record<string, UserLikesRSSEntry>;
  currentSkip: number;
  isInitialLoad: boolean;
  // Comment drawer state
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
}

interface UserLikesFeedStore extends UserLikesFeedState {
  // Actions
  setInitialData: (payload: { 
    activities: UserLikesActivityItem[], 
    entryDetails: Record<string, UserLikesRSSEntry>, 
    hasMore: boolean 
  }) => void;
  startLoadingMore: () => void;
  loadMoreSuccess: (payload: { 
    activities: UserLikesActivityItem[], 
    entryDetails: Record<string, UserLikesRSSEntry>, 
    hasMore: boolean 
  }) => void;
  loadMoreFailure: () => void;
  setInitialLoadComplete: () => void;
  setCurrentSkip: (skip: number) => void;
  // Comment drawer actions
  setCommentDrawerOpen: (open: boolean) => void;
  setSelectedCommentEntry: (entry: UserLikesFeedState['selectedCommentEntry']) => void;
  reset: () => void;
}

const initialState: UserLikesFeedState = {
  activities: [],
  isLoading: false,
  hasMore: false,
  entryDetails: {},
  currentSkip: 0,
  isInitialLoad: true,
  commentDrawerOpen: false,
  selectedCommentEntry: null,
};

export const useUserLikesFeedStore = create<UserLikesFeedStore>((set, get) => ({
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
  
  setCurrentSkip: (skip) =>
    set({ currentSkip: skip }),
  
  setCommentDrawerOpen: (open) =>
    set({ commentDrawerOpen: open }),
  
  setSelectedCommentEntry: (entry) =>
    set({ selectedCommentEntry: entry }),
  
  reset: () =>
    set(initialState),
})); 