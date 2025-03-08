import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { CategorySliderWrapper } from "@/components/ui/CategorySliderWrapper";
import { memo } from "react";

// Memoize the static sidebar content
const RightSidebar = memo(() => (
  <div className="sticky top-6">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3">Featured Newsletters</h3>
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Stay updated with the best newsletters in tech, finance, and design.
        </p>
      </div>
    </div>
  </div>
));

RightSidebar.displayName = 'NewslettersRightSidebar';

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
