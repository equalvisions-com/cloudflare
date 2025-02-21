import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { LayoutManagerClient } from "./LayoutManagerClient";

export async function LayoutManager() {
  // Pre-fetch initial data
  const initialData = await getInitialEntries();
  
  return (
    <LayoutManagerClient initialData={initialData} />
  );
}