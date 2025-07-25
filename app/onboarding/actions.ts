"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from "@/convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';

// Import centralized types
import type { FinalizeOnboardingArgs, OnboardingActionResponse, OnboardingCookieActionResponse } from '@/lib/types';

// Atomic action that handles both database update and cookie setting
export async function atomicFinalizeOnboarding(profileData: FinalizeOnboardingArgs): Promise<OnboardingActionResponse> {
  try {
    // 1. Get the Convex token
    const token = await convexAuthNextjsToken().catch(err => {
      throw new Error("Authentication error");
    });
    
    if (!token) {
      throw new Error("Authentication required");
    }
    
    // 2. Update the database first - Using fetchAction which is simpler
    const convexResult = await fetchAction(api.users.finalizeOnboardingAction, profileData, { token });
    
    // 3. Check for already onboarded status (handles race condition with multiple tabs)
    if (convexResult && typeof convexResult === 'object' && 'status' in convexResult && convexResult.status === "ALREADY_ONBOARDED") {
      // Set cookie to ensure consistency and redirect to home
      (await cookies()).set('user_onboarded', 'true', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
      });
      
      // Return success with message about already being onboarded
      return {
        success: true,
        redirectUrl: '/',
        message: "Already completed onboarding in another session"
      };
    }
    
    // 4. Set the cookie after database update succeeds
    (await cookies()).set('user_onboarded', 'true', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });
    
    // 5. Return success with redirect information
    return {
      success: true,
      redirectUrl: '/'
    };

  } catch (error: any) {
    // Detailed error handling with specific error messages
    if (error.message?.includes('Authentication')) {
      return { 
        success: false, 
        error: "Authentication error. Please sign in again.", 
        redirectUrl: '/signin'
      };
    }
    
    // Add redirect to signin for all non-recoverable errors
    return { 
      success: false, 
      error: error.message || "Failed to complete onboarding",
      redirectUrl: '/signin'  // Always redirect to signin on serious errors
    };
  }
}

export async function clearOnboardingCookieAction(): Promise<OnboardingCookieActionResponse> {
  "use server";
  try {
    (await cookies()).delete('user_onboarded');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Failed to clear onboarding cookie" };
  }
} 