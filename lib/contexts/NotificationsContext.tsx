"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { Id } from '@/convex/_generated/dataModel';

// State interface (matching the Zustand store)
interface NotificationsState {
  acceptingIds: Set<string>;
  decliningIds: Set<string>;
}

// Action types for useReducer
type NotificationsAction = 
  | { type: 'SET_ACCEPTING'; payload: { friendshipId: Id<"friends">; isAccepting: boolean } }
  | { type: 'SET_DECLINING'; payload: { friendshipId: Id<"friends">; isDeclining: boolean } }
  | { type: 'RESET' };

// Actions interface (matching the Zustand store API)
interface NotificationsActions {
  setAccepting: (friendshipId: Id<"friends">, isAccepting: boolean) => void;
  setDeclining: (friendshipId: Id<"friends">, isDeclining: boolean) => void;
  isAccepting: (friendshipId: Id<"friends">) => boolean;
  isDeclining: (friendshipId: Id<"friends">) => boolean;
  isLoading: (friendshipId: Id<"friends">) => boolean;
  reset: () => void;
}

// Context value interface
interface NotificationsContextValue extends NotificationsState, NotificationsActions {}

// Initial state
const createInitialState = (): NotificationsState => ({
  acceptingIds: new Set<string>(),
  decliningIds: new Set<string>(),
});

// Reducer function
function notificationsReducer(state: NotificationsState, action: NotificationsAction): NotificationsState {
  switch (action.type) {
    case 'SET_ACCEPTING': {
      const { friendshipId, isAccepting } = action.payload;
      const newAcceptingIds = new Set(state.acceptingIds);
      
      if (isAccepting) {
        newAcceptingIds.add(friendshipId);
      } else {
        newAcceptingIds.delete(friendshipId);
      }
      
      return {
        ...state,
        acceptingIds: newAcceptingIds,
      };
    }
    
    case 'SET_DECLINING': {
      const { friendshipId, isDeclining } = action.payload;
      const newDecliningIds = new Set(state.decliningIds);
      
      if (isDeclining) {
        newDecliningIds.add(friendshipId);
      } else {
        newDecliningIds.delete(friendshipId);
      }
      
      return {
        ...state,
        decliningIds: newDecliningIds,
      };
    }
    
    case 'RESET':
      return createInitialState();
    
    default:
      return state;
  }
}

// Create context
const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// Provider component
interface NotificationsProviderProps {
  children: React.ReactNode;
}

export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationsReducer, createInitialState());

  // Memoized action creators (same API as Zustand store)
  const setAccepting = useCallback((friendshipId: Id<"friends">, isAccepting: boolean) => {
    dispatch({ type: 'SET_ACCEPTING', payload: { friendshipId, isAccepting } });
  }, []);

  const setDeclining = useCallback((friendshipId: Id<"friends">, isDeclining: boolean) => {
    dispatch({ type: 'SET_DECLINING', payload: { friendshipId, isDeclining } });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Computed getters (same API as Zustand store)
  const isAccepting = useCallback((friendshipId: Id<"friends">) => {
    return state.acceptingIds.has(friendshipId);
  }, [state.acceptingIds]);

  const isDeclining = useCallback((friendshipId: Id<"friends">) => {
    return state.decliningIds.has(friendshipId);
  }, [state.decliningIds]);

  const isLoading = useCallback((friendshipId: Id<"friends">) => {
    return state.acceptingIds.has(friendshipId) || state.decliningIds.has(friendshipId);
  }, [state.acceptingIds, state.decliningIds]);

  // Memoized context value
  const contextValue = useMemo((): NotificationsContextValue => ({
    // State
    acceptingIds: state.acceptingIds,
    decliningIds: state.decliningIds,
    // Actions
    setAccepting,
    setDeclining,
    isAccepting,
    isDeclining,
    isLoading,
    reset,
  }), [
    state.acceptingIds,
    state.decliningIds,
    setAccepting,
    setDeclining,
    isAccepting,
    isDeclining,
    isLoading,
    reset,
  ]);

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
};

// Hook to use the context (same API as useNotificationStore)
export const useNotificationsContext = (): NotificationsContextValue => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return context;
}; 