import { Id } from "@/convex/_generated/dataModel";
import { SidebarContent } from "@/components/postpage/SidebarContent";
import { ProfileSidebarContent } from "@/components/postpage/ProfileSidebarContent";

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
}

export const PostLayoutManager = ({ 
  children,
  post,
  className = "",
}: PostLayoutManagerProps) => {
  // Server component that handles the main layout structure
  const sidebarContent = (
    <ProfileSidebarContent
      category={post.category}
      author={post.author}
      authorUrl={post.authorUrl}
      twitterUrl={post.twitterUrl}
      websiteUrl={post.websiteUrl}
      platform={post.platform}
      categorySlug={post.categorySlug}
      relatedPosts={post.relatedPosts}
    />
  );

  return (
    <div className={`container mx-auto ${className}`}>
      <div className="flex min-h-screen gap-6">
        <SidebarContent sidebarContent={sidebarContent}>
          {children}
        </SidebarContent>
      </div>
    </div>
  );
}; 