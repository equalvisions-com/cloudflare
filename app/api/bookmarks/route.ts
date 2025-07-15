import { NextRequest, NextResponse } from 'next/server';
import { getBookmarksData } from '@/app/actions/bookmarkActions';
import { Id } from '@/convex/_generated/dataModel';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

// Use Edge runtime for this API route
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Get currentUserId and pagination parameters from request body
    const body = await request.json();
    const { currentUserId, skip = 0, limit = 30 } = body;

    // CurrentUserId is required - this comes from sidebar context
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required - currentUserId missing' },
        { status: 401 }
      );
    }

    // Try to get authentication token (for metrics and authenticated queries)
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 🔒 SECURE: Use currentUserId from sidebar context (no api.users.viewer call needed)
    const data = await getBookmarksData(currentUserId, skip, limit);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
} 