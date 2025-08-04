import { useReducer } from 'react';
import type { TabsState, TabsAction } from '@/lib/types';

// Reducer function
const tabsReducer = (state: TabsState, action: TabsAction): TabsState => {
  switch (action.type) {
    case 'SET_SELECTED_TAB':
      return { ...state, selectedTab: action.payload };
    case 'SET_TRANSITIONING':
      return { ...state, isTransitioning: action.payload };
    case 'SET_INTERACTING':
      return { ...state, isInteracting: action.payload };
    default:
      return state;
  }
};

// Custom hook for tabs state
export const useTabsState = (defaultTabIndex: number = 0) => {
  const initialState: TabsState = {
    selectedTab: defaultTabIndex,
    isTransitioning: false,
    isInteracting: false,
  };

  const [state, dispatch] = useReducer(tabsReducer, initialState);

  return { state, dispatch };
}; 