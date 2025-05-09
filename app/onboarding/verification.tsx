"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';

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
    const token = await convexAuthNextjsToken();
    
    if (token) {
      // Query Convex for the real user profile
      const profile = await fetchQuery(api.users.getProfile, {}, { token });
      
      if (profile?.isBoarded) {
        // User is already onboarded according to database
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
      }
    }
  } catch (error) {
    console.error("Error verifying onboarding status:", error);
    // If there's an error, we'll fall through and let the page render
  }
  
  // Return null to render nothing - this component just handles the verification
  return null;
} 