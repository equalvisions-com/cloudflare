import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { FollowButtonServer } from "@/components/follow-button/FollowButtonServer";
import { Suspense } from "react";
import { Id } from "@/convex/_generated/dataModel";

export interface RelatedPost {
  title: string;
  featuredImg?: string;
  postSlug: string;
  categorySlug: string;
  _id: Id<"posts">;
  feedUrl: string;
}

interface RelatedPostsCardProps {
  posts: RelatedPost[];
}

export const RelatedPostsCard = ({ posts }: RelatedPostsCardProps) => {
  if (!posts.length) return null;

  return (
    <Card className="h-fit shadow-none">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">You May Also Like</h2>
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post._id} className="flex items-start gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {post.featuredImg && (
                  <div className="relative w-16 h-16 shrink-0">
                    <Image
                      src={post.featuredImg}
                      alt={post.title}
                      fill
                      className="object-cover rounded-md"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={`/${post.categorySlug}/${post.postSlug}`}
                    className="text-sm font-medium hover:underline line-clamp-2"
                  >
                    {post.title}
                  </a>
                </div>
              </div>
              <div className="shrink-0">
                <Suspense>
                  <FollowButtonServer
                    postId={post._id}
                    feedUrl={post.feedUrl}
                    postTitle={post.title}
                  />
                </Suspense>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const RelatedPostsCardSkeleton = () => (
  <Card className="h-fit shadow-none">
    <CardContent className="p-4">
      <h2 className="text-lg font-semibold mb-4">You May Also Like</h2>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-16 h-16 bg-muted rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
            <div className="shrink-0 w-20 h-8 bg-muted rounded" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
); 