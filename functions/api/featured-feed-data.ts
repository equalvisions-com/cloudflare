// functions/api/featured-feed-data.ts

import { getInitialEntries } from '@/components/featured/FeaturedFeed';
import type { FeaturedEntry as OriginalFeaturedEntry } from '@/lib/featured_kv'; // Import the base entry type

// Define the structure for the items within the 'entries' array
interface PostMetadataForFeed {
  title: string;
  featuredImg?: string;
  mediaType: string; // was 'article' by default, ensure this is accurate
  postSlug: string;
  categorySlug: string;
  // Add verified if it's part of the metadata returned by getInitialEntries
  verified?: boolean;
}

interface MetricsForFeed {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
  // Add bookmarks if it's part of the metrics
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
  message?: string; // For messages like "No featured content available."
}

// Type definition for Cloudflare KVNamespace if not globally available
// Ensure your project's tsconfig includes Cloudflare worker types if possible
// to avoid needing this in every file.
interface KVNamespace {
  get<T = string>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  getWithMetadata<T = string, Metadata = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<{ value: T | null; metadata: Metadata | null }>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown; }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string; }): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor?: string; }>;
}

// Environment expected by the Pages Function
interface PagesFunctionEnv {
  // This tells TypeScript that your environment will have KVFEATURED
  KVFEATURED: KVNamespace;
  // Add other bindings from your Cloudflare Pages project settings if needed
}

// Context for the Pages Function handler
interface PagesEventContext {
  request: Request;
  env: PagesFunctionEnv;
  params: Record<string, string>; // For dynamic routes like /api/items/[id].ts
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  functionPath: string;
}

export async function onRequestGet(context: PagesEventContext): Promise<Response> {
  try {
    const kvBinding = context.env.KVFEATURED;

    if (!kvBinding) {
      console.error("KVFEATURED binding not found in Pages Function context.");
      return new Response(JSON.stringify({ error: "Server configuration error: KV binding missing." } as { error: string }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const featuredDataResult: FeaturedData | null = await getInitialEntries(kvBinding);

    if (!featuredDataResult || featuredDataResult.entries.length === 0) {
      return new Response(JSON.stringify({ entries: [], totalEntries: 0, message: "No featured content available." } as FeaturedData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify(featuredDataResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error fetching featured feed data in Pages Function:", error);
    let errorMessage = "Failed to fetch featured feed data.";
    // In a real app, you might log error.stack to a logging service
    return new Response(JSON.stringify({ error: errorMessage } as { error: string }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// If you want this function to handle all methods (GET, POST, etc.),
// you can rename onRequestGet to just onRequest:
// export async function onRequest(context: PagesEventContext): Promise<Response> {
//   if (context.request.method === "GET") {
//     // ... handle GET ...
//   } else {
//     return new Response("Method not allowed", { status: 405 });
//   }
// } 