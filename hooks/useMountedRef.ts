import { useRef, useEffect } from 'react';

/**
 * Custom hook to track component mount status
 * Prevents state updates and side effects after component unmount
 * Helps prevent memory leaks in async operations
 * 
 * @returns RefObject that tracks if component is still mounted
 */
export const useMountedRef = () => {
  const mountedRef = useRef(true);
  
  useEffect(() => {
    // Set mounted flag to true on mount
    mountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  return mountedRef;
}; 