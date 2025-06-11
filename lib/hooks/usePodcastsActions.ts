import { useCallback } from 'react';
import { usePodcastsStore } from '@/lib/stores/podcastsStore';
import { PodcastItem } from '@/lib/types';

export const usePodcastsActions = () => {
  const { setItems, setSelectedCategory, setLoading, setError, reset } = usePodcastsStore();

  // Initialize podcasts data
  const initializePodcasts = useCallback(async (initialItems?: PodcastItem[]) => {
    if (initialItems) {
      setItems(initialItems);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // If no initial items provided, fetch from API
      const response = await fetch('/api/podcasts');
      if (!response.ok) {
        const errorMessage = response.status === 404 
          ? 'Podcasts service not found. Please try again later.'
          : response.status === 500
          ? 'Server error while loading podcasts. Please try again.'
          : response.status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : `Failed to load podcasts (Error ${response.status}). Please try again.`;
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      const items = data.items || [];
      
      if (items.length === 0) {
        setError('No podcasts available at the moment. Please check back later.');
        return;
      }
      
      setItems(items);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unable to load podcasts. Please check your internet connection and try again.';
      
      setError(errorMessage);
      
      // Error logging removed for production readiness
    } finally {
      setLoading(false);
    }
  }, [setItems, setLoading, setError]);

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