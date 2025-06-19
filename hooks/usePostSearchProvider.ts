import { useCallback } from 'react';
import { usePostSearchStore } from '@/lib/stores/postSearchStore';

/**
 * Custom hook for PostSearchProvider functionality
 * Separates provider logic from component rendering
 * Removed unnecessary cleanup - store persists across component lifecycles
 */
export const usePostSearchProvider = () => {
  const reset = usePostSearchStore((state) => state.reset);

  // Provide manual reset function if needed
  const manualReset = useCallback(() => {
    reset();
  }, [reset]);

  return {
    manualReset
  };
}; 