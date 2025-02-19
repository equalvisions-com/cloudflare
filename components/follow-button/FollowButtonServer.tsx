import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { FollowButton } from "./FollowButton";
import { Suspense } from "react";

interface FollowButtonServerProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
}

async function FollowStateLoader({ postId, feedUrl, postTitle }: FollowButtonServerProps) {
  // Check authentication on the server side
  const isAuthenticated = await isAuthenticatedNextjs();

  // Only fetch following status if user is authenticated
  let isFollowing = false;
  if (isAuthenticated) {
    isFollowing = await fetchQuery(
      api.following.isFollowing,
      { postId },
      { token: await convexAuthNextjsToken() }
    );
  }

  return (
    <FollowButton 
      postId={postId} 
      feedUrl={feedUrl} 
      postTitle={postTitle}
      initialIsFollowing={isFollowing} 
    />
  );
}

export function FollowButtonServer(props: FollowButtonServerProps) {
  return (
    <Suspense fallback={<FollowButton {...props} initialIsFollowing={false} />}>
      <FollowStateLoader {...props} />
    </Suspense>
  );
}