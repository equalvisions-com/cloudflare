import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";

export function useUserMenuState(initialDisplayName: string = "Guest", initialProfileImage?: string) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [profileImage, setProfileImage] = useState(initialProfileImage);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Optimistically update the UI after sign-out
      setDisplayName("Guest");
      setProfileImage(undefined);
    } catch (error) {
      console.error("Failed to sign out:", error);
      // Optionally, trigger a user-friendly notification here
    }
  };

  const handleSignIn = () => {
    router.push("/signin");
  };

  return {
    isAuthenticated,
    displayName,
    profileImage,
    handleSignIn,
    handleSignOut,
  };
}