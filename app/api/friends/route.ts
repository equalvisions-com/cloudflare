import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const username = searchParams.get("username");
  const cursor = searchParams.get("cursor");
  
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }
  
  try {
    const result = await fetchQuery(api.friends.getFriendsByUsername, { 
      username,
      status: "accepted",
      limit: 30,
      cursor: cursor || undefined
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
} 