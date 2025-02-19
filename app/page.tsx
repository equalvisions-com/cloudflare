import { LayoutManager } from "@/components/ui/LayoutManager";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading feeds...</div>}>
      <LayoutManager />
    </Suspense>
  );
}
