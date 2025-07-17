import { useCallback } from 'react';
import { useNewslettersContext } from '@/lib/contexts/NewslettersContext';
import { NewsletterItem } from '@/lib/types';

export const useNewslettersActions = () => {
  const { setItems, setSelectedCategory, setLoading, setError, reset } = useNewslettersContext();

  // Initialize newsletters data
  const initializeNewsletters = useCallback(async (initialItems?: NewsletterItem[]) => {
    if (initialItems) {
      setItems(initialItems);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // If no initial items provided, fetch from API
      const response = await fetch('/api/newsletters');
      if (!response.ok) {
        const errorMessage = response.status === 404 
          ? 'Newsletters service not found. Please try again later.'
          : response.status === 500
          ? 'Server error while loading newsletters. Please try again.'
          : response.status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : `Failed to load newsletters (Error ${response.status}). Please try again.`;
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      const items = data.items || [];
      
      if (items.length === 0) {
        setError('No newsletters available at the moment. Please check back later.');
        return;
      }
      
      setItems(items);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unable to load newsletters. Please check your internet connection and try again.';
      
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
  const resetNewsletters = useCallback(() => {
    reset();
  }, [reset]);

  // Refresh newsletters data with user feedback
  const refreshNewsletters = useCallback(async () => {
    setError(null); // Clear any existing errors
    await initializeNewsletters();
  }, [initializeNewsletters, setError]);

  return {
    initializeNewsletters,
    handleCategoryChange,
    resetNewsletters,
    refreshNewsletters,
  };
}; 