"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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
  
  // Return null to render nothing - this component just handles the verification
  return null;
} 