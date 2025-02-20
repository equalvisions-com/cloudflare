import RSSEntriesDisplay from "@/components/rss-feed/RSSEntriesDisplay.server";
import { LayoutManagerClientWithErrorBoundary } from "./LayoutManagerClient";

export const LayoutManager = () => {
  return (
    <LayoutManagerClientWithErrorBoundary>
      <RSSEntriesDisplay />
    </LayoutManagerClientWithErrorBoundary>
  );
};