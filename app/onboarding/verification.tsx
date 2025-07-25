"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import AutoRedirect from './AutoRedirect';

// Import centralized types
import type { OnboardingUserProfile } from '@/lib/types';

// This is a proper server action that can set cookies and redirect
export async function setOnboardedCookieAndRedirect(): Promise<void> {
  'use server';
  
  try {
    // Set the cookie to true
    (await cookies()).set('user_onboarded', 'true', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });
    
    // This will redirect after the server action completes
    redirect('/');
  } catch (error) {
    // Let the component handle the error
  }
}

// Helper function to delay for retry
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to fetch profile with timeout
async function fetchProfileWithTimeout(token: string, timeoutMs = 5000): Promise<OnboardingUserProfile | null> {
  try {
    const profilePromise = fetchQuery(api.users.getProfile, {}, { token });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Profile query timed out")), timeoutMs)
    );
    
    return await Promise.race([profilePromise, timeoutPromise]) as OnboardingUserProfile | null;
  } catch (error) {
    return null;
  }
}

// This is a server component for verifying onboarding status during cold starts
export default async function VerifyOnboardingStatus() {
  // We always check with Convex first as the source of truth
  // Get the current cookie value for comparison later
  const onboardedCookie = (await cookies()).get('user_onboarded');
  
  try {
    // Make sure to catch any token errors
    const token = await convexAuthNextjsToken().catch(err => {
      return null;
    });
    
    if (!token) {
      redirect('/signin');
    }
    
    // CLOUDFLARE EDGE RESILIENCE: Implement aggressive retry logic for Convex queries
    // Edge runtime can have connectivity issues during cold starts
    let profile: OnboardingUserProfile | null = null;
    let retries = 0;
    const MAX_RETRIES = 3; // Increased retries for edge runtime
    
    while (retries <= MAX_RETRIES) {
      try {
        profile = await fetchProfileWithTimeout(token, 3000); // Shorter timeout per attempt
        
        if (profile) {
          break; // Successfully got profile, exit retry loop
        }
      } catch (fetchError) {
        console.error(`Convex query attempt ${retries + 1} failed:`, fetchError);
      }
      
      retries++;
      if (retries <= MAX_RETRIES) {
        await delay(Math.min(1000 * retries, 3000)); // Exponential backoff, capped at 3s
      }
    }
    
    // If all retries failed, redirect to signin
    if (!profile) {
      // Clear any existing cookies to force re-authentication
      (await cookies()).set('user_onboarded', '', { maxAge: 0, path: '/' });
      redirect('/signin');
    }
    
    if (profile.isBoarded === true) {
      // User is already onboarded according to database (source of truth)
      
      // Check if cookie doesn't match Convex status
      if (onboardedCookie?.value !== 'true') {
        // Use the client component to handle the cookie update and redirect
        return <AutoRedirect />;
      } else {
        // Cookie already matches - redirect directly
        redirect('/');
      }
    } else {
      // User is not onboarded according to database (source of truth)
      // This handles both isBoarded: false and isBoarded: undefined
      
      // Check if cookie incorrectly says they're onboarded
      if (onboardedCookie?.value === 'true') {
        // Remove the incorrect cookie
        (await cookies()).set('user_onboarded', '', {
          path: '/',
          maxAge: 0, // Expire immediately
        });
      }
      
      // Continue to onboarding flow
    }
  } catch (error) {
    // For any unexpected errors, redirect to signin as a fallback
    redirect('/signin');
  }
  
  // Return null to render nothing - this component just handles the verification
  return null;
} 