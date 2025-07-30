// cloudflare-workers/batch-status-durable-object.ts
// Durable Object for managing batch status with real-time WebSocket connections
// NO POLLING - purely event-driven

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('Batch Status Manager Worker', { status: 200 });
  }
};

export class BatchStatusDurableObject {
  private storage: DurableObjectStorage;
  private env: Env;
  private sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.headers.get('upgrade') === 'websocket') {
      // Handle WebSocket connection for real-time updates
      return this.handleWebSocket(request);
    }
    
    if (url.pathname.endsWith('/status')) {
      // Handle status updates from queue consumer
      return this.handleStatusUpdate(request);
    }

    // Handle SSE fallback for browsers that prefer SSE over WebSocket
    return this.handleSSE(request);
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    
    server.accept();
    this.sessions.add(server);

    // Send initial connection confirmation
    server.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now()
    }));

    // Clean up on disconnect
    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });

    server.addEventListener('error', () => {
      this.sessions.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleSSE(request: Request): Promise<Response> {
    // SSE implementation without polling
    const stream = new ReadableStream({
      start: (controller) => {
        const encoder = new TextEncoder();
        
        // Send initial connection
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'connected',
            timestamp: Date.now()
          })}\n\n`)
        );

        // Set up a listener for status changes (no polling!)
        const listener = (status: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(status)}\n\n`)
          );
          
          if (status.status === 'completed' || status.status === 'failed') {
            controller.close();
          }
        };

        // Store the listener for this connection
        (this as any).sseListeners = (this as any).sseListeners || new Set();
        (this as any).sseListeners.add(listener);

        // Clean up on disconnect
        request.signal.addEventListener('abort', () => {
          (this as any).sseListeners?.delete(listener);
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
      },
    });
  }

  private async handleStatusUpdate(request: Request): Promise<Response> {
    try {
      const status = await request.json();
      
      // Store the status
      await this.storage.put('status', status);
      
      // Broadcast to all connected WebSocket clients (NO POLLING!)
      const message = JSON.stringify(status);
      for (const session of this.sessions) {
        try {
          session.send(message);
        } catch (error) {
          // Clean up broken connections
          this.sessions.delete(session);
        }
      }

      // Broadcast to SSE listeners (NO POLLING!)
      if ((this as any).sseListeners) {
        for (const listener of (this as any).sseListeners) {
          try {
            listener(status);
          } catch (error) {
            (this as any).sseListeners.delete(listener);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update status' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Get current status (for initial load)
  async getStatus(): Promise<any> {
    return await this.storage.get('status');
  }
}