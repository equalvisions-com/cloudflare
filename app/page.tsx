import { LayoutManager } from "@/components/ui/LayoutManager";
import { Suspense } from "react";

// Force dynamic rendering and prevent caching
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading feeds...</div>}>
      <LayoutManager />
    </Suspense>
  );
}
