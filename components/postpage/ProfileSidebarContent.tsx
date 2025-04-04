import { Suspense } from "react";
import { AboutCard } from "./AboutCard";
import { RelatedPost, RelatedPostsCard, RelatedPostsCardSkeleton } from "./RelatedPostsCard";

interface ProfileSidebarContentProps {
  className?: string;
  category?: string;
  author?: string;
  authorUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  platform?: string;
  categorySlug?: string;
  relatedPosts?: RelatedPost[];
  relatedFollowStates?: {
    [postId: string]: {
      isAuthenticated: boolean;
      isFollowing: boolean;
    };
  };
}

export const ProfileSidebarContent = ({
  className,
  category,
  author,
  authorUrl,
  twitterUrl,
  websiteUrl,
  platform,
  categorySlug,
  relatedPosts,
  relatedFollowStates = {}
}: ProfileSidebarContentProps) => {
  return (
    <div className={`${className} space-y-6`}>
      <AboutCard
        category={category}
        categorySlug={categorySlug}
        author={author}
        authorUrl={authorUrl}
        platform={platform}
        websiteUrl={websiteUrl}
        twitterUrl={twitterUrl}
      />

      {/* You May Also Like Card */}
      {relatedPosts && relatedPosts.length > 0 && (
        <Suspense fallback={<RelatedPostsCardSkeleton />}>
          <RelatedPostsCard 
            posts={relatedPosts} 
            followStates={relatedFollowStates}
          />
        </Suspense>
      )}
    </div>
  );
}; 