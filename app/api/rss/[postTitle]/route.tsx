import { getRSSEntries } from "@/lib/redis";

interface RouteContext {
  params: Promise<{ postTitle: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext
): Promise<Response> {
  let postTitle = '';
  try {
    const params = await context.params;
    postTitle = params.postTitle;
    const decodedTitle = decodeURIComponent(postTitle);
    const feedUrl = new URL(request.url).searchParams.get('feedUrl');

    console.log(`[RSS Cache] API request for feed: ${feedUrl}`);

    if (!feedUrl) {
      console.log(`[RSS Cache] API error: Feed URL is required`);
      return Response.json(
        { error: 'Feed URL is required' },
        { status: 400 }
      );
    }

    const entries = await getRSSEntries(decodedTitle, feedUrl);
    if (!entries) {
      console.log(`[RSS Cache] API: No entries found for feed: ${feedUrl}`);
      return Response.json({ entries: [] });
    }

    console.log(`[RSS Cache] API: Returning ${entries.length} entries for feed: ${feedUrl}`);
    return Response.json({
      entries
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error(`[RSS Cache] API error for feed ${postTitle}:`, error);
    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 