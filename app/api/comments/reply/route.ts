import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Get the authentication token
    const token = await convexAuthNextjsToken().catch((error) => {
      console.error('Error getting authentication token:', error);
      return null;
    });
    
    // If we couldn't get an auth token, the user is not authenticated
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Parse the request body
    const body = await request.json();
    const { parentId, content, entryGuid, feedUrl } = body;
    
    if (!parentId || !content || !entryGuid || !feedUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Convert the string ID to a Convex ID
    const convexParentId = parentId as Id<"comments">;
    
    // Submit the reply to Convex with authentication token
    const result = await fetchMutation(
      api.comments.addComment, 
      {
        entryGuid,
        feedUrl,
        content,
        parentId: convexParentId
      },
      { token }
    );
    
    return NextResponse.json({ success: true, commentId: result });
  } catch (error: unknown) {
    console.error('Error submitting comment reply:', error);
    return NextResponse.json({ error: 'Failed to submit reply' }, { status: 500 });
  }
} 