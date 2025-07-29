import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { validateHeaders } from '@/lib/headers';
import type { QueueFeedRefreshMessage, QueueBatchStatus } from '@/lib/types';

// Add Edge Runtime configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Helper function to log only in development
const devLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

// Helper function to log errors
const errorLog = (message: string, error?: unknown) => {
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }
};

// In-memory store for tracking batch status (in production, use KV or D1)
const batchStatusStore = new Map<string, QueueBatchStatus>();

export async function POST(request: NextRequest) {
  if (!validateHeaders(request as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Verify user authentication
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { postTitles, feedUrls, mediaTypes, existingGuids = [], newestEntryDate, priority = 'normal' } = body;
    
    devLog('📥 QUEUE PRODUCER: Received refresh request', {
      postTitlesCount: postTitles?.length || 0,
      feedUrlsCount: feedUrls?.length || 0,
      mediaTypesCount: mediaTypes?.length || 0,
      existingGuidsCount: existingGuids?.length || 0,
      newestEntryDate,
      priority
    });

    // Validate input
    if (!postTitles || !Array.isArray(postTitles) || postTitles.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid postTitles - must be non-empty array' 
      }, { status: 400 });
    }

    if (!feedUrls || !Array.isArray(feedUrls) || feedUrls.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid feedUrls - must be non-empty array' 
      }, { status: 400 });
    }

    if (postTitles.length !== feedUrls.length) {
      return NextResponse.json({ 
        success: false, 
        error: 'postTitles and feedUrls arrays must have the same length' 
      }, { status: 400 });
    }

    // Generate unique batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Extract user ID from token for queue context
    // Note: You may need to decode the JWT token to get the actual user ID
    const userId = 'user_from_token'; // TODO: Extract actual user ID from token

    // Normalize arrays
    const normalizedPostTitles = postTitles.map((title: string) => String(title).trim());
    const normalizedFeedUrls = feedUrls.map((url: string) => String(url).trim());
    const normalizedMediaTypes = mediaTypes ? mediaTypes.map((type: string) => String(type).trim()) : [];

    // Create feed objects for the queue message
    const feeds = normalizedPostTitles.map((title, index) => ({
      postTitle: title,
      feedUrl: normalizedFeedUrls[index],
      mediaType: normalizedMediaTypes[index] || undefined
    }));

    // Create queue message
    const queueMessage: QueueFeedRefreshMessage = {
      batchId,
      timestamp,
      userId,
      feeds,
      existingGuids,
      newestEntryDate,
      priority,
      retryCount: 0,
      maxRetries: 3
    };

    devLog('📤 QUEUE PRODUCER: Sending message', {
      batchId,
      feedsCount: feeds.length,
      messageStructure: {
        hasFeeds: !!queueMessage.feeds,
        feedsLength: queueMessage.feeds?.length,
        feedsType: typeof queueMessage.feeds,
        sampleFeed: queueMessage.feeds?.[0]
      }
    });

    // Access the queue binding
    // @ts-ignore QUEUE is injected by Cloudflare runtime
    const queue = (globalThis as any).QUEUE || (process.env as any).QUEUE;
    
    if (!queue) {
      errorLog('❌ QUEUE PRODUCER: Queue binding not found');
      return NextResponse.json({ 
        success: false, 
        error: 'Queue service temporarily unavailable' 
      }, { status: 503 });
    }

    try {
      // Send message to queue with batching options
      await queue.send(queueMessage, {
        // Batch messages for up to 5 seconds or 10 messages, whichever comes first
        delaySeconds: priority === 'high' ? 0 : 2, // High priority processes immediately
      });

      devLog('✅ QUEUE PRODUCER: Message sent to queue', { batchId, feedCount: feeds.length });

      // Store batch status for tracking
      const batchStatus: QueueBatchStatus = {
        batchId,
        status: 'queued',
        queuedAt: timestamp
      };
      batchStatusStore.set(batchId, batchStatus);

      // Return immediate response with batch tracking info
      return NextResponse.json({
        success: true,
        batchId,
        status: 'queued',
        queuedAt: timestamp,
        estimatedProcessingTime: feeds.length * 500, // Rough estimate in ms
        message: `Queued ${feeds.length} feeds for refresh`
      });

    } catch (queueError) {
      errorLog('❌ QUEUE PRODUCER: Failed to send message to queue', queueError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to queue refresh request' 
      }, { status: 500 });
    }

  } catch (error) {
    errorLog('❌ QUEUE PRODUCER: Error processing request', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to check batch status
export async function GET(request: NextRequest) {
  if (!validateHeaders(request as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const batchId = url.searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json({ 
      error: 'Missing batchId parameter' 
    }, { status: 400 });
  }

  const batchStatus = batchStatusStore.get(batchId);
  
  if (!batchStatus) {
    return NextResponse.json({ 
      error: 'Batch not found' 
    }, { status: 404 });
  }

  return NextResponse.json(batchStatus);
} 