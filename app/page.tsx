import { LayoutManager } from "@/components/ui/LayoutManager";

// Add preload hints for critical resources
export async function generateMetadata() {
  return {
    other: {
      // Preload critical data endpoints - only preload the initial data, not batches
      'Link': [
        '</api/rss-keys>; rel=preload; as=fetch',
        // Only preload the first page, not batches
        '</api/rss?page=0&pageSize=10>; rel=preload; as=fetch',
        '</api/convex/batchGetEntryData>; rel=preload; as=fetch',
      ].join(', '),
    },
  };
}

export default function HomePage() {
  return <LayoutManager />;
}
