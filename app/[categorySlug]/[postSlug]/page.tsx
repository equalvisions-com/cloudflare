import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayoutManager } from "@/components/postpage/PostLayoutManager";
import { cache } from "react";
import { getInitialEntries } from "@/components/postpage/RSSFeed";
import Image from "next/image";
import { FollowButton } from "@/components/follow-button/FollowButton";
import { FollowerCount } from "@/components/postpage/FollowerCount";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { PostTabsWrapper } from "@/components/postpage/PostTabsWrapper";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { MenuButton } from "@/components/ui/menu-button";
import { BackButton } from "@/app/components/ui/back-button";
import { PostSearchHeader } from "./PostHeaderClient";
import { Podcast, Mail } from "lucide-react";

interface PostPageProps {
  params: Promise<{
    categorySlug: string;
    postSlug: string;
  }>;
  searchParams?: { q?: string };
}

// Extend the Convex Post type with our additional fields
type Post = Doc<"posts"> & {
  followerCount: number;
  relatedPosts?: Array<{
    _id: Id<"posts">;
    title: string;
    featuredImg?: string;
    postSlug: string;
    categorySlug: string;
    feedUrl: string;
  }>;
};

interface PageData {
  post: Post;
  rssData: NonNullable<Awaited<ReturnType<typeof getInitialEntries>>> | null;
  followState: {
    isAuthenticated: boolean;
    isFollowing: boolean;
  };
  relatedFollowStates: {
    [postId: string]: {
      isAuthenticated: boolean;
      isFollowing: boolean;
    };
  };
}

// Optimize data fetching with aggressive caching
const getPageData = cache(async (categorySlug: string, postSlug: string, searchQuery?: string): Promise<PageData | null> => {
  try {
    // First get the post data - we need this for everything else
    const post = await fetchQuery(api.posts.getBySlug, { 
      categorySlug, 
      postSlug 
    }) as Post;

    if (!post) return null;

    // Get auth state first since we need it for both main post and related posts
    const isAuthenticated = await isAuthenticatedNextjs();
    const token = isAuthenticated ? await convexAuthNextjsToken().catch(() => undefined) : undefined;

    // Now run auth, RSS, and related posts follow states fetches in parallel
    const [mainFollowState, rssData, relatedFollowStates] = await Promise.all([
      // Get follow state for main post
      isAuthenticated && token 
        ? fetchQuery(api.following.isFollowing, { postId: post._id }, { token })
        : Promise.resolve(false),

      // Get RSS data using post data we already have
      getInitialEntries(
        post.title,
        post.feedUrl,
        post.mediaType,
        searchQuery
      ),

      // Get follow states for related posts if they exist
      (async () => {
        if (!post.relatedPosts || !isAuthenticated || !token) {
          return {};
        }

        const states = await Promise.all(
          post.relatedPosts.map(async (relatedPost) => {
            const isFollowing = await fetchQuery(
              api.following.isFollowing,
              { postId: relatedPost._id },
              { token }
            );
            return [
              relatedPost._id.toString(),
              { isAuthenticated, isFollowing }
            ] as const;
          })
        );

        return Object.fromEntries(states);
      })()
    ]);

    return {
      post,
      rssData,
      followState: {
        isAuthenticated,
        isFollowing: mainFollowState
      },
      relatedFollowStates
    };
  } catch (error) {
    console.error("Failed to fetch page data:", error);
    return null;
  }
});

// Get just the post data for metadata - reuse the same cache
const getPostData = cache(async (categorySlug: string, postSlug: string): Promise<Post | null> => {
  const pageData = await getPageData(categorySlug, postSlug);
  return pageData?.post || null;
});

// Generate metadata using cached post data
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const { categorySlug, postSlug } = await params;
    const post = await getPostData(categorySlug, postSlug);
    if (!post) return { title: "Post Not Found" };

    const apiUrl = `/api/rss/${encodeURIComponent(post.title)}?feedUrl=${encodeURIComponent(post.feedUrl)}`;

    return {
      title: post.title,
      description: `${post.title} - ${post.category}`,
      openGraph: {
        images: post.featuredImg ? [post.featuredImg] : [],
      },
      other: {
        'Link': [
          ...(post.featuredImg ? [`<${post.featuredImg}>; rel=preload; as=image`] : []),
          `<${apiUrl}>; rel=preload; as=fetch; crossorigin=anonymous; priority=high`,
          `</api/convex/getFeedDataWithMetrics>; rel=preload; as=fetch; crossorigin=anonymous`,
        ].join(', '),
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300'
      }
    };
  } catch {
    return { title: "Post Not Found" };
  }
}

// Simplified PostContent component for detailed feed info
function PostContent({ post, followState, rssData }: { 
  post: Post; 
  followState: { isAuthenticated: boolean; isFollowing: boolean };
  rssData: NonNullable<Awaited<ReturnType<typeof getInitialEntries>>> | null;
}) {
  return (
    <div className="max-w-4xl mx-auto p-4 border-b">
      <div className="flex justify-between items-start mb-4">
        {post.featuredImg && (
          <div className="w-24 h-24 shrink-0">
            <AspectRatio ratio={1}>
              <Image
                src={post.featuredImg}
                alt={post.title}
                fill
                sizes="96px"
                className="object-cover rounded-lg"
                priority
              />
            </AspectRatio>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MenuButton />
          <FollowButton
            postId={post._id}
            feedUrl={post.feedUrl}
            postTitle={post.title}
            initialIsFollowing={followState.isFollowing}
            isAuthenticated={followState.isAuthenticated}
          />
        </div>
      </div>
      <h1 className="text-2xl font-extrabold flex items-center leading-none tracking-tight">{post.title}</h1>
      
      <div className="text-sm mb-3 mt-2 text-muted-foreground" dangerouslySetInnerHTML={{ __html: post.body }} />
      <FollowerCount 
        followerCount={post.followerCount} 
        postId={post._id} 
        totalEntries={rssData?.totalEntries ?? null}
        mediaType={post.mediaType}
      />
    </div>
  );
}

// Main page component with optimized data fetching
export default async function PostPage({ params, searchParams }: PostPageProps) {
  const { categorySlug, postSlug } = await params;
  const searchQuery = searchParams?.q;
  const pageData = await getPageData(categorySlug, postSlug, searchQuery);
  
  if (!pageData) notFound();
  const { post, rssData, followState, relatedFollowStates } = pageData;

  // Generate a unique key for the TabsWrapper to force remount when search changes
  const tabsKey = `tabs-${searchQuery || 'all'}`;

  return (
    <PostLayoutManager post={post} relatedFollowStates={relatedFollowStates}>
      <PostSearchHeader title={post.title} />
      <PostContent post={post} followState={followState} rssData={rssData} />
      {rssData ? (
        <PostTabsWrapper
          key={tabsKey}
          postTitle={post.title}
          feedUrl={post.feedUrl}
          rssData={rssData}
          featuredImg={post.featuredImg}
          mediaType={post.mediaType}
          searchQuery={searchQuery}
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Unable to load feed data. Please try again later.
        </div>
      )}
    </PostLayoutManager>
  );
}