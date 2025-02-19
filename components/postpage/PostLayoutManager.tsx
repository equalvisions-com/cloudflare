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
      title={post.title}
      category={post.category}
      body={post.body}
      author={post.author}
      authorUrl={post.authorUrl}
      twitterUrl={post.twitterUrl}
      websiteUrl={post.websiteUrl}
      platform={post.platform}
      categorySlug={post.categorySlug}
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