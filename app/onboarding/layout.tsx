import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import OnboardingLoading from './loading';
import VerifyOnboardingStatus from './verification';
import { Suspense } from 'react';

// Authentication check function (executed on the server)
function AuthCheck() {
  // Quick synchronous check for auth token before any rendering
  const authToken = cookies().get('__convexAuthJWT');
  
  // If no auth token exists, redirect immediately
  if (!authToken?.value) {
    redirect('/signin');
  }
  
  // Return null as this function doesn't render anything visible
  return null;
}

// Main layout component (server component)
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Perform auth check on the server
  AuthCheck();
  
  return (
    <>
      {/* Always render the loading UI first while verification happens */}
      <OnboardingLoading />
      
      {/* Server component that verifies full onboarding status */}
      <Suspense fallback={<OnboardingLoading />}>
        <VerifyOnboardingStatus />
      </Suspense>
      
      {/* Children are only accessible after verification completes successfully */}
      {children}
    </>
  );
} 