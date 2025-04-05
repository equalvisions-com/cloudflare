import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { AiButton } from "@/app/components/ui/ai-button";
import { Suspense } from "react";

export default function PodcastsPage() {
  return (
    <>
      <StandardSidebarLayout
        rightSidebar={<RightSidebar showSearch={false} />}
      >
        <div className="space-y-6">
          <CategorySliderWrapper mediaType="podcast" />
        </div>
      </StandardSidebarLayout>
      <Suspense fallback={null}>
        <AiButton />
      </Suspense>
    </>
  );
}
