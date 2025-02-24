import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

// Define the route context type with async params
interface RouteContext {
  params: Promise<{ guid: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Await the params to get the actual values
    const { guid } = await context.params;
    const decodedGuid = decodeURIComponent(guid);
    const token = await convexAuthNextjsToken();

    // Use getEntryMetrics to get comment count
    const metrics = await fetchQuery(
      api.entries.getEntryMetrics,
      { entryGuid: decodedGuid },
      { token }
    );

    return NextResponse.json({
      count: metrics.comments.count
    });
  } catch (error) {
    console.error('Error fetching comment count:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}