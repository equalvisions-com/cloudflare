import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function POST(request: NextRequest) {
  try {
    const { guids } = await request.json();
    
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({
        entries: guids.reduce((acc: any, guid: string) => ({
          ...acc,
          [guid]: {
            likes: { isLiked: false, count: 0 },
            comments: { count: 0 }
          }
        }), {})
      });
    }

    // Fetch all likes and comments in parallel
    const [likes, comments] = await Promise.all([
      Promise.all(
        guids.map((guid: string) => Promise.all([
          fetchQuery(api.likes.isLiked, { entryGuid: guid }, { token }),
          fetchQuery(api.likes.getLikeCount, { entryGuid: guid }, { token })
        ]))
      ),
      Promise.all(
        guids.map((guid: string) => 
          fetchQuery(api.comments.getCommentCount, { entryGuid: guid }, { token })
        )
      )
    ]);

    // Combine the results
    const entries = guids.reduce((acc: any, guid: string, index: number) => ({
      ...acc,
      [guid]: {
        likes: { isLiked: likes[index][0], count: likes[index][1] },
        comments: { count: comments[index] }
      }
    }), {});

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error in batch fetch:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 