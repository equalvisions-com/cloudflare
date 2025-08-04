import { useCallback } from 'react';
import { usePodcastsContext } from '@/lib/contexts/PodcastsContext';
import { PodcastItem } from '@/lib/types';

export const usePodcastsActions = () => {
  const { setItems, setSelectedCategory, setLoading, setError, reset } = usePodcastsContext();

  // Initialize podcasts data
  const initializePodcasts = useCallback(async (initialItems?: PodcastItem[]) => {
    if (initialItems) {
      setItems(initialItems);
      return;
    }

    // No API fallback needed - podcasts page always provides initial data via server-side getFeaturedPodcasts()
    setError('No podcasts data provided. This should not happen in normal usage.');
  }, [setItems, setError]);

  // Handle category selection
  const handleCategoryChange = useCallback((category: string | null) => {
    setSelectedCategory(category);
  }, [setSelectedCategory]);

  // Reset store state
  const resetPodcasts = useCallback(() => {
    reset();
  }, [reset]);

  // Refresh podcasts data with user feedback
  const refreshPodcasts = useCallback(async () => {
    setError(null); // Clear any existing errors
    await initializePodcasts();
  }, [initializePodcasts, setError]);

  return {
    initializePodcasts,
    handleCategoryChange,
    resetPodcasts,
    refreshPodcasts,
  };
}; 