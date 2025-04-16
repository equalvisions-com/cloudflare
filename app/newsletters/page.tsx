import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { CategorySwipeableWrapper } from "@/components/ui/CategorySwipeableWrapper";

export default function NewslettersPage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar showSearch={false} />}
    >
      <div className="space-y-6">
        <div className="sm:max-w-full md:w-full md:max-w-[550px]">
          <CategorySwipeableWrapper mediaType="newsletter" showEntries={true} />
        </div>
      </div>
    </StandardSidebarLayout>
  );
}
