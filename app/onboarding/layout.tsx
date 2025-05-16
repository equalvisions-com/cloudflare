'use client';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import OnboardingLoading from './loading';
import VerifyOnboardingStatus from './verification';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Authentication check server component
function AuthCheck() {
  // Quick synchronous check for auth token before any rendering
  const authToken = cookies().get('__convexAuthJWT');
  
  // If no auth token exists, redirect immediately
  if (!authToken?.value) {
    redirect('/signin');
  }
  
  // Return null as this component doesn't render anything visible
  return null;
}

// Separate client component to handle timeouts
function VerificationWithTimeout() {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    // If verification takes more than 15 seconds, assume authentication issues
    const timeoutId = setTimeout(() => {
      console.log("Verification timed out, redirecting to login");
      setIsTimedOut(true);
      router.replace('/signin'); // Redirect to login page on timeout
    }, 15000);
    
    return () => clearTimeout(timeoutId);
  }, [router]);
  
  // If timed out, show loading with spinner only until redirect completes
  if (isTimedOut) {
    return (
      <div className="fixed inset-0 bg-background z-[9999] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <Suspense fallback={<OnboardingLoading />}>
      <VerifyOnboardingStatus />
    </Suspense>
  );
}

// Main layout component
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Server component that checks auth token synchronously */}
      <AuthCheck />
      
      {/* Always render the loading UI first while verification happens */}
      <OnboardingLoading />
      
      {/* Server component that verifies full onboarding status */}
      <VerificationWithTimeout />
      
      {/* Children are only accessible after verification completes successfully */}
      {children}
    </>
  );
} 