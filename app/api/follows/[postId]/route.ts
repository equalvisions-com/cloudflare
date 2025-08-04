import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { validateHeaders } from '@/lib/headers';

interface RouteContext {
  params: Promise<{ postId: string }>;
}

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const { postId } = await context.params;
    
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ isFollowing: false });
    }

    // Decode the URL-encoded postId and convert it to a Convex ID
    const decodedPostId = decodeURIComponent(postId);
    // The postId from the URL is already in the correct format for Convex
    const convexPostId = decodedPostId as Id<"posts">;

    const isFollowing = await fetchQuery(api.following.isFollowing, { postId: convexPostId }, { token });

    return NextResponse.json({ isFollowing });
  } catch (error) {
    console.error('Error fetching follow status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 