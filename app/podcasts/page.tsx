import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";
import { memo } from "react";

// Memoize the static sidebar content
const RightSidebar = memo(() => (
  <div className="sticky top-6">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3">Popular Podcasts</h3>
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Discover trending podcasts in tech, business, and more.
        </p>
      </div>
    </div>
  </div>
));

RightSidebar.displayName = 'PodcastsRightSidebar';

export default function PodcastsPage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar />}
    >
      <div className="space-y-6">
        <CategorySliderWrapper mediaType="podcast" />
      </div>
    </StandardSidebarLayout>
  );
}
