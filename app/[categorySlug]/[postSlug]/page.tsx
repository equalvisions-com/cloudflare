import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayoutManager } from "@/components/postpage/PostLayoutManager";
import { cache } from "react";
import { Suspense } from "react";
import RSSFeed, { getInitialEntries } from "@/components/postpage/RSSFeed";
import Image from "next/image";
import { FollowButtonServer } from "@/components/follow-button/FollowButtonServer";
import { FollowerCount } from "@/components/postpage/FollowerCount";

// Enable Incremental Static Regeneration (ISR) - revalidate every 60 seconds
export const revalidate = 60;

// Configure dynamic rendering to auto (static by default unless dynamic data is detected)
export const dynamic = "auto";

interface PostPageProps {
  params: Promise<{
    categorySlug: string;
    postSlug: string;
  }>;
}

// Server-side data fetching with caching (no 'next' option)
const getPostBySlug = cache(async (categorySlug: string, postSlug: string) => {
  try {
    const post = await fetchQuery(api.posts.getBySlug, { categorySlug, postSlug });
    if (!post) return null;
    return post;
  } catch (error) {
    console.error("Failed to fetch post:", error);
    return null;
  }
});

// Reuse fetched data for metadata and page
const getPost = cache(async (params: PostPageProps["params"]) => {
  try {
    const { categorySlug, postSlug } = await params;
    const post = await getPostBySlug(categorySlug, postSlug);
    if (!post) notFound();
    return post;
  } catch (error) {
    console.error("Error in getPost:", error);
    notFound();
  }
});

// Generate metadata with preload for critical image
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const post = await getPost(params);

    return {
      title: post.title,
      description: `${post.title} - ${post.category}`,
      openGraph: {
        images: post.featuredImg ? [post.featuredImg] : [],
      },
      other: post.featuredImg
        ? {
            "link-rel-preload": `<${post.featuredImg}>; rel=preload; as=image`,
          }
        : {},
    };
  } catch {
    return {
      title: "Post Not Found",
      description: "The requested post could not be found.",
    };
  }
}

// PostHeader component for streaming the header
async function PostHeader({ post }: { post: Awaited<ReturnType<typeof getPost>> }) {
  return (
    <div className="max-w-4xl mx-auto p-6 border-b">
      <div className="flex gap-6">
        {/* Featured Image */}
        {post.featuredImg && (
          <div className="w-[150px] shrink-0">
            <Image
              src={post.featuredImg}
              alt={post.title}
              width={150}
              height={150}
              sizes="(max-width: 768px) 100vw, 150px"
              className="object-cover rounded-lg border"
              priority
            />
          </div>
        )}

        {/* Title, Follow Button, and Body Content */}
        <div className="flex-1 min-w-0">
          <header className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-bold mb-0">{post.title}</h1>
              <FollowButtonServer
                postId={post._id}
                feedUrl={post.feedUrl}
                postTitle={post.title}
              />
            </div>
          </header>

          <div
            className="prose prose-lg prose-headings:scroll-mt-28"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
          <FollowerCount followerCount={post.followerCount} postId={post._id} />
        </div>
      </div>
    </div>
  );
}

// PostFeed component for streaming the RSS feed
async function PostFeed({ post }: { post: Awaited<ReturnType<typeof getPost>> }) {
  const initialData = await getInitialEntries(post.title, post.feedUrl);

  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in this feed.
      </div>
    );
  }

  return post.feedUrl ? (
    <>
      <RSSFeed
        postTitle={post.title}
        feedUrl={post.feedUrl}
        initialData={initialData}
        featuredImg={post.featuredImg}
        mediaType={post.mediaType}
      />
    </>
  ) : null;
}

// Main page component with Suspense boundaries
export default async function PostPage({ params }: PostPageProps) {
  const post = await getPost(params);

  return (
    <PostLayoutManager
      post={{
        ...post,
        relatedPosts: post.relatedPosts,
      }}
    >
      <Suspense>
        <PostHeader post={post} />
      </Suspense>
      <Suspense>
        <PostFeed post={post} />
      </Suspense>
    </PostLayoutManager>
  );
}