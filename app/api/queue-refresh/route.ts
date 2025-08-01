import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { validateHeaders } from '@/lib/headers';
import type { QueueFeedRefreshMessage, QueueBatchStatus } from '@/lib/types';

// Add Edge Runtime configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Helper function to log queue operations in production
const devLog = (message: string, data?: unknown) => {
  // Always log queue operations for debugging
  if (data) {
    console.log(message, data);
  } else {
    console.log(message);
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
// Note: Batch status is now handled entirely by Durable Objects
// KV operations removed to eliminate redundancy

// Fallback function to process directly when queue isn't available
async function processDirectly(queueMessage: QueueFeedRefreshMessage) {
  try {
    // Call our own consumer endpoint directly
    const response = await fetch('/api/queue-consumer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queueMessage),
    });

    if (!response.ok) {
      throw new Error(`Direct processing error: ${response.status}`);
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      batchId: queueMessage.batchId,
      status: 'completed',
      processedDirectly: true,
      result: result
    });
  } catch (error) {
    console.error('❌ Direct processing failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Processing failed' 
    }, { status: 500 });
  }
}

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
    
    // Always log for debugging
    console.log('📥 QUEUE PRODUCER: Received request', {
      postTitlesCount: postTitles?.length || 0,
      feedUrlsCount: feedUrls?.length || 0,
      mediaTypesCount: mediaTypes?.length || 0,
      existingGuidsCount: existingGuids?.length || 0,
      newestEntryDate,
      priority
    });
    
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

    // Always log in production for debugging
    console.log('📤 QUEUE PRODUCER: Sending message', {
      batchId,
      feedsCount: feeds.length,
      messageStructure: {
        hasFeeds: !!queueMessage.feeds,
        feedsLength: queueMessage.feeds?.length,
        feedsType: typeof queueMessage.feeds,
        sampleFeed: queueMessage.feeds?.[0]
      }
    });

    // Try queue binding first, fallback to HTTP API
    const queue = (globalThis as any).QUEUE || (process.env as any).QUEUE;
    
    try {
      if (queue) {
        // Use queue binding if available
        await queue.send(queueMessage, {
          delaySeconds: priority === 'high' ? 0 : 2,
        });
        console.log('✅ QUEUE PRODUCER: Message sent via binding', { batchId, feedCount: feeds.length });
      } else {
        // Fallback: Use Cloudflare REST API to send to queue
        console.log('⚠️ QUEUE PRODUCER: No binding, using REST API fallback');
        
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;
        
        if (!accountId || !apiToken) {
          console.log('❌ QUEUE PRODUCER: Missing Cloudflare credentials for REST API');
          // For now, process directly to avoid blocking users
          return await processDirectly(queueMessage);
        }

        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/ac0fb53bb4eb4fdb9d8e2fa36f8e7504/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            body: queueMessage,
            delaySeconds: priority === 'high' ? 0 : 2,
          }]),
        });

        if (!response.ok) {
          throw new Error(`Queue REST API error: ${response.status}`);
        }

        console.log('✅ QUEUE PRODUCER: Message sent via REST API', { batchId, feedCount: feeds.length });
      }

      // Note: Batch status now tracked entirely by Durable Objects via enhanced worker
      console.log(`🚀 Queue: Batch ${batchId} queued - status tracked by Durable Objects`);

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

// GET endpoint - Deprecated: Use SSE via /api/batch-stream/[batchId] for real-time updates
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const batchId = url.searchParams.get('batchId');

  return NextResponse.json({ 
    message: 'Batch status polling deprecated. Use real-time SSE instead.',
    batchId,
    sseEndpoint: batchId ? `/api/batch-stream/${batchId}` : '/api/batch-stream/[batchId]',
    note: 'Connect to SSE endpoint for real-time updates via Durable Objects'
  }, { status: 200 });
} 