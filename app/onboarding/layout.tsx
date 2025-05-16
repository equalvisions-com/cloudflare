import VerifyOnboardingStatus from './verification';
import { Suspense } from 'react';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Server component that verifies onboarding status */}
      <Suspense fallback={null}>
        <VerifyOnboardingStatus />
      </Suspense>
      
      {/* Render the page content */}
      {children}
    </>
  );
} 