import { useConvexAuth } from 'convex/react';

// Custom hook for handling Convex authentication
export function useConvexAuthToken() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  if (!isAuthenticated || isLoading) {
    return null;
  }
  
  return process.env.NEXT_PUBLIC_CONVEX_URL;
}

// Non-hook function for server-side token handling
export async function getConvexAuthToken() {
  try {
    return process.env.NEXT_PUBLIC_CONVEX_URL;
  } catch (error) {

    return null;
  }
} 