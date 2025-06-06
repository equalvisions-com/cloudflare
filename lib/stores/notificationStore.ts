import { create } from 'zustand';
import { Id } from '@/convex/_generated/dataModel';

interface NotificationStore {
  // Loading states
  acceptingIds: Set<string>;
  decliningIds: Set<string>;
  
  // Actions
  setAccepting: (friendshipId: Id<"friends">, isAccepting: boolean) => void;
  setDeclining: (friendshipId: Id<"friends">, isDeclining: boolean) => void;
  
  // Computed getters
  isAccepting: (friendshipId: Id<"friends">) => boolean;
  isDeclining: (friendshipId: Id<"friends">) => boolean;
  isLoading: (friendshipId: Id<"friends">) => boolean;
  
  // Reset actions
  reset: () => void;
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  // Initial state
  acceptingIds: new Set<string>(),
  decliningIds: new Set<string>(),
  
  // Actions
  setAccepting: (friendshipId: Id<"friends">, isAccepting: boolean) => {
    set((state) => {
      const newAcceptingIds = new Set(state.acceptingIds);
      if (isAccepting) {
        newAcceptingIds.add(friendshipId);
      } else {
        newAcceptingIds.delete(friendshipId);
      }
      return { acceptingIds: newAcceptingIds };
    });
  },
  
  setDeclining: (friendshipId: Id<"friends">, isDeclining: boolean) => {
    set((state) => {
      const newDecliningIds = new Set(state.decliningIds);
      if (isDeclining) {
        newDecliningIds.add(friendshipId);
      } else {
        newDecliningIds.delete(friendshipId);
      }
      return { decliningIds: newDecliningIds };
    });
  },
  
  // Computed getters
  isAccepting: (friendshipId: Id<"friends">) => {
    return get().acceptingIds.has(friendshipId);
  },
  
  isDeclining: (friendshipId: Id<"friends">) => {
    return get().decliningIds.has(friendshipId);
  },
  
  isLoading: (friendshipId: Id<"friends">) => {
    const state = get();
    return state.acceptingIds.has(friendshipId) || state.decliningIds.has(friendshipId);
  },
  
  // Reset action
  reset: () => {
    set({
      acceptingIds: new Set<string>(),
      decliningIds: new Set<string>(),
    });
  },
})); 