import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";

export default function NewslettersPage() {
  // Right sidebar content
  const rightSidebar = (
    <div className="sticky top-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Featured Newsletters</h3>
        <div className="space-y-3">
          {/* This would be populated with actual data in a real implementation */}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Stay updated with the best newsletters in tech, finance, and design.
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
        <CategorySliderWrapper mediaType="newsletter" />
      </div>
    </StandardSidebarLayout>
  );
}
