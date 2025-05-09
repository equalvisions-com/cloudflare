"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';

// Define type for the user profile response
interface UserProfile {
  userId?: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImage?: string;
  rssKeys?: string[];
  isBoarded?: boolean;
  [key: string]: any; // Allow other properties
}

// This is a server component for verifying onboarding status during cold starts
// when the middleware could not make a definitive determination
export default async function VerifyOnboardingStatus() {
  // We only run this check during cold starts when the middleware is uncertain
  // This runs server-side only
  const onboardedCookie = cookies().get('user_onboarded');
  
  // If cookie is definitely true, redirect away from onboarding
  if (onboardedCookie?.value === 'true') {
    redirect('/');
  }
  
  // If cookie doesn't exist or is false, check with Convex for the real status
  try {
    // Make sure to catch any token errors
    const token = await convexAuthNextjsToken().catch(err => {
      console.error("Token retrieval error:", err);
      return null;
    });
    
    if (token) {
      // Query Convex for the real user profile with timeout
      // Use Promise.race to prevent hanging during edge functions
      const profilePromise = fetchQuery(api.users.getProfile, {}, { token });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Profile query timed out")), 5000)
      );
      
      const profile = await Promise.race([profilePromise, timeoutPromise])
        .catch(err => {
          console.error("Profile query error:", err);
          return null;
        }) as UserProfile | null;
      
      // Log for debugging
      console.log("Profile from Convex:", JSON.stringify(profile));
      
      if (profile?.isBoarded) {
        // User is already onboarded according to database
        console.log("User is already onboarded, setting cookie and redirecting");
        
        // Set the cookie to match the database state
        cookies().set('user_onboarded', 'true', {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'lax',
        });
        
        // Redirect to home
        redirect('/');
      } else {
        console.log("User not onboarded in database, continuing to onboarding flow");
      }
    }
  } catch (error) {
    console.error("Error verifying onboarding status:", error);
    // If there's an error, we'll fall through and let the page render
  }
  
  // Return null to render nothing - this component just handles the verification
  return null;
} 