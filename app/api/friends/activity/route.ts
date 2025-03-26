import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { cookies } from 'next/headers';

// Helper function to get Convex client
function getConvexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
}

export async function GET(request: NextRequest) {
  try {
    // Get Convex client
    const convex = getConvexClient();
    
    // Get the current user using Convex
    const currentUser = await convex.query(api.users.viewer);
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '30');
    
    // Calculate offset
    const offset = (page - 1) * pageSize;
    
    // Fetch friend activities
    const friendActivities = await convex.query(api.friends.getFriendActivities, {
      userId: currentUser._id,
      skip: offset,
      limit: pageSize
    });
    
    return NextResponse.json({
      activityGroups: friendActivities.activityGroups,
      hasMore: friendActivities.hasMore
    });
  } catch (error) {
    console.error('Error in friend activity API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friend activities' },
      { status: 500 }
    );
  }
} 