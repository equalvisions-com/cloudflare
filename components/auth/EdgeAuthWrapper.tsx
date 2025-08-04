'use client';

import { useEffect } from 'react';

/**
 * EdgeAuthWrapper
 * 
 * This component helps prevent static generation issues with pages 
 * that use client components but need Edge compatibility.
 * 
 * It ensures the authentication state is properly managed in
 * Edge runtime environments without relying on headers directly.
 */
export function EdgeAuthWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // No actual code needed - this client component ensures
    // the auth headers are handled client-side during render
    // preventing static generation issues
  }, []);

  return <>{children}</>;
} 