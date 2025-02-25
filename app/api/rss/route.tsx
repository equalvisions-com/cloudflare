// app/api/rss/route.tsx
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getMergedRSSEntries } from "@/lib/redis";

async function getAllEntries() {
  const token = await convexAuthNextjsToken();
  if (!token) return null;

  const rssKeys = await fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });
  if (!rssKeys || rssKeys.length === 0) return null;

  // Get entries from Redis using the RSS keys
  const entries = await getMergedRSSEntries(rssKeys);
  if (!entries) return null;

  // Get unique feedUrls from the entries
  const feedUrls = [...new Set(entries.map(entry => entry.feedUrl))];
  
  // Fetch posts data using the actual feedUrls
  const postsData = await fetchQuery(
    api.posts.getPostsByFeedUrls,
    { feedUrls },
    { token }
  );

  // Create a map of feedUrl to post metadata
  const postMetadataMap = new Map(
    postsData.map(post => [post.feedUrl, {
      title: post.title,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug
    }])
  );

  // Batch fetch entry data for all entries at once
  const guids = entries.map(entry => entry.guid);
  const entryData = await fetchQuery(
    api.entries.batchGetEntryData,
    { entryGuids: guids },
    { token }
  );

  // Combine all data efficiently
  return entries.map((entry, index) => ({
    entry,
    initialData: entryData[index],
    postMetadata: postMetadataMap.get(entry.feedUrl) || {
      title: '',
      featuredImg: undefined,
      mediaType: undefined,
      postSlug: '',
      categorySlug: ''
    }
  }));
}

export async function GET() {
  try {
    const entriesWithData = await getAllEntries();
    if (!entriesWithData) {
      return Response.json({ 
        entries: [],
        totalEntries: 0
      });
    }

    return Response.json({
      entries: entriesWithData,
      totalEntries: entriesWithData.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Error fetching RSS entries:', error);
    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}