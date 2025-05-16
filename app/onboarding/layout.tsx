'use client';

import VerifyOnboardingStatus from './verification';
import OnboardingLoading from './loading';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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

// Server component layout
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Server component that verifies onboarding status - show loading while it runs */}
      <VerificationWithTimeout />
      
      {/* Render the page content only after verification completes */}
      {children}
    </>
  );
} 