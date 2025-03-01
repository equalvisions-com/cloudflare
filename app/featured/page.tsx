import { Suspense } from 'react';
import FeaturedFeed, { getInitialEntries } from '../../components/featured/FeaturedFeed';

// This function will be called on each request
export const dynamic = 'force-dynamic';

export default async function FeaturedPage() {
  // Pre-fetch the initial entries
  const initialData = await getInitialEntries();
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Featured Content</h1>
      <Suspense fallback={<div className="text-center py-8">Loading featured content...</div>}>
        <FeaturedFeed initialData={initialData} />
      </Suspense>
    </div>
  );
}
