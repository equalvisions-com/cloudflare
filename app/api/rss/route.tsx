// app/api/rss/route.tsx
import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getMergedRSSEntries } from "@/lib/redis";

export async function GET(request: NextRequest) {
  try {
    // Get pagination parameters from the request
    const searchParams = request.nextUrl.searchParams;
    
    // Support both single page and multi-page batch requests
    const page = parseInt(searchParams.get('page') || '0', 10);
    const startPage = parseInt(searchParams.get('startPage') || page.toString(), 10);
    const pageCount = parseInt(searchParams.get('pageCount') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const skipFirstPage = searchParams.get('skipFirstPage') === 'true';
    
    // Get auth token for Convex queries
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the user's RSS keys
    const rssKeys = await fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });
    if (!rssKeys || rssKeys.length === 0) {
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false 
      });
    }
    
    // Calculate pagination for multiple pages if requested
    const allEntries = [];
    
    // Fetch entries for each requested page
    const startIndex = skipFirstPage ? 1 : 0;
    for (let i = startIndex; i < pageCount; i++) {
      const currentPage = startPage + i;
      const offset = currentPage * pageSize;
      
      // Get merged entries from Redis with pagination
      const pageEntries = await getMergedRSSEntries(rssKeys, offset, pageSize);
      if (!pageEntries || pageEntries.length === 0) {
        // If we get no entries for a page, we've reached the end
        break;
      }
      
      allEntries.push(...pageEntries);
    }
    
    if (allEntries.length === 0) {
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false 
      });
    }
    
    // Get unique feedUrls from the entries
    const feedUrls = [...new Set(allEntries.map(entry => entry.feedUrl))];
    
    // Fetch posts data using the actual feedUrls
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
        categorySlug: post.categorySlug,
        postSlug: post.postSlug
      }])
    );

    // Batch fetch entry data for all entries at once
    const guids = allEntries.map(entry => entry.guid);
    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: guids },
      { token }
    );

    // Combine all data efficiently
    const entriesWithPublicData = allEntries.map((entry, index) => ({
      entry,
      initialData: entryData[index],
      postMetadata: postMetadataMap.get(entry.feedUrl) || {
        title: '',
        featuredImg: undefined,
        mediaType: undefined,
        categorySlug: '',
        postSlug: ''
      }
    }));
    
    // Check if there are more entries available
    const nextPageOffset = (startPage + pageCount) * pageSize;
    const nextPageEntries = await getMergedRSSEntries(rssKeys, nextPageOffset, 1);
    const hasMore = nextPageEntries !== null && nextPageEntries.length > 0;
    
    // Set cache control headers for better performance
    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    
    return NextResponse.json(
      { 
        entries: entriesWithPublicData,
        totalEntries: allEntries.length,
        hasMore
      },
      { headers }
    );
    
  } catch (error) {
    console.error('Error in RSS route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}