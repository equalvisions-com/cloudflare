import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayoutManager } from "@/components/postpage/PostLayoutManager";
import { PostMainContent } from "@/components/postpage/MainContent";
import { getRSSEntries } from "@/lib/redis";
import { cache } from 'react';
import { Suspense } from 'react';

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

// Separate RSS fetching into its own component
async function RSSFeedLoader({ title, feedUrl }: { title: string; feedUrl: string }) {
  await getRSSEntries(title, feedUrl);
  return null;
}

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
      {post.feedUrl && (
        <Suspense>
          <RSSFeedLoader title={post.title} feedUrl={post.feedUrl} />
        </Suspense>
      )}
      <PostMainContent
        title={post.title}
        body={post.body}
        feedUrl={post.feedUrl}
        postId={post._id}
        featuredImg={post.featuredImg}
      />
    </PostLayoutManager>
  );
}