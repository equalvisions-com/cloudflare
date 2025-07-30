import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

// Edge Runtime configuration for Cloudflare Pages
export const runtime = 'edge';

// Lightweight API to receive Worker completion results
// Updates batch status and notifies Durable Object for SSE
export async function POST(request: NextRequest) {
  try {
    const { result } = await request.json();
    
    if (!result || !result.batchId) {
      return NextResponse.json(
        { error: 'Invalid result data' },
        { status: 400 }
      );
    }

    console.log(`📡 QUEUE RESULT: Received Worker completion for batch ${result.batchId}`);

    // Get Cloudflare environment for KV and Durable Object access
    const { env } = getRequestContext();
    
    // Update batch status in KV storage
    if (env.BATCH_STATUS) {
      const batchStatus = {
        batchId: result.batchId,
        status: result.success ? 'completed' : 'failed',
        queuedAt: Date.now() - (result.processingTimeMs || 0),
        processedAt: Date.now() - (result.processingTimeMs || 0),
        completedAt: Date.now(),
        result: result
      };

      await env.BATCH_STATUS.put(
        `batch_${result.batchId}`,
        JSON.stringify(batchStatus),
        { expirationTtl: 3600 } // 1 hour TTL
      );

      console.log(`✅ QUEUE RESULT: Updated KV status for batch ${result.batchId}`);
    }

    // Notify Durable Object for real-time SSE updates
    if (env.BATCH_STATUS_DO && result.batchId) {
      try {
        const durableObjectId = env.BATCH_STATUS_DO.idFromName(result.batchId);
        const durableObject = env.BATCH_STATUS_DO.get(durableObjectId);
        
        const notifyResponse = await durableObject.fetch('http://internal/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: result.batchId,
            status: result.success ? 'completed' : 'failed',
            newEntriesCount: result.newEntriesCount || 0,
            entries: result.entries || []
          })
        });

        if (notifyResponse.ok) {
          console.log(`✅ QUEUE RESULT: Notified Durable Object for batch ${result.batchId}`);
        } else {
          console.error(`❌ QUEUE RESULT: Failed to notify Durable Object: ${notifyResponse.status}`);
        }
      } catch (doError) {
        console.error('❌ QUEUE RESULT: Error notifying Durable Object:', doError);
      }
    }

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      processedEntries: result.newEntriesCount || 0
    });

  } catch (error) {
    console.error('❌ QUEUE RESULT: Error processing result:', error);
    return NextResponse.json(
      { error: 'Failed to process queue result' },
      { status: 500 }
    );
  }
}