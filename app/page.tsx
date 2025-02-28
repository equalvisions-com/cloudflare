import { LayoutManager } from "@/components/ui/LayoutManager";
import { Metadata } from "next";

// Add preload hints for critical resources and proper metadata
export const metadata: Metadata = {
  title: "RSS Feed Reader",
  description: "A modern RSS feed reader with real-time updates and social features",
  other: {
    // Preload critical data endpoints with proper priority
    'Link': [
      '</api/rss-keys>; rel=preload; as=fetch; crossorigin=anonymous; priority=high',
      // Only preload the first page with post metadata
      '</api/rss?offset=0&limit=30&includePostMetadata=true>; rel=preload; as=fetch; crossorigin=anonymous; priority=high',
      '</api/convex/batchGetEntryData>; rel=preload; as=fetch; crossorigin=anonymous',
    ].join(', '),
  },
};

export default function HomePage() {
  return <LayoutManager />;
}
