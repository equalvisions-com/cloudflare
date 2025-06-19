import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar-context";
import { clearOnboardingCookieAction } from "@/app/onboarding/actions";

export function useUserMenuState(initialDisplayName?: string, initialProfileImage?: string, initialUsername?: string) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { isAuthenticated: contextAuthenticated } = useConvexAuth();
  
  // Get values from context if available
  const sidebarContext = useSidebar();
  
  // Use context values if available, otherwise fall back to props
  const [displayName, setDisplayName] = useState(
    sidebarContext.displayName || initialDisplayName || "Guest"
  );
  const [username, setUsername] = useState(
    sidebarContext.username || initialUsername || "Guest"
  );
  const [profileImage, setProfileImage] = useState(
    sidebarContext.profileImage || initialProfileImage
  );
  
  // Use authenticated state from context when available
  const isAuthenticated = contextAuthenticated;

  const handleSignOut = async () => {
    try {
      await signOut();
      // Clear the onboarding cookie
      const cookieResult = await clearOnboardingCookieAction();
      if (!cookieResult.success) {
  
        // Optionally, notify the user or handle the error further
      }
      // Optimistically update the UI after sign-out
      setDisplayName("Guest");
      setUsername("Guest");
      setProfileImage(undefined);
    } catch (error) {

      // Optionally, trigger a user-friendly notification here
    }
  };

  const handleSignIn = () => {
    router.push("/signin");
  };

  return {
    isAuthenticated,
    displayName,
    username,
    profileImage,
    handleSignIn,
    handleSignOut,
  };
}