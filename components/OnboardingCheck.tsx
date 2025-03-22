'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface OnboardingCheckProps {
  isAuthenticated: boolean;
  isBoarded: boolean;
  children: React.ReactNode;
}

export function OnboardingCheck({ isAuthenticated, isBoarded, children }: OnboardingCheckProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // Skip redirect if we're already on the onboarding page
    if (pathname === '/onboarding') {
      return;
    }
    
    // Only redirect if user is authenticated but not onboarded
    if (isAuthenticated && !isBoarded) {
      router.push('/onboarding');
    }
  }, [isAuthenticated, isBoarded, pathname, router]);

  return <>{children}</>;
} 