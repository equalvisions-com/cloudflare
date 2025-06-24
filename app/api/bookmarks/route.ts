import { NextRequest, NextResponse } from 'next/server';
import { getBookmarksData } from '@/app/actions/bookmarkActions';
import { Id } from '@/convex/_generated/dataModel';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

// Use Edge runtime for this API route
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the authenticated user's ID from Convex (single source of truth)
    const currentUser = await fetchQuery(api.users.viewer, {}, { token });
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    // 🔒 SECURE: Always use authenticated user's ID (no userId parameter needed)
    const data = await getBookmarksData(currentUser._id, skip, limit);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
} 