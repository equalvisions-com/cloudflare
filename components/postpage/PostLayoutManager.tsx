import { Id } from "@/convex/_generated/dataModel";
import { ProfileSidebarContent } from "@/components/postpage/ProfileSidebarContent";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";

type Post = {
  _id: Id<"posts">;
  title: string;
  category: string;
  body: string;
  featuredImg?: string;
  feedUrl: string;
  author: string;
  authorUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  platform: string;
  categorySlug: string;
  relatedPosts?: Array<{
    _id: Id<"posts">;
    title: string;
    featuredImg?: string;
    postSlug: string;
    categorySlug: string;
    feedUrl: string;
  }>;
};

interface PostLayoutManagerProps {
  children: React.ReactNode;
  post: Post;
  className?: string;
  relatedFollowStates: {
    [postId: string]: {
      isAuthenticated: boolean;
      isFollowing: boolean;
    };
  };
}

/**
 * Server component that manages the layout for individual post pages
 * Uses StandardSidebarLayout for consistent layout across the application
 */
export const PostLayoutManager = ({ 
  children,
  post,
  className = "",
  relatedFollowStates
}: PostLayoutManagerProps) => {
  // Prepare sidebar content on the server
  const rightSidebar = (
    <div className="sticky top-6">
    <ProfileSidebarContent
      category={post.category}
      author={post.author}
      authorUrl={post.authorUrl}
      twitterUrl={post.twitterUrl}
      websiteUrl={post.websiteUrl}
      platform={post.platform}
      categorySlug={post.categorySlug}
      relatedPosts={post.relatedPosts}
      relatedFollowStates={relatedFollowStates}
    />
  </div>
  );

  // Use the standardized layout with card styling for post content
  // Make sure to include flex layout in the container class
  return (
    <StandardSidebarLayout
      rightSidebar={rightSidebar}
      useCardStyle={true}
      // Ensure we have the flex layout classes
      containerClass={`container gap-0 flex flex-col md:flex-row min-h-screen md:gap-6 p-0 md:px-6 ${className}`}
    >
      {children}
    </StandardSidebarLayout>
  );
}; 