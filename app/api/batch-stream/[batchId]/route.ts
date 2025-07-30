import { NextRequest, NextResponse } from 'next/server';
import { QueueBatchStatus } from '@/lib/types';
import { getRequestContext } from '@cloudflare/next-on-pages';

// Use Edge runtime for SSE
export const runtime = 'edge';

interface RouteContext {
  params: Promise<{ batchId: string }>;
  env: {
    BATCH_STATUS?: any;
    BATCH_STATUS_DO?: any;
    [key: string]: any;
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { batchId } = params;

    if (!batchId) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

        // Check if Durable Objects are available using getRequestContext
    const { env } = getRequestContext();
    const durableObjectNamespace = env.BATCH_STATUS_DO;
    
    console.log(`🔍 DO DEBUG: Checking for BATCH_STATUS_DO binding...`);
    console.log(`🔍 DO DEBUG: Type of binding:`, typeof durableObjectNamespace);
    console.log(`🔍 DO DEBUG: Binding available:`, !!durableObjectNamespace);

    if (durableObjectNamespace) {
      // Use Durable Object for true real-time updates (NO POLLING!)
      const durableObjectId = durableObjectNamespace.idFromName(batchId);
      const durableObject = durableObjectNamespace.get(durableObjectId);
      
      // Forward request to Durable Object which handles WebSocket/SSE without polling
      // Create a proper URL for the Durable Object
      const url = new URL(request.url);
      url.pathname = `/batch-stream/${batchId}`;
      
      const response = await durableObject.fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      return response;
    }

    // Fallback: Single status check (for development/testing)
    // This is NOT polling - it's a one-time check and immediate close
    console.log(`📡 SSE: Fallback mode for batch ${batchId} (no Durable Objects)`);
    
    const stream = new ReadableStream({
      start: async (controller) => {
        const encoder = new TextEncoder();
        
        // Send connection event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'connected',
            batchId,
            timestamp: Date.now()
          })}\n\n`)
        );

                      // Get current status once
              try {
                const kvBinding = env.BATCH_STATUS;
                console.log(`🔍 SSE: Using getRequestContext for initial BATCH_STATUS lookup...`);
                
                const statusJson = await kvBinding?.get(`batch:${batchId}`);
          
          if (statusJson) {
            const status: QueueBatchStatus = JSON.parse(statusJson);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(status)}\n\n`));
          } else {
            // No status found - send queued status
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              batchId,
              status: 'queued',
              queuedAt: Date.now()
            })}\n\n`));
          }
        } catch (error) {
          console.error(`❌ SSE: Error getting batch status:`, error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              batchId,
              error: 'Failed to get status'
            })}\n\n`)
          );
        }
        
        // For fallback mode, we need to stay open and check KV periodically
        // This is temporary until Durable Objects work
        let pollCount = 0;
        const maxPolls = 30; // 1 minute max (reduced from 2 minutes)
        
        const checkForUpdates = setInterval(async () => {
          try {
            pollCount++;
            console.log(`🔍 SSE: Polling attempt #${pollCount} for batch ${batchId}`);
            
            const kvBinding = env.BATCH_STATUS;
            console.log(`🔍 SSE: Using getRequestContext for BATCH_STATUS...`);
            
            const updatedStatusJson = await kvBinding?.get(`batch:${batchId}`);
            console.log(`🔍 SSE: KV lookup result:`, updatedStatusJson ? 'found' : 'not found');
            
            if (updatedStatusJson) {
              const updatedStatus = JSON.parse(updatedStatusJson);
              console.log(`🔍 SSE: Status from KV:`, updatedStatus.status);
              
              // Only send if status changed
              if (updatedStatus.status !== 'queued') {
                console.log(`📤 SSE: Sending status update:`, updatedStatus.status);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(updatedStatus)}\n\n`));
                
                // Close if completed or failed
                if (updatedStatus.status === 'completed' || updatedStatus.status === 'failed') {
                  console.log(`✅ SSE: Job completed, closing stream`);
                  clearInterval(checkForUpdates);
                  controller.close();
                  return;
                }
              }
            } else {
              console.log(`⚠️ SSE: No status found in KV for batch ${batchId}`);
            }
            
            // Timeout after max polls
            if (pollCount >= maxPolls) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'timeout',
                  batchId,
                  message: 'Stream timeout'
                })}\n\n`)
              );
              clearInterval(checkForUpdates);
              controller.close();
            }
          } catch (error) {
            console.error(`❌ SSE: Error checking for updates:`, error);
            clearInterval(checkForUpdates);
            controller.close();
          }
        }, 1000); // Check every 1 second (optimized for faster detection)
        
        // Clean up on disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(checkForUpdates);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });

  } catch (error) {
    console.error('❌ SSE: Stream creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create stream' }, 
      { status: 500 }
    );
  }
}