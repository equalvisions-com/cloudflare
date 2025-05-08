import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { CategorySwipeableWrapper } from "@/components/ui/CategorySwipeableWrapper";

// Add the Edge Runtime configuration
export const runtime = 'edge';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export default function PodcastsPage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar showSearch={false} />}
    >
      <div className="w-full">
      <CategorySwipeableWrapper mediaType="podcast" showEntries={true} />
      </div>
    </StandardSidebarLayout>
  );
}
