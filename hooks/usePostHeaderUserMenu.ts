import { useMemo } from 'react';
import { useSidebar } from "@/components/ui/sidebar-context";
import type { UsePostHeaderUserMenuReturn } from '@/lib/types';

/**
 * Custom hook for PostHeaderUserMenu business logic
 * Handles user authentication state and menu visibility
 * Separates business logic from UI rendering
 * Optimized with proper memoization for production performance
 */
export const usePostHeaderUserMenu = (): UsePostHeaderUserMenuReturn => {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount, isAuthenticated } = useSidebar();
  
  // Determine if user menu should be shown
  const shouldShowUserMenu = useMemo(() => isBoarded, [isBoarded]);
  
  // Memoized user menu props for performance
  const userMenuProps = useMemo(() => ({
    initialDisplayName: displayName,
    initialProfileImage: profileImage,
    isBoarded,
    pendingFriendRequestCount
  }), [displayName, profileImage, isBoarded, pendingFriendRequestCount]);
  
  return {
    shouldShowUserMenu,
    userMenuProps,
    isAuthenticated
  };
}; 