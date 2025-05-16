"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from "@/convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';

// --- Define the Server Action (Cookie Setting Only) --- 

export async function finalizeOnboardingCookieAction(): Promise<{ success: boolean; error?: string }> {
  try {
    // Set the cookie server-side
    cookies().set('user_onboarded', 'true', {
      path: '/',
      httpOnly: true, // Recommended for security
      secure: process.env.NODE_ENV === 'production', // Recommended for security
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax', // Recommended
    });
    return { success: true };

  } catch (error: any) {
    console.error('Error in finalizeOnboardingCookieAction:', error);
    return { success: false, error: "Failed to set onboarding cookie" };
  }
} 

// Interface for profile data passed from client
interface FinalizeOnboardingArgs {
  username: string;
  name?: string;
  bio?: string;
  profileImageKey?: string;
}

// New atomic action that handles both database update and cookie setting
export async function atomicFinalizeOnboarding(profileData: FinalizeOnboardingArgs): Promise<{ 
  success: boolean; 
  error?: string; 
  redirectUrl?: string;
}> {
  try {
    // 1. Get the Convex token
    const token = await convexAuthNextjsToken().catch(err => {
      console.error("Token retrieval error:", err);
      throw new Error("Authentication error");
    });
    
    if (!token) {
      throw new Error("Authentication required");
    }
    
    // 2. Update the database first - Using fetchAction which is simpler
    await fetchAction(api.users.finalizeOnboardingAction, profileData, { token });
    
    // 3. Set the cookie after database update succeeds
    cookies().set('user_onboarded', 'true', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });
    
    // 4. Return success with redirect information
    return {
      success: true,
      redirectUrl: '/'
    };

  } catch (error: any) {
    console.error('Error in atomicFinalizeOnboarding:', error);
    
    // Detailed error handling with specific error messages
    if (error.message?.includes('Authentication')) {
      return { 
        success: false, 
        error: "Authentication error. Please sign in again.", 
        redirectUrl: '/signin'
      };
    }
    
    return { 
      success: false, 
      error: error.message || "Failed to complete onboarding"
    };
  }
} 