import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSidebar } from "@/components/ui/sidebar-context";

/**
 * Custom hook to get real-time pending friend request count
 * Uses Convex reactive queries for live updates
 * Falls back to context value during loading or when unauthenticated
 * 
 * @returns Real-time pending friend request count
 */
export const usePendingFriendRequests = () => {
  const { isAuthenticated, pendingFriendRequestCount: fallbackCount } = useSidebar();
  
  // Get real-time count from Convex
  const realtimeCount = useQuery(
    api.friends.getMyPendingFriendRequestCount, 
    isAuthenticated ? {} : "skip"
  );
  
  // Return real-time count if available, otherwise fallback to context
  // This ensures smooth UX during loading and for unauthenticated users
  return realtimeCount ?? fallbackCount ?? 0;
}; 