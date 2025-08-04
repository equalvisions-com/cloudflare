import { Mail, Podcast, Users } from "lucide-react";
import type { SearchCategory } from "@/lib/utils/search";

/**
 * Search category configuration
 * Centralized to ensure consistency across the application
 */
export const SEARCH_CATEGORIES: SearchCategory[] = [
  { 
    id: "newsletter", 
    label: "Newsletters", 
    icon: Mail 
  },
  { 
    id: "podcast", 
    label: "Podcasts", 
    icon: Podcast 
  },
  { 
    id: "people", 
    label: "Users", 
    icon: Users 
  },
];

/**
 * Search-related constants
 */
export const SEARCH_CONFIG = {
  // Minimum query length to show dropdown
  MIN_QUERY_LENGTH: 1,
  
  // Default active index (no selection)
  DEFAULT_ACTIVE_INDEX: -1,
  
  // Default route for general searches
  DEFAULT_SEARCH_ROUTE: "/newsletters",
} as const; 