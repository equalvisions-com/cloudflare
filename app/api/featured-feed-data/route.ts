import { NextRequest, NextResponse } from 'next/server';
import { getInitialEntries } from '@/components/featured/FeaturedFeed'; // Path alias should work
import type { FeaturedEntry as OriginalFeaturedEntry } from '@/lib/types';
import type { KVNamespace } from "@/lib/types";
import { validateHeaders } from '@/lib/headers';

export const runtime = 'edge';

// Define the structure for the items within the 'entries' array
interface PostMetadataForFeed {
  title: string;
  featuredImg?: string;
  mediaType: string;
  postSlug: string;
  categorySlug: string;
  verified?: boolean;
}

interface MetricsForFeed {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
  bookmarks?: { isBookmarked: boolean };
}

interface FeaturedEntryWithPublicData {
  entry: OriginalFeaturedEntry;
  initialData: MetricsForFeed;
  postMetadata: PostMetadataForFeed;
}

// Interface for the expected structure of data from getInitialEntries
interface FeaturedData {
  entries: FeaturedEntryWithPublicData[];
  totalEntries: number;
  message?: string;
}



// In Next.js on Cloudflare Pages, bindings are typically available on the process.env object
// or directly in the global scope when using Edge Runtime.
// Let's assume KVFEATURED is injected and accessible.
// It's important to ensure the binding name 'KVFEATURED' matches exactly what's in your Cloudflare Pages dashboard.

export async function GET(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // For Cloudflare Pages + Next.js Edge Runtime, bindings are accessed via process.env
    // after being configured in the Pages dashboard
    const kvBinding = (process.env as any).KVFEATURED as KVNamespace | undefined;

    // Debug logging to see what's available
    console.log('KV Binding Debug:', {
      hasBinding: !!kvBinding,
      processEnvKeys: Object.keys(process.env).filter(key => key.includes('KV') || key.includes('FEATURED')),
      globalThisKeys: Object.keys(globalThis).filter(key => key.includes('KV') || key.includes('FEATURED'))
    });

    if (!kvBinding) {
      console.error("KVFEATURED binding not found. Ensure it is correctly bound in Cloudflare Pages settings.");
      console.error("Available process.env keys:", Object.keys(process.env).slice(0, 10));
      
      // Return empty data instead of error to prevent infinite loops in frontend
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0, 
        message: "Featured content temporarily unavailable. KV binding not configured." 
      } as FeaturedData, { status: 200 });
    }

    // The getInitialEntries function expects the KVNamespace directly
    const featuredDataResult: FeaturedData | null = await getInitialEntries(kvBinding);

    if (!featuredDataResult || featuredDataResult.entries.length === 0) {
      return NextResponse.json({ entries: [], totalEntries: 0, message: "No featured content available." } as FeaturedData, { status: 200 });
    }
    
    return NextResponse.json(featuredDataResult, { status: 200 });

  } catch (error) {
    console.error("Error fetching featured feed data in API route:", error);
    let errorMessage = "Failed to fetch featured feed data.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Return 200 with error message to prevent cascade failures
    return NextResponse.json({ 
      entries: [], 
      totalEntries: 0, 
      error: errorMessage 
    }, { status: 200 });
  }
} 