import { useCallback, useEffect } from 'react';
import { useSidebar } from '@/components/ui/sidebar-context';
import {
  useFeedTabsSetAuthState,
  useFeedTabsAuth as useFeedTabsAuthState
} from '@/lib/stores/feedTabsStore';
import type { 
  UseFeedTabsAuthProps, 
  UseFeedTabsAuthReturn
} from '@/lib/types';

/**
 * Custom hook for managing authentication state in FeedTabsContainer
 * 
 * Extracts all authentication-related business logic from the component following
 * the established production patterns:
 * - Centralized auth state management via Zustand
 * - Sidebar context integration
 * - Authentication state synchronization
 * - User profile data management
 * 
 * @param props - Hook configuration props
 * @returns Authentication state and handlers
 */
export const useFeedTabsAuth = ({
  isAuthenticated
}: UseFeedTabsAuthProps): UseFeedTabsAuthReturn => {
  // Get user data from sidebar context
  const { 
    displayName, 
    isBoarded, 
    profileImage, 
    pendingFriendRequestCount 
  } = useSidebar();

  // Zustand store selectors and actions
  const authState = useFeedTabsAuthState();
  const setAuthState = useFeedTabsSetAuthState();

  /**
   * Synchronize authentication state with sidebar context
   */
  useEffect(() => {
    const newAuthState = {
      isAuthenticated,
      displayName: displayName || '',
      isBoarded: isBoarded || false,
      profileImage: profileImage || null,
      pendingFriendRequestCount: pendingFriendRequestCount || 0
    };

    // Only update if there are actual changes to prevent unnecessary re-renders
    const hasChanges = (
      authState.isAuthenticated !== newAuthState.isAuthenticated ||
      authState.displayName !== newAuthState.displayName ||
      authState.isBoarded !== newAuthState.isBoarded ||
      authState.profileImage !== newAuthState.profileImage ||
      authState.pendingFriendRequestCount !== newAuthState.pendingFriendRequestCount
    );

    if (hasChanges) {
      setAuthState(newAuthState);
    }
  }, [
    isAuthenticated,
    displayName,
    isBoarded,
    profileImage,
    pendingFriendRequestCount,
    authState,
    setAuthState
  ]);

  /**
   * Handle authentication state changes
   */
  const handleAuthChange = useCallback(() => {
    // This is handled automatically by the useEffect above
    // but can be used for additional logic if needed
  }, [isAuthenticated, displayName, isBoarded]);

  /**
   * Get user menu props for authenticated users
   */
  const getUserMenuProps = useCallback(() => {
    if (!authState.isAuthenticated) {
      return null;
    }

    return {
      initialDisplayName: authState.displayName,
      initialProfileImage: authState.profileImage || null,
      isBoarded: authState.isBoarded,
      pendingFriendRequestCount: authState.pendingFriendRequestCount
    };
  }, [authState]);

  /**
   * Check if user should see sign-in button
   */
  const shouldShowSignInButton = useCallback(() => {
    return !authState.isAuthenticated;
  }, [authState.isAuthenticated]);

  /**
   * Check if user menu should be displayed
   */
  const shouldShowUserMenu = useCallback(() => {
    return authState.isAuthenticated;
  }, [authState.isAuthenticated]);

  return {
    handleAuthChange,
    getUserMenuProps,
    shouldShowSignInButton,
    shouldShowUserMenu,
    authState
  };
}; 