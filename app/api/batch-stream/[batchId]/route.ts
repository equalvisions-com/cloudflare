import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

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

    // Get Durable Object for real-time SSE (NO POLLING!)
    const { env } = getRequestContext();
    const durableObjectNamespace = env.BATCH_STATUS_DO;
    
    if (!durableObjectNamespace) {
      return NextResponse.json({ 
        error: 'Durable Objects not available. Please check Cloudflare Pages bindings.' 
      }, { status: 500 });
    }

    console.log(`🔍 SSE: Using Durable Object for batch ${batchId}`);
    
    // Get Durable Object instance and forward the request
    const durableObjectId = durableObjectNamespace.idFromName(batchId);
    const durableObject = durableObjectNamespace.get(durableObjectId);
    
    // Create proper URL for Durable Object
    const url = new URL(request.url);
    url.pathname = `/batch-stream/${batchId}`;
    
    const response = await durableObject.fetch(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    
    return response;



  } catch (error) {
    console.error('❌ SSE: Stream creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create stream' }, 
      { status: 500 }
    );
  }
}