import { NextRequest, NextResponse } from 'next/server';
import { getInitialEntries } from '@/components/featured/FeaturedFeed'; // Path alias should work
import type { FeaturedEntry as OriginalFeaturedEntry } from '@/lib/featured_kv';
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

// Type definition for Cloudflare KVNamespace
// Ideally, configure this globally via tsconfig.json and @cloudflare/workers-types
interface KVNamespace {
  get<T = string>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  getWithMetadata<T = string, Metadata = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<{ value: T | null; metadata: Metadata | null }>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown; }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string; }): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor?: string; }>;
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
    // Accessing the KV binding. Cloudflare Pages injects bindings into the environment.
    // For Edge Runtime (which App Router handlers on Pages often use),
    // they might be available directly or on a specific context object if provided by next-on-pages.
    // A common pattern is also `(process.env as any).YOUR_BINDING`.
    // Let's try to access it as if it's available in the global scope or process.env.
    // Cloudflare's documentation for Pages + Next.js App Router would be the definitive source.
    // @ts-ignore KVFEATURED is injected by Cloudflare Pages runtime
    const kvBinding = (globalThis as any).KVFEATURED || (process.env as any).KVFEATURED as KVNamespace | undefined;

    if (!kvBinding) {
      console.error("KVFEATURED binding not found. Ensure it is correctly bound in Cloudflare Pages settings and accessible to the Next.js Edge Function.");
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
    // In a real app, you might log error.stack to a logging service
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 