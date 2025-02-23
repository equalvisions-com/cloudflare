import { LayoutManager } from "@/components/ui/LayoutManager";

// Configure the segment for dynamic rendering with proper caching
export const revalidate = 60; // Revalidate every 60 seconds
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

// Add preload hints for critical resources
export async function generateMetadata() {
  return {
    other: {
      // Preload critical data endpoints
      'Link': [
        '</api/rss-keys>; rel=preload; as=fetch',
        '</api/batch>; rel=preload; as=fetch',
      ].join(', '),
    },
  };
}

export default function HomePage() {
  return <LayoutManager />;
}
