import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Enhanced server error logging
    const enhancedErrorData = {
      timestamp: new Date().toISOString(),
      type: 'server_error',
      ...errorData,
      headers: {
        'user-agent': request.headers.get('user-agent'),
        'referer': request.headers.get('referer'),
        'x-forwarded-for': request.headers.get('x-forwarded-for'),
        'cf-ray': request.headers.get('cf-ray'),
        'cf-ipcountry': request.headers.get('cf-ipcountry')
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        runtime: 'edge'
      }
    };

    // Always log to console for debugging
    console.error('🔥 SERVER ERROR LOGGED:', enhancedErrorData);

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
          body: JSON.stringify([enhancedErrorData])
        }).catch(e => console.error('Failed to log to Axiom:', e))
      );
    }

    // Wait for all logging attempts to complete
    await Promise.allSettled(logPromises);

    return NextResponse.json({ 
      success: true, 
      message: 'Server error logged successfully',
      timestamp: new Date().toISOString(),
      digest: errorData.digest || 'no-digest'
    });
    
  } catch (error) {
    console.error('Failed to log server error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to log server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 