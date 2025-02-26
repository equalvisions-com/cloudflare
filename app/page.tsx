import { LayoutManager } from "@/components/ui/LayoutManager";

// Enable Incremental Static Regeneration (ISR) - revalidate every 60 seconds
export const revalidate = 60;

// Configure dynamic rendering to auto (static by default unless dynamic data is detected)
export const dynamic = "auto";

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
