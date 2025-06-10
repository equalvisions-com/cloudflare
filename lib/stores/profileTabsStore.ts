import { create } from 'zustand';
import { ProfileTabsState, ProfileTabsActions, ProfileFeedData } from '@/lib/types';

interface ProfileTabsStore extends ProfileTabsState, ProfileTabsActions {}

const initialState: ProfileTabsState = {
  selectedTabIndex: 0,
  likesData: null,
  likesStatus: 'idle',
  likesError: null,
  isPending: false,
};

export const useProfileTabsStore = create<ProfileTabsStore>((set) => ({
  ...initialState,
  
  setSelectedTabIndex: (index) =>
    set({ selectedTabIndex: index }),
  
  setLikesData: (data) =>
    set({ likesData: data }),
  
  setLikesStatus: (status) =>
    set({ likesStatus: status }),
  
  setLikesError: (error) =>
    set({ likesError: error }),
  
  setIsPending: (pending) =>
    set({ isPending: pending }),
  
  resetLikes: () =>
    set({ 
      likesData: null, 
      likesStatus: 'idle', 
      likesError: null 
    }),
  
  reset: () =>
    set(initialState),
})); 