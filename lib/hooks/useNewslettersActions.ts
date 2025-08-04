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

    // No API fallback needed - newsletters page always provides initial data via server-side getFeaturedNewsletters()
    setError('No newsletters data provided. This should not happen in normal usage.');
  }, [setItems, setError]);

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