import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Always log to console for debugging
    console.error('Client Error Logged:', {
      timestamp: new Date().toISOString(),
      ...errorData,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    });

    // Try to send to external logging services if available
    const logPromises = [];

    // Try Axiom logging if configured
    if (process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET) {
      logPromises.push(
        fetch(`${process.env.NEXT_PUBLIC_AXIOM_INGEST_ENDPOINT || process.env.AXIOM_INGEST_ENDPOINT || 'https://api.axiom.co'}/v1/datasets/${process.env.AXIOM_DATASET}/ingest`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.AXIOM_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            _time: new Date().toISOString(),
            level: 'error',
            source: 'client',
            ...errorData,
            userAgent: request.headers.get('user-agent'),
            referer: request.headers.get('referer'),
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
          }])
        }).catch(e => console.error('Failed to log to Axiom:', e))
      );
    }

    // Wait for all logging attempts to complete (but don't fail if they do)
    await Promise.allSettled(logPromises);

    return NextResponse.json({ 
      success: true, 
      message: 'Error logged successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to process error log:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to log error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 