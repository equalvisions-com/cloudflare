import { useEffect, useCallback, useMemo, useRef } from "react";
import { storeSearchData, clearSearchData, isSessionStorageAvailable } from "@/lib/utils/search";

/**
 * Custom hook for outside click detection
 * Reusable across components that need dropdown/modal behavior
 */
export const useOutsideClick = (
  ref: React.RefObject<HTMLElement>, 
  callback: () => void,
  isActive: boolean = true
) => {
  useEffect(() => {
    if (!isActive) return;
    
    const handleOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [ref, callback, isActive]);
};

/**
 * Custom hook for optimized sessionStorage operations
 * Handles storage availability and provides memoized operations
 */
export const useSearchStorage = () => {
  // Check storage availability once and memoize result
  const isStorageAvailable = useMemo(() => isSessionStorageAvailable(), []);
  
  const storeSearch = useCallback((query: string, mediaType?: string) => {
    if (!isStorageAvailable) return;
    storeSearchData(query, mediaType);
  }, [isStorageAvailable]);
  
  const clearSearch = useCallback(() => {
    if (!isStorageAvailable) return;
    clearSearchData();
  }, [isStorageAvailable]);
  
  return { 
    storeSearch, 
    clearSearch, 
    isStorageAvailable 
  };
};

/**
 * Custom hook for component mount tracking
 * Prevents state updates after component unmount
 */
export const useMountedRef = () => {
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    // Component is mounted
    isMountedRef.current = true;
    
    // Cleanup function when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  return isMountedRef;
}; 