import { LayoutManager } from "@/components/ui/LayoutManager";
import { Metadata } from "next";
import { headers } from 'next/headers';
import OnboardingContent from './onboarding/page';
import Loading from './loading';
import { Suspense } from 'react';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Add preload hints for critical resources and proper metadata
export const metadata: Metadata = {
  title: "RSS Feed Reader",
  description: "A modern RSS feed reader with real-time updates and social features",
};

export default function HomePage() {
  // Get headers to check if we should render onboarding content
  const headersList = headers();
  const shouldRenderOnboarding = headersList.get('x-render-onboarding') === '1';
  const needsOnboardingCheck = headersList.get('x-check-onboarding') === '1';
  
  // If middleware indicates we should show onboarding
  if (shouldRenderOnboarding) {
    return (
      <Suspense fallback={<Loading />}>
        <OnboardingContent />
      </Suspense>
    );
  }
  
  // If we're in an uncertain state, show loading until verification completes
  if (needsOnboardingCheck) {
    return <Loading />;
  }
  
  // Normal home page render (only shown when definitely onboarded)
  return (
    <LayoutManager />
  );
}
