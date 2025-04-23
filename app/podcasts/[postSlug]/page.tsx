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
import { ShareButton } from "@/components/ui/share-button";
import { BackButton } from "@/components/back-button";
import { PostSearchHeader } from "./PostHeaderClient";
import { Podcast, Mail } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

interface PostPageProps {
  params: Promise<{
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
const getPageData = cache(async (postSlug: string, searchQuery?: string): Promise<PageData | null> => {
  try {
    // First get the post data - we need this for everything else
    const post = await fetchQuery(api.posts.getByMediaTypeAndSlug, { 
      mediaType: "podcast", 
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
const getPostData = cache(async (postSlug: string): Promise<Post | null> => {
  const pageData = await getPageData(postSlug);
  return pageData?.post || null;
});

// Generate static params for all podcast posts
export async function generateStaticParams() {
  const posts = await fetchQuery(api.posts.getPostsByMediaType, {
    mediaType: "podcast",
  });
  
  return posts.map(post => ({
    postSlug: post.postSlug,
  }));
}

// Generate metadata using cached post data
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const { postSlug } = await params;
    const post = await getPostData(postSlug);
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
      <div className="flex flex-col items-center" style={{ gap: "16px" }}>
        {post.featuredImg && (
          <div className="w-24 h-24">
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
        
        <div className="flex flex-col items-center" style={{ gap: "9px" }}>
          <h1 className="text-2xl font-extrabold leading-none tracking-tight text-center m-0 p-0">
            {post.title}
            {post.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
          </h1>
          
          <div className="leading-none p-0 m-0">
            <FollowerCount 
              followerCount={post.followerCount} 
              postId={post._id} 
              totalEntries={rssData?.totalEntries ?? null}
              mediaType={post.mediaType}
            />
          </div>
        </div>
        
        {post.body && (
          <div className="text-sm leading-5 text-muted-foreground text-center max-w-md" dangerouslySetInnerHTML={{ __html: post.body }} />
        )}
        
        <div className="flex items-center gap-4">
          <FollowButton
            postId={post._id}
            feedUrl={post.feedUrl}
            postTitle={post.title}
            initialIsFollowing={followState.isFollowing}
            isAuthenticated={followState.isAuthenticated}
            className="rounded-full px-6 py-2"
          />
          
          <ShareButton className="px-6 py-2" />
        </div>
      </div>
    </div>
  );
}

// Main page component with optimized data fetching
export default async function PostPage({ params, searchParams }: PostPageProps) {
  const { postSlug } = await params;
  const searchQuery = searchParams?.q;
  const pageData = await getPageData(postSlug, searchQuery);
  
  if (!pageData) notFound();
  const { post, rssData, followState, relatedFollowStates } = pageData;

  // Generate a unique key for the TabsWrapper to force remount when search changes
  const tabsKey = `tabs-${searchQuery || 'all'}`;

  return (
    <PostLayoutManager post={post} relatedFollowStates={relatedFollowStates}>
      <PostSearchHeader title={post.title} mediaType={post.mediaType} />
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
          verified={post.verified}
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Unable to load feed data. Please try again later.
        </div>
      )}
    </PostLayoutManager>
  );
} 