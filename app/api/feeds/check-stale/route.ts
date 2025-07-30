import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';

// Edge Runtime configuration for Cloudflare Pages
export const runtime = 'edge';

// Lightweight API to check which feeds need refreshing
// Called by Worker to determine stale feeds
export async function POST(request: NextRequest) {
  try {
    const { postTitles } = await request.json();
    
    if (!postTitles || !Array.isArray(postTitles)) {
      return NextResponse.json(
        { error: 'Invalid postTitles array' },
        { status: 400 }
      );
    }

    console.log(`🔍 STALE CHECK: Checking ${postTitles.length} feeds for staleness`);

    // Check which feeds are stale (older than 4 hours)
    const fourHoursInMs = 4 * 60 * 60 * 1000;
    const currentTime = Date.now();
    
    const placeholders = postTitles.map(() => '?').join(',');
    
    const staleFeedsQuery = `
      SELECT title, last_fetched
      FROM rss_feeds 
      WHERE title IN (${placeholders})
      AND (last_fetched IS NULL OR last_fetched < ?)
    `;
    
    const staleFeedsResult = await executeRead(
      staleFeedsQuery, 
      [...postTitles, currentTime - fourHoursInMs]
    );

    const staleFeedTitles = staleFeedsResult.rows.map((row: any) => row.title);
    
    console.log(`✅ STALE CHECK: Found ${staleFeedTitles.length} stale feeds out of ${postTitles.length} total`);

    return NextResponse.json({
      success: true,
      staleFeedTitles,
      totalChecked: postTitles.length,
      staleCount: staleFeedTitles.length
    });

  } catch (error) {
    console.error('❌ STALE CHECK: Error checking stale feeds:', error);
    return NextResponse.json(
      { error: 'Failed to check stale feeds' },
      { status: 500 }
    );
  }
}