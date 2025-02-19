import { RSSFeed } from "./RSSFeed";
import { Id } from "@/convex/_generated/dataModel";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { FollowButtonServer } from "@/components/follow-button/FollowButtonServer";

// Server component for post content
interface PostMainContentProps {
  title: string;
  body: string;
  feedUrl: string;
  postId: Id<"posts">;
  featuredImg?: string;
  className?: string;
}

export const PostMainContent = ({
  title,
  body,
  feedUrl,
  postId,
  featuredImg,
  className = "",
}: PostMainContentProps) => {
  return (
    <article className={`prose lg:prose-xl mx-auto px-4 py-8 ${className}`}>
      <div className="flex gap-8 mb-8">
        {featuredImg && (
          <div className="w-[150px] shrink-0">
            <AspectRatio ratio={1}>
              <Image
                src={featuredImg}
                alt={title}
                fill
                className="object-cover rounded-lg border"
                priority
              />
            </AspectRatio>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <header>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-4xl font-bold mb-0">{title}</h1>
              <FollowButtonServer postId={postId} feedUrl={feedUrl} postTitle={title} />
            </div>
          </header>
          
          <div
            className="prose prose-lg prose-headings:scroll-mt-28 mt-4"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        </div>
      </div>

      {/* RSS Feed Entries */}
      <RSSFeed 
        postTitle={title}
        postId={postId}
        feedUrl={feedUrl}
      />

      <footer className="mt-8 text-sm text-muted-foreground">
        <p>Source: {feedUrl}</p>
      </footer>
    </article>
  );
};