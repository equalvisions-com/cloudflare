import RSSEntriesDisplay from "@/components/rss-feed/RSSEntriesDisplay.server";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { LayoutManagerClient } from "./LayoutManagerClient";

export const LayoutManager = () => {
  return (
    <LayoutManagerClient>
      <RSSEntriesDisplay />
    </LayoutManagerClient>
  );
};