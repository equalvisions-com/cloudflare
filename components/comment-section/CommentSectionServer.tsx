import { Suspense } from "react";
import { CommentSectionWrapper } from "./CommentSectionWrapper";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { CommentButtonFallback } from "./CommentButtonFallback";

interface CommentSectionServerProps {
  entryGuid: string;
  feedUrl: string;
}

// Sanitize comment data for client use
function sanitizeComment(comment: any) {
  return {
    id: comment._id,
    content: comment.content,
    createdAt: comment.createdAt,
    authorName: comment.username,
    isAuthor: comment.userId === comment.user?._id,
  };
}

async function CommentStateLoader({ entryGuid, feedUrl }: CommentSectionServerProps) {
  // Check server-side authentication
  const isAuthenticated = await isAuthenticatedNextjs();
  const token = isAuthenticated ? await convexAuthNextjsToken() : undefined;

  // Fetch initial comment count and comments concurrently
  const [commentCount, comments] = await Promise.all([
    fetchQuery(api.comments.getCommentCount, { entryGuid }, { token }),
    fetchQuery(api.comments.getComments, { entryGuid }, { token }),
  ]);

  // Sanitize comments before passing to client
  const sanitizedComments = comments.map(sanitizeComment);

  return (
    <CommentSectionWrapper 
      entryGuid={entryGuid}
      feedUrl={feedUrl}
      initialCommentCount={commentCount}
      initialComments={sanitizedComments}
      isAuthenticated={isAuthenticated}
    />
  );
}

export function CommentSectionServer(props: CommentSectionServerProps) {
  return (
    <Suspense fallback={<CommentButtonFallback />}>
      <CommentStateLoader {...props} />
    </Suspense>
  );
}