import { LayoutManager } from "@/components/ui/LayoutManager";
import { Metadata } from "next";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Add preload hints for critical resources and proper metadata
export const metadata: Metadata = {
  title: "RSS Feed Reader",
  description: "A modern RSS feed reader with real-time updates and social features",
};

export default function HomePage() {
  return (
      <LayoutManager />
  );
}
