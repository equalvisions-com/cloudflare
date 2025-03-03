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

// Loading fallback that exactly matches the button dimensions and style
function LoadingFallback() {
  return (
    <Button
      variant="default"
      className="rounded-full opacity-50 transition-opacity duration-200"
      disabled
    >
      Follow
    </Button>
  );
}

async function FollowStateLoader({ postId, feedUrl, postTitle }: FollowButtonServerProps) {
  // Pre-fetch the authentication and follow state on the server
  const [isAuthenticated, token] = await Promise.all([
    isAuthenticatedNextjs(),
    convexAuthNextjsToken().catch(() => null)
  ]);

  let initialIsFollowing = false;

  // Only attempt to fetch follow state if authenticated and we have a token
  if (isAuthenticated && token) {
    try {
      initialIsFollowing = await fetchQuery(api.following.isFollowing, { postId }, { token });
    } catch (error) {
      console.error('Error fetching initial follow state:', error);
      // On error, we'll fall back to false but still render the button
    }
  }

  return (
    <FollowButton
      postId={postId}
      feedUrl={feedUrl}
      postTitle={postTitle}
      initialIsFollowing={initialIsFollowing}
      isAuthenticated={isAuthenticated}
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