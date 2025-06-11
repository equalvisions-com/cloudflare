import { useEffect } from 'react';
import { usePostSearchStore } from '@/lib/stores/postSearchStore';

/**
 * Custom hook for PostSearchProvider functionality
 * Handles cleanup when the provider unmounts
 * Separates provider logic from component rendering
 */
export const usePostSearchProvider = () => {
  const reset = usePostSearchStore((state) => state.reset);

  // Cleanup search state when provider unmounts
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return {
    // Provider doesn't need to return anything for rendering
    // All state is managed by Zustand store
  };
}; 