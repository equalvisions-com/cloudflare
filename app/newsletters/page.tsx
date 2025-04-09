import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";
import { RightSidebar } from "@/components/homepage/RightSidebar";

export default function NewslettersPage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar showSearch={false} />}
    >
      <div className="space-y-6">
        <div className="sm:pb-[119px] md:pb-[56px]"><CategorySliderWrapper mediaType="newsletter" /></div>
      </div>
    </StandardSidebarLayout>
  );
}
