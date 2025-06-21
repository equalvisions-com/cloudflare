import { create } from 'zustand';
import { TrendingWidgetRSSEntry } from '@/lib/types';

interface TrendingStore {
  rssEntries: Record<string, TrendingWidgetRSSEntry>;
  lastFetchTime: number | null;
  isStale: () => boolean;
  setRssEntries: (entries: Record<string, TrendingWidgetRSSEntry>) => void;
  clear: () => void;
}

const STALE_TIME = 60000; // 60 seconds (1 minute), updated from 30 seconds

export const useTrendingStore = create<TrendingStore>((set, get) => ({
  rssEntries: {},
  lastFetchTime: null,
  
  isStale: () => {
    const { lastFetchTime } = get();
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime > STALE_TIME;
  },
  
  setRssEntries: (entries) => set({ 
    rssEntries: entries, 
    lastFetchTime: Date.now() 
  }),
  
  clear: () => set({ 
    rssEntries: {}, 
    lastFetchTime: null 
  }),
})); 