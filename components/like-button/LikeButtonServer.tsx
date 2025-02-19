import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { LikeButton } from "./LikeButton";
import { Suspense } from "react";

interface LikeButtonServerProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
}

async function LikeStateLoader({ entryGuid, feedUrl, title, pubDate, link }: LikeButtonServerProps) {
  const isAuthenticated = await isAuthenticatedNextjs();
  let initialIsLiked = false;
  let initialLikeCount = 0;
  if (isAuthenticated) {
    const token = await convexAuthNextjsToken();
    initialIsLiked = await fetchQuery(api.likes.isLiked, { entryGuid }, { token });
    initialLikeCount = await fetchQuery(api.likes.getLikeCount, { entryGuid }, { token });
  }
  return (
    <LikeButton
      entryGuid={entryGuid}
      feedUrl={feedUrl}
      title={title}
      pubDate={pubDate}
      link={link}
      initialIsLiked={initialIsLiked}
      initialLikeCount={initialLikeCount}
    />
  );
}

export function LikeButtonServer(props: LikeButtonServerProps) {
  return (
    <Suspense fallback={<LikeButton {...props} initialIsLiked={false} initialLikeCount={0} />}>
      <LikeStateLoader {...props} />
    </Suspense>
  );
}