import { NextRequest } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getMergedRSSEntries } from "@/lib/redis";

async function getAllEntries() {
  const token = await convexAuthNextjsToken();
  if (!token) return null;

  const rssKeys = await fetchQuery(api.rssKeys.getUserRSSKeys, {}, { token });
  if (!rssKeys || rssKeys.length === 0) return null;

  const entries = await getMergedRSSEntries(rssKeys);
  if (!entries) return null;

  return entries;
}

export async function GET(request: NextRequest) {
  try {
    const entries = await getAllEntries();
    if (!entries) {
      return Response.json({ 
        entries: [],
        totalEntries: 0
      });
    }

    return Response.json({
      entries,
      totalEntries: entries.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Error fetching RSS entries:', error);
    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 