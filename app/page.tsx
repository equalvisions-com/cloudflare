// app/page.tsx
import { LayoutManager } from "@/components/ui/LayoutManager";
import BFCacheBlocker from "@/components/BFCacheBlocker";
import { Metadata } from "next";

/*───────────────────────────────────────────────
  1.  Headers that disable WebKit’s BFCache
 ───────────────────────────────────────────────*/
export const fetchCache = "force-no-store";   // adds Cache-Control: no-store

// (Optional) keep edge runtime if you’re on Cloudflare Pages
export const runtime = "edge";

/*───────────────────────────────────────────────
  2.  SEO / preload metadata
 ───────────────────────────────────────────────*/
export const metadata: Metadata = {
  title: "RSS Feed Reader",
  description: "A modern RSS feed reader with real-time updates and social features",
};

/*───────────────────────────────────────────────
  3.  Page component
 ───────────────────────────────────────────────*/
export default function HomePage() {
  return (
    <>
      {/* BFCache blocker for Chrome / Edge / Firefox */}
      <BFCacheBlocker />

      {/* Your existing UI */}
      <LayoutManager />
    </>
  );
}
