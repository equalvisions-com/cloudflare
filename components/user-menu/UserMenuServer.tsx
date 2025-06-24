import { Suspense } from "react";
import dynamic from 'next/dynamic';

// Edge Runtime compatible - optimized for serverless environments
export const runtime = 'edge';

// Optimized dynamic import for Edge runtime
// Client component handles all auth state via reactive Convex queries
const UserMenuClient = dynamic(
  () => import('./UserMenuClient').then(mod => mod.UserMenuClientWithErrorBoundary),
  {
    ssr: false,
    loading: () => <UserMenuFallback />
  }
);

export async function UserMenuServer() {
  return (
    <Suspense fallback={<UserMenuFallback />}>
      <UserMenuClient />
    </Suspense>
  );
}

// Fallback UI for Suspense during data fetching
function UserMenuFallback() {
  return (
    <div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />
  );
}

// Remove getUserProfile export since we're no longer using server queries
// Client components now use reactive Convex queries as single source of truth