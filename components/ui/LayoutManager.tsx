import RSSEntriesDisplay from "@/components/rss-feed/RSSEntriesDisplay.server";
import { LayoutManagerClient } from "./LayoutManagerClient";

export const LayoutManager = () => {
  return (
    <LayoutManagerClient>
      <RSSEntriesDisplay />
    </LayoutManagerClient>
  );
};