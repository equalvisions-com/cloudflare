import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";
import { RightSidebar } from "@/components/homepage/RightSidebar";

export default function PodcastsPage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar showSearch={false} />}
    >
      <div className="space-y-6">
      <div className="sm:pb-[119px] md:pb-[56px]"><CategorySliderWrapper mediaType="podcast" /></div>
      </div>
    </StandardSidebarLayout>
  );
}
