import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { FollowButton } from "./FollowButton";
import { Suspense } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

interface FollowButtonServerProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
}

// Loading fallback that matches the exact dimensions and style of the actual button
function LoadingFallback() {
  return (
    <Button
      variant="default"
      className="w-28 disabled:opacity-100"
      disabled
    >
      Follow
    </Button>
  );
}

async function FollowStateLoader({ postId, feedUrl, postTitle }: FollowButtonServerProps) {
  const isAuthenticated = await isAuthenticatedNextjs();
  let initialIsFollowing = false;

  if (isAuthenticated) {
    const token = await convexAuthNextjsToken();
    try {
      initialIsFollowing = await fetchQuery(api.following.isFollowing, { postId }, { token });
    } catch (error) {
      console.error('Error fetching initial follow state:', error);
      // On error, we'll fall back to false
    }
  }

  return (
    <FollowButton
      postId={postId}
      feedUrl={feedUrl}
      postTitle={postTitle}
      initialIsFollowing={initialIsFollowing}
    />
  );
}

export function FollowButtonServer(props: FollowButtonServerProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FollowStateLoader {...props} />
    </Suspense>
  );
}