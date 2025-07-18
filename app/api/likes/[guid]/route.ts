import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { validateHeaders } from '@/lib/headers';

// Add the Edge Runtime configuration
export const runtime = 'edge';

// Define the route context type with async params
interface RouteContext {
  params: Promise<{ guid: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Await the params to get the actual values
    const { guid } = await context.params;
    const decodedGuid = decodeURIComponent(guid);
    const token = await convexAuthNextjsToken();

    // Use getEntryMetrics to get like data
    const metrics = await fetchQuery(
      api.entries.getEntryMetrics,
      { entryGuid: decodedGuid },
      { token }
    );

    return NextResponse.json({
      isLiked: metrics.likes.isLiked,
      count: metrics.likes.count
    });
  } catch (error) {
    console.error('Error fetching like data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 