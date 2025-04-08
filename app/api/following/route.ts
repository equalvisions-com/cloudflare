import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Id } from "@/convex/_generated/dataModel";

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const username = searchParams.get("username");
  const cursor = searchParams.get("cursor");
  
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }
  
  try {
    const result = await fetchQuery(api.following.getFollowingByUsername, { 
      username,
      limit: 30,
      cursor: cursor ? cursor as Id<"following"> : undefined
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching following:", error);
    return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
  }
} 