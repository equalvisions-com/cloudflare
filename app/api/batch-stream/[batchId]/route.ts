import { NextRequest, NextResponse } from 'next/server';
import { QueueBatchStatus } from '@/lib/types';

// Use Edge runtime for SSE
export const runtime = 'edge';

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { batchId } = params;

    if (!batchId) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        console.log(`📡 SSE: Starting stream for batch ${batchId}`);
        
        // Send initial connection event
        controller.enqueue(
          `data: ${JSON.stringify({ 
            type: 'connected', 
            batchId, 
            timestamp: Date.now() 
          })}\n\n`
        );

        let pollCount = 0;
        const maxPolls = 120; // 2 minutes max (120 * 1 second)
        
        // Poll KV for batch status updates
        const pollInterval = setInterval(async () => {
          try {
            pollCount++;
            
            // Get batch status from KV
            const statusJson = await (globalThis as any).BATCH_STATUS?.get(`batch:${batchId}`);
            
            if (statusJson) {
              const status: QueueBatchStatus = JSON.parse(statusJson);
              
              // Send status update
              controller.enqueue(`data: ${JSON.stringify(status)}\n\n`);
              
              // Close stream if completed or failed
              if (status.status === 'completed' || status.status === 'failed') {
                console.log(`✅ SSE: Batch ${batchId} finished with status: ${status.status}`);
                clearInterval(pollInterval);
                controller.close();
                return;
              }
            }
            
            // Timeout after max polls
            if (pollCount >= maxPolls) {
              console.log(`⏰ SSE: Timeout for batch ${batchId} after ${maxPolls} seconds`);
              controller.enqueue(
                `data: ${JSON.stringify({ 
                  type: 'timeout', 
                  batchId, 
                  message: 'Stream timeout' 
                })}\n\n`
              );
              clearInterval(pollInterval);
              controller.close();
            }
          } catch (error) {
            console.error(`❌ SSE: Error polling batch ${batchId}:`, error);
            controller.enqueue(
              `data: ${JSON.stringify({ 
                type: 'error', 
                batchId, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              })}\n\n`
            );
            clearInterval(pollInterval);
            controller.close();
          }
        }, 1000); // Poll every 1 second

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          console.log(`🔌 SSE: Client disconnected from batch ${batchId}`);
          clearInterval(pollInterval);
          controller.close();
        });
      },
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