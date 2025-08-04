import { create } from 'zustand';
import { Id } from '@/convex/_generated/dataModel';
import { FeaturedPostsWidgetPost } from '@/lib/types';

interface FeaturedPostsStore {
  posts: FeaturedPostsWidgetPost[];
  followStates: Map<Id<"posts">, boolean>;
  lastFetchTime: number | null;
  isStale: () => boolean;
  setPosts: (posts: FeaturedPostsWidgetPost[]) => void;
  setFollowStates: (states: Map<Id<"posts">, boolean>) => void;
  clear: () => void;
}

const STALE_TIME = 60000; // 60 seconds (1 minute), matching TrendingWidget

export const useFeaturedPostsStore = create<FeaturedPostsStore>((set, get) => ({
  posts: [],
  followStates: new Map(),
  lastFetchTime: null,
  
  isStale: () => {
    const { lastFetchTime } = get();
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime > STALE_TIME;
  },
  
  setPosts: (posts) => set({ 
    posts, 
    lastFetchTime: Date.now() 
  }),
  
  setFollowStates: (followStates) => set({ 
    followStates, 
    lastFetchTime: Date.now() 
  }),
  
  clear: () => set({ 
    posts: [], 
    followStates: new Map(),
    lastFetchTime: null 
  }),
})); 