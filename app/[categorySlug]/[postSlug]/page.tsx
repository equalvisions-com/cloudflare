import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayoutManager } from "@/components/postpage/PostLayoutManager";
import { PostMainContent } from "@/components/postpage/MainContent";
import { getRSSEntries } from "@/lib/redis";

interface PostPageProps {
  params: Promise<{
    categorySlug: string;
    postSlug: string;
  }>;
}

// Server-side data fetching using Convex
async function getPostBySlug(categorySlug: string, postSlug: string) {
  try {
    const post = await fetchQuery(api.posts.getBySlug, { categorySlug, postSlug });
    if (!post) return null;
    return post;
  } catch (error) {
    console.error('Failed to fetch post:', error);
    return null;
  }
}

export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

// Reuse the fetched data for both metadata and the page component
async function getPost(params: PostPageProps['params']) {
  try {
    const { categorySlug, postSlug } = await params;
    const post = await getPostBySlug(categorySlug, postSlug);
    if (!post) notFound();
    
    // If there's a feedUrl, fetch RSS entries (Redis handles caching)
    if (post.feedUrl) {
      try {
        await getRSSEntries(post.title, post.feedUrl);
      } catch (error) {
        console.error('Failed to fetch RSS feed:', error);
        // Don't throw the error - we still want to show the post
      }
    }
    
    return post;
  } catch (error) {
    console.error('Error in getPost:', error);
    notFound();
  }
}

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