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

    // Check if Durable Objects are available (production environment)
    const durableObjectNamespace = (globalThis as any).BATCH_STATUS_DO;
    
    if (durableObjectNamespace) {
      // Use Durable Object for true real-time updates (NO POLLING!)
      const durableObjectId = durableObjectNamespace.idFromName(batchId);
      const durableObject = durableObjectNamespace.get(durableObjectId);
      
      // Forward request to Durable Object which handles WebSocket/SSE without polling
      const response = await durableObject.fetch(request.clone());
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
          const statusJson = await (globalThis as any).BATCH_STATUS?.get(`batch:${batchId}`);
          
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
        
        // Close immediately - no polling!
        controller.close();
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