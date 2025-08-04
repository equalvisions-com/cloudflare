'use client';

import { useState, useEffect } from 'react';
import { ProfileSettingsPage } from './ProfileSettingsPage';
import { Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * A client wrapper component that ensures the ProfileSettingsPage
 * only renders on the client side and when profile data is loaded
 */
export default function ProfileSettingsClientWrapper() {
  // Use state to control when to render the component
  const [isMounted, setIsMounted] = useState(false);
  
  // Fetch the user profile data
  const userProfile = useQuery(api.users.getProfile, {});
  
  // Only render the component after mounting on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Show loading when not mounted or still loading profile data
  if (!isMounted || userProfile === undefined) {
    return (
    
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
       </div>
    );
  }
  
  // Once mounted on the client and data is loaded, render the actual component with the profile data
  return <ProfileSettingsPage userProfile={userProfile} />;
} 