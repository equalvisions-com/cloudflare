import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { validateHeaders } from '@/lib/headers';

export const runtime = 'edge';

interface MissingEntryLog {
  entryGuid: string;
  feedUrl?: string;
  title?: string;
  pubDate?: string;
  timestamp?: number;
  component: string;
  logLevel: 'info' | 'warning' | 'error';
}

export async function POST(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const data: MissingEntryLog = await request.json();
    
    // Initialize Axiom logger for edge runtime - use same source as middleware for consistency
    const logger = new Logger({ source: 'middleware' });
    
    // Log the missing entry with structured data
    logger.warn('Missing RSS entry details in user feed', {
      entryGuid: data.entryGuid,
      feedUrl: data.feedUrl,
      title: data.title,
      pubDate: data.pubDate,
      timestamp: data.timestamp,
      component: data.component,
      userAgent: request.headers.get('user-agent'),
      url: request.headers.get('referer'),
      loggedAt: new Date().toISOString(),
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging missing entry:', error);
    return NextResponse.json(
      { error: 'Failed to log missing entry' },
      { status: 500 }
    );
  }
} 
