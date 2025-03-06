import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";

export default function PodcastsPage() {
  // Right sidebar content
  const rightSidebar = (
    <div className="sticky top-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Popular Podcasts</h3>
        <div className="space-y-3">
          {/* This would be populated with actual data in a real implementation */}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Discover trending podcasts in tech, business, and more.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <StandardSidebarLayout
      rightSidebar={rightSidebar}
    >
      <div className="space-y-6">
        
        {/* Category slider with posts */}
        <CategorySliderWrapper mediaType="podcast" />
      </div>
    </StandardSidebarLayout>
  );
}
