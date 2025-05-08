"use server";

import { cookies } from 'next/headers';

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