import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchMutation } from "convex/nextjs";

export async function DELETE(req: NextRequest) {
  try {
    // Get the authentication token
    const token = await convexAuthNextjsToken().catch((error) => {
      console.error("Failed to get auth token:", error);
      return null;
    });
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get the comment ID from the query parameters
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get('commentId');
    
    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      );
    }
    
    // Call the Convex mutation to delete the comment with the authentication token
    await fetchMutation(
      api.comments.deleteComment, 
      { commentId: commentId as unknown as Id<"comments"> },
      { token }
    );
    
    // Return success response
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting comment:', error);
    
    // Cast to an object with message property if it exists
    const errorWithMessage = error as { message?: string };
    
    // Handle specific error types
    if (errorWithMessage.message?.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'You must be logged in to delete a comment' },
        { status: 401 }
      );
    } else if (errorWithMessage.message?.includes('not authorized')) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this comment' },
        { status: 403 }
      );
    } else if (errorWithMessage.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }
    
    // Generic error response
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
} 