import { cache } from "react";
import { getFeaturedEntries } from "@/lib/featured_redis";
import { FeaturedFeedClient } from "@/components/featured/FeaturedFeedClient";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import 'server-only';

interface FeaturedFeedProps {
  initialData?: Awaited<ReturnType<typeof getInitialEntries>>;
}

export const getInitialEntries = cache(async () => {
  // Get ALL featured entries from Redis (or fetch and cache if needed)
  const entries = await getFeaturedEntries();

  if (!entries || entries.length === 0) return null;
  
  // Get ALL entry guids for batch query
  const guids = entries.map(entry => entry.guid);
  
  // Get unique feed URLs for post metadata
  const feedUrls = [...new Set(entries.map(entry => entry.feed_url))];
  
  // Fetch ALL interaction data in one batch
  const token = await convexAuthNextjsToken();
  const entryData = await fetchQuery(
    api.entries.batchGetEntryData,
    { entryGuids: guids },
    { token }
  );
  
  // Fetch post metadata for all feed URLs
  const postsData = await fetchQuery(
    api.posts.getPostsByFeedUrls,
    { feedUrls },
    { token }
  );
  
  // Create a map of feedUrl to post metadata for O(1) lookups
  const postMetadataMap = new Map(
    postsData.map(post => [post.feedUrl, {
      title: post.title,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug
    }])
  );

  // Combine all entries with their data and metadata
  const entriesWithPublicData = entries.map((entry, index) => {
    // Use post metadata from the map, or create fallback metadata
    const metadata = postMetadataMap.get(entry.feed_url) || {
      title: entry.post_title || entry.title,
      featuredImg: entry.image,
      mediaType: 'article',
      postSlug: '',
      categorySlug: ''
    };
    
    return {
      entry,
      initialData: entryData[index],
      postMetadata: metadata
    };
  });

  return {
    entries: entriesWithPublicData,
    totalEntries: entries.length
  };
});

export default async function FeaturedFeed({ initialData }: FeaturedFeedProps) {
  // If initialData is not provided, fetch it
  const data = initialData || await getInitialEntries();
  
  if (!data) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold">No featured content available</h2>
        <p className="text-muted-foreground mt-2">Check back later for featured content</p>
      </div>
    );
  }
  
  return (
    <FeaturedFeedClient
      initialData={data}
      pageSize={30}
    />
  );
} 