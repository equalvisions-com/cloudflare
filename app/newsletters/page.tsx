import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";
import { RightSidebar } from "@/components/homepage/RightSidebar";

export default function NewslettersPage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar />}
    >
      <div className="space-y-6">
        <CategorySliderWrapper mediaType="newsletter" />
      </div>
    </StandardSidebarLayout>
  );
}
