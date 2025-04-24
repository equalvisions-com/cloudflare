import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

// Use Edge runtime for this API route
export const runtime = 'edge';

// Create a Convex client for making API calls
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    
    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }
    
    // Convert the string ID to a Convex ID
    const convexCommentId = commentId as Id<"comments">;
    
    // Fetch replies from Convex
    const replies = await convex.query(api.comments.getCommentReplies, { 
      commentId: convexCommentId 
    });
    
    return NextResponse.json({ replies });
  } catch (error) {
    console.error('Error fetching comment replies:', error);
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
  }
} 