import VerifyOnboardingStatus from './verification';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Server component that verifies onboarding status - NO SUSPENSE! */}
      <VerifyOnboardingStatus />
      
      {/* Render the page content */}
      {children}
    </>
  );
} 