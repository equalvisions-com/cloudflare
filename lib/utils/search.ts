/**
 * Search utility functions for managing search state and storage operations
 */

// Search category configuration
export interface SearchCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Search storage keys - centralized for consistency
export const SEARCH_STORAGE_KEYS = {
  QUERY: 'app_search_query',
  MEDIA_TYPE: 'app_search_mediaType',
  TIMESTAMP: 'app_search_timestamp',
  IS_NAVIGATION: 'app_is_navigation',
} as const;

/**
 * Check if sessionStorage is available
 * Handles private browsing and storage restrictions
 */
export const isSessionStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Store search query and metadata in sessionStorage
 * Batched operations for better performance
 */
export const storeSearchData = (query: string, mediaType?: string): void => {
  if (!isSessionStorageAvailable()) return;
  
  try {
    const timestamp = Date.now().toString();
    
    // Batch all storage operations
    sessionStorage.setItem(SEARCH_STORAGE_KEYS.QUERY, query);
    sessionStorage.setItem(SEARCH_STORAGE_KEYS.TIMESTAMP, timestamp);
    sessionStorage.setItem(SEARCH_STORAGE_KEYS.IS_NAVIGATION, 'true');
    
    if (mediaType) {
      sessionStorage.setItem(SEARCH_STORAGE_KEYS.MEDIA_TYPE, mediaType);
    } else {
      sessionStorage.removeItem(SEARCH_STORAGE_KEYS.MEDIA_TYPE);
    }
  } catch (error) {
    console.warn('Failed to store search data:', error);
  }
};

/**
 * Clear all search-related data from sessionStorage
 * Handles individual failures gracefully
 */
export const clearSearchData = (): void => {
  if (!isSessionStorageAvailable()) return;
  
  try {
    const keysToRemove = Object.values(SEARCH_STORAGE_KEYS);
    
    keysToRemove.forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Individual key removal failed, continue with others
      }
    });
  } catch (error) {
    console.warn('Failed to clear search data:', error);
  }
};

/**
 * Get the appropriate route for a search category
 */
export const getSearchRoute = (category: string): string => {
  switch (category) {
    case "newsletter":
      return "/newsletters";
    case "podcast":
      return "/podcasts";
    case "people":
      return "/users";
    default:
      return "/newsletters";
  }
};

/**
 * Format search query for API consumption
 */
export const formatSearchQuery = (category: string, query: string): string => {
  return `${category}:${query.trim()}`;
}; 