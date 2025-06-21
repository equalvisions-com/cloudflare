import { useCallback, useRef, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar-context";
import { clearOnboardingCookieAction } from "@/app/onboarding/actions";
import type { UseUserMenuStateReturn, UseUserMenuStateProps } from "@/lib/types";

export function useUserMenuState(
  initialDisplayName?: string, 
  initialProfileImage?: string, 
  initialUsername?: string
): UseUserMenuStateReturn {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { isAuthenticated: contextAuthenticated } = useConvexAuth();
  
  // Get values from context if available
  const sidebarContext = useSidebar();
  
  // AbortController for cleanup of async operations
  const abortControllerRef = useRef<AbortController>();
  
  // Initialize AbortController on mount and cleanup on unmount
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    
    return () => {
      // Cleanup: abort any pending operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // Derive values from context/props instead of local state
  // This eliminates unnecessary re-renders and state synchronization issues
  const displayName = sidebarContext.displayName || initialDisplayName || "Guest";
  const username = sidebarContext.username || initialUsername || "Guest";
  const profileImage = sidebarContext.profileImage || initialProfileImage;
  const isAuthenticated = contextAuthenticated;

  const handleSignOut = useCallback(async () => {
    // Check if operation was aborted before proceeding
    if (abortControllerRef.current?.signal.aborted) {
      return;
    }
    
    try {
      await signOut();
      
      // Check again after async operation
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      // Clear the onboarding cookie
      const cookieResult = await clearOnboardingCookieAction();
      
      // Final check before any side effects
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (!cookieResult.success) {
        console.warn("Failed to clear onboarding cookie:", cookieResult.error);
      }
      
      // Note: We no longer need to manually update state since we're using derived values
      // The context will update automatically when the auth state changes
      
    } catch (error) {
      // Only handle error if operation wasn't aborted
      if (!abortControllerRef.current?.signal.aborted) {
        console.error("Sign out error:", error);
        // Could dispatch to error boundary or notification system here
      }
    }
  }, [signOut]);

  const handleSignIn = useCallback(() => {
    // Non-async operation, but still check if component is still mounted
    if (!abortControllerRef.current?.signal.aborted) {
      router.push("/signin");
    }
  }, [router]);

  return {
    isAuthenticated,
    displayName,
    username,
    profileImage,
    handleSignIn,
    handleSignOut,
  };
}