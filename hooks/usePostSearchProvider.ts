import { useCallback } from 'react';
import { usePostSearchContext } from '@/lib/contexts/PostSearchContext';

/**
 * Custom hook for PostSearchProvider functionality
 * Separates provider logic from component rendering
 * Migrated from Zustand to React Context + useReducer for better React/Next.js practices
 */
export const usePostSearchProvider = () => {
  const { actions } = usePostSearchContext();

  // Provide manual reset function if needed
  const manualReset = useCallback(() => {
    actions.reset();
  }, [actions.reset]);

  return {
    manualReset
  };
}; 