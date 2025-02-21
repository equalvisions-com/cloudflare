import { LayoutManager } from "@/components/ui/LayoutManager";

// Configure the segment for dynamic rendering
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

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
