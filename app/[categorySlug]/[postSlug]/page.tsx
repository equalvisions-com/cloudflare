import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayoutManager } from "@/components/postpage/PostLayoutManager";
import { cache } from 'react';
import { Suspense } from 'react';
import RSSFeed from "@/components/postpage/RSSFeed";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { FollowButtonServer } from "@/components/follow-button/FollowButtonServer";

// Configure the segment for dynamic rendering
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface PostPageProps {
  params: Promise<{
    categorySlug: string;
    postSlug: string;
  }>;
}

// Server-side data fetching using Convex
const getPostBySlug = cache(async (categorySlug: string, postSlug: string) => {
  try {
    const post = await fetchQuery(api.posts.getBySlug, { categorySlug, postSlug });
    if (!post) return null;
    return post;
  } catch (error) {
    console.error('Failed to fetch post:', error);
    return null;
  }
});

// Reuse the fetched data for both metadata and the page component
const getPost = cache(async (params: PostPageProps['params']) => {
  try {
    const { categorySlug, postSlug } = await params;
    const post = await getPostBySlug(categorySlug, postSlug);
    if (!post) notFound();
    return post;
  } catch (error) {
    console.error('Error in getPost:', error);
    notFound();
  }
});

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const post = await getPost(params);

    return {
      title: post.title,
      description: `${post.title} - ${post.category}`,
      openGraph: {
        images: post.featuredImg ? [post.featuredImg] : [],
      },
    };
  } catch {
    return {
      title: 'Post Not Found',
      description: 'The requested post could not be found.',
    };
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await getPost(params);

  return (
    <PostLayoutManager post={post}>
      {/* Header Section with Body Content */}
      <div className="max-w-4xl mx-auto px-0 py-8">
        <div className="flex gap-8">
          {/* Featured Image */}
          {post.featuredImg && (
            <div className="w-[150px] shrink-0">
              <AspectRatio ratio={1}>
                <Image
                  src={post.featuredImg}
                  alt={post.title}
                  fill
                  className="object-cover rounded-lg border"
                  priority
                />
              </AspectRatio>
            </div>
          )}
          
          {/* Title, Follow Button, and Body Content */}
          <div className="flex-1 min-w-0">
            <header className="mb-8">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-4xl font-bold mb-0">{post.title}</h1>
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
          </div>
        </div>
      </div>

      {/* RSS Feed */}
      {post.feedUrl && (
        <Suspense fallback={<div className="p-8 text-center">Loading feed entries...</div>}>
          <RSSFeed postTitle={post.title} feedUrl={post.feedUrl} />
        </Suspense>
      )}

      {/* Source Footer */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        <footer className="text-sm text-muted-foreground">
          <p>Source: {post.feedUrl}</p>
        </footer>
      </div>
    </PostLayoutManager>
  );
}