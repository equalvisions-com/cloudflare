import { LayoutManager } from "@/components/ui/LayoutManager";

// Add preload hints for critical resources
export async function generateMetadata() {
  return {
    other: {
      // Preload critical data endpoints
      'Link': [
        '</api/rss-keys>; rel=preload; as=fetch',
        '</api/rss?pageSize=10>; rel=preload; as=fetch',
        '</api/convex/batchGetEntryData>; rel=preload; as=fetch',
      ].join(', '),
    },
  };
}

export default function HomePage() {
  return <LayoutManager />;
}
