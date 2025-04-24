import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { CategorySwipeableWrapper } from "@/components/ui/CategorySwipeableWrapper";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export default function NewslettersPage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar showSearch={false} />}
    >
        <div className="w-full">
          <CategorySwipeableWrapper mediaType="newsletter" showEntries={true} />
        </div>
    </StandardSidebarLayout>
  );
}
