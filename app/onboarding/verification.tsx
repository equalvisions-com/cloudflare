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

// Server action to synchronize the cookie with Convex onboarding status
export async function syncOnboardedCookie(isBoarded: boolean): Promise<void> {
  'use server';
  
  try {
    console.log(`Syncing onboarded cookie to match Convex: ${isBoarded}`);
    cookies().set('user_onboarded', isBoarded ? 'true' : 'false', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });
  } catch (error) {
    console.error("Error syncing onboarded cookie:", error);
  }
}

// Utility function for creating timeout promises
function createTimeout(ms: number, errorMessage: string): Promise<never> {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(errorMessage)), ms)
  );
}

// This is a server component for verifying onboarding status during cold starts
export default async function VerifyOnboardingStatus() {
  // Create a global timeout of 15 seconds for the entire verification process
  const globalTimeout = createTimeout(15000, "Global verification timeout");
  
  try {
    // Race the entire verification process against the global timeout
    await Promise.race([
      verifyOnboardingStatus(),
      globalTimeout
    ]).catch(error => {
      console.error("Verification failed:", error.message);
      redirect('/signin');
    });
    
    // If we reach here, verification succeeded but user needs onboarding
    return null;
  } catch (error) {
    console.error("Error in verification wrapper:", error);
    redirect('/signin');
  }
}

// Core verification logic, separated for proper timeout handling
async function verifyOnboardingStatus() {
  // Always check with Convex first for the real, authoritative status
  try {
    // Get token with a reasonable timeout
    const tokenPromise = convexAuthNextjsToken();
    const tokenTimeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => {
        console.log("Token retrieval timed out");
        resolve(null);
      }, 10000) // Increased from 3s to 10s for better reliability
    );
    
    const token = await Promise.race([tokenPromise, tokenTimeoutPromise])
      .catch(err => {
        console.error("Token retrieval error:", err);
        return null;
      });
    
    if (token) {
      // Query Convex for the real user profile with timeout
      console.log("Verifying onboarding status with Convex");
      const profilePromise = fetchQuery(api.users.getProfile, {}, { token });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Profile query timed out")), 10000) // Increased from 5s to 10s
      );
      
      const profile = await Promise.race([profilePromise, timeoutPromise])
        .catch(err => {
          console.error("Profile query error:", err);
          return null;
        }) as UserProfile | null;
      
      console.log("Profile from Convex:", JSON.stringify(profile));
      
      if (profile) {
        // We have authoritative data from Convex
        const onboardedCookie = cookies().get('user_onboarded');
        // Ensure isBoarded is a boolean with default to false
        const isBoarded = profile.isBoarded === true;
        const cookieNeedsUpdate = isBoarded 
          ? onboardedCookie?.value !== 'true'
          : onboardedCookie?.value !== 'false';
        
        // Always update the cookie if it's out of sync
        if (cookieNeedsUpdate) {
          await syncOnboardedCookie(isBoarded);
        }
        
        if (isBoarded) {
          console.log("User is onboarded according to Convex, redirecting to home");
          redirect('/');
        } else if (profile.userId) {
          // User is authenticated but not onboarded - this is the ONLY case where we show onboarding
          console.log("User is NOT onboarded according to Convex, continuing to onboarding");
          // Continue to onboarding flow
          return null; // This allows the onboarding page to render
        } else {
          // User has a profile but no userId? This is an invalid state
          console.log("Invalid profile state, redirecting to signin");
          redirect('/signin');
        }
      } else {
        // No profile data available but we got a token
        // This is an inconsistent state, should redirect to signin
        console.log("No profile available despite valid token, redirecting to signin");
        redirect('/signin');
      }
    } else {
      // SECURITY IMPROVEMENT: Couldn't get token, redirect to signin instead of checking cookie
      console.log("No token available, redirecting to signin for re-authentication");
      redirect('/signin');
    }
  } catch (error) {
    console.error("Error verifying onboarding status:", error);
    // If there's an error, we should redirect to signin
    console.log("Verification error, redirecting to signin");
    redirect('/signin');
  }
  
  // If we reach here, it means we have an authenticated user who is not onboarded
  // The onboarding form will be displayed
  return null;
} 