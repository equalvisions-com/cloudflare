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
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ShareButton } from "@/components/ui/share-button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PostPageClientScope } from "./PostPageClientScope";
import { PostSearchHeader } from "./PostHeaderClient";
import { PostSearchProvider } from "./PostSearchContext";
import type { 
  NewsletterPageProps, 
  NewsletterPageData, 
  NewsletterPost,
  NewsletterPostContentProps
} from "@/lib/types";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Optimize data fetching with aggressive caching
const getPageData = cache(async (postSlug: string): Promise<NewsletterPageData | null> => {
  try {
    // First get the post data - we need this for everything else
    const post = await fetchQuery(api.posts.getByMediaTypeAndSlug, { 
      mediaType: "newsletter", 
      postSlug 
    }) as NewsletterPost;

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
        post.mediaType
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
    return null;
  }
});

// Get just the post data for metadata - reuse the same cache
const getPostData = cache(async (postSlug: string): Promise<NewsletterPost | null> => {
  const pageData = await getPageData(postSlug);
  return pageData?.post || null;
});

// Generate metadata using cached post data
export async function generateMetadata(props: NewsletterPageProps): Promise<Metadata> {
  const params = await props.params;
  try {
    const { postSlug } = params;
    const post = await getPostData(postSlug);
    if (!post) return { title: "Post Not Found" };

    const siteUrl = process.env.SITE_URL;
    const profileUrl = `${siteUrl}/newsletters/${post.postSlug}`;
    
    // Enhanced description
    const description = post.body 
      ? `${post.body.replace(/<[^>]*>/g, '').substring(0, 155)}...`
      : `Read ${post.title} newsletter articles. ${post.category} content with ${post.followerCount} followers.`;

    return {
      title: `${post.title} | Profile`,
      description,
      authors: [{ name: post.title }],
      creator: post.title,
      publisher: "FocusFix",
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      openGraph: {
        title: `${post.title} | Profile`,
        description,
        url: profileUrl,
        siteName: "FocusFix",
        images: (post.featuredImg && post.featuredImg.trim()) ? [{
          url: post.featuredImg,
          width: 1200,
          height: 630,
          alt: `${post.title} newsletter cover`,
          type: 'image/jpeg',
        }] : [{
          url: `${siteUrl}/og-default-newsletter.jpg`,
          width: 1200,
          height: 630,
          alt: 'FocusFix Newsletter',
          type: 'image/jpeg',
        }],
        locale: 'en_US',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${post.title} | Profile`,
        description,
        images: (post.featuredImg && post.featuredImg.trim()) ? [post.featuredImg] : [`${siteUrl}/og-default-newsletter.jpg`],
        creator: '@focusfix',
        site: '@focusfix',
      },
      alternates: {
        canonical: profileUrl,
        types: {
          'application/rss+xml': [
            {
              url: post.feedUrl,
              title: `${post.title} RSS Feed`
            }
          ]
        }
      },
      other: {
        'application-name': 'FocusFix',
        'apple-mobile-web-app-title': 'FocusFix',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'format-detection': 'telephone=no',
        'mobile-web-app-capable': 'yes',
        'msapplication-config': '/browserconfig.xml',
        'msapplication-TileColor': '#000000',
        'msapplication-tap-highlight': 'no',
        'theme-color': '#000000',
      },
    };
  } catch {
    return { title: "Post Not Found" };
  }
}

// Helper function to generate consolidated structured data
function generateStructuredData(post: NewsletterPost, profileUrl: string, rssData: any) {
  const siteUrl = process.env.SITE_URL;
  const description = post.body 
    ? `${post.body.replace(/<[^>]*>/g, '').substring(0, 155)}...`
    : `Read ${post.title} newsletter articles. ${post.category} content with ${post.followerCount} followers.`;

  // Consolidated JSON-LD with @id for stable URIs and proper compliance
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      // ProfilePage - mainEntity should be the newsletter creator/brand
      {
        "@type": "ProfilePage",
        "@id": `${profileUrl}#page`,
        "name": `${post.title} Profile`,
        "description": description,
        "url": profileUrl,
        "mainEntity": {
          "@id": `${profileUrl}#publisher`
        },
        "about": {
          "@id": `${profileUrl}#publisher`
        }
      },

      // Breadcrumb structured data (ACTIVE rich result - highest priority)
      {
        "@type": "BreadcrumbList",
        "@id": `${profileUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${siteUrl}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Newsletters",
            "item": `${siteUrl}/newsletters`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": post.title,
            "item": profileUrl
          }
        ]
      },
      
      // Organization schema (the newsletter creator/brand - this is the mainEntity)
      {
        "@type": "Organization",
        "@id": `${profileUrl}#publisher`,
        "name": post.title,
        "url": profileUrl,
        "logo": (post.featuredImg && post.featuredImg.trim()) ? {
          "@type": "ImageObject",
          "url": post.featuredImg,
          "width": 1200,
          "height": 630
        } : undefined,
        "description": description,
        "knowsAbout": post.category,
        "audience": {
          "@type": "Audience",
          "audienceType": "newsletter readers"
        },
        "potentialAction": {
          "@type": "SubscribeAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": profileUrl,
            "actionPlatform": [
              "http://schema.org/DesktopWebPlatform",
              "http://schema.org/MobileWebPlatform"
            ]
          }
        }
      },

      // COMPLIANT ItemList - semantic only, no rich result expectation
      // External URLs are kept for semantic understanding but won't trigger rich results
      ...(rssData?.entries?.length ? [{
        "@type": "ItemList",
        "@id": `${profileUrl}#itemlist`,
        "name": `${post.title} Newsletter`,
        "description": `Latest newsletters from ${post.title}`,
        "numberOfItems": Math.min(rssData.entries.length, 10),
        "itemListElement": rssData.entries.slice(0, 10).map((entryWithData: any, index: number) => {
          const entry = entryWithData.entry;
          return {
            "@type": "ListItem",
            "position": index + 1,
            "url": entry.link, // External URL - semantic only, no rich result
            "name": entry.title,
            "description": entry.description || `${entry.title} from ${post.title}`,
            "datePublished": new Date(entry.pubDate).toISOString(),
            "image": entry.image || post.featuredImg
          };
        })
      }] : [])
    ]
  };

  return structuredData;
}

// Simplified PostContent component for detailed feed info
function PostContent({ post, followState, rssData }: NewsletterPostContentProps) {
  return (
    <div className="max-w-4xl mx-auto p-4 border-b">
      <div className="flex flex-col w-full" style={{ gap: '16px' }}>
        {/* Header with image on right, text on left */}
        <div className="flex justify-between items-start w-full">
          {/* Left Column: Groups with specific gaps */}
          <div className="flex flex-col items-start text-left max-w-[70%]">
            {/* Group 1: Title */}
            <div className="w-full">
              <h1 className="text-2xl font-extrabold leading-none tracking-tight m-0 p-0 flex items-center">
                <span>{post.title}</span>
                {post.verified && <VerifiedBadge className="ml-1" />}
              </h1>
            </div>
            
            {/* Group 2: Bio (with 12px gap) */}
            {post.body && (
              <div className="w-full text-sm text-primary" style={{ marginTop: '11px' }} dangerouslySetInnerHTML={{ __html: post.body }} />
            )}
            
            {/* Group 3: Follower Count (with 12px gap) */}
            <div className="w-full text-muted-foreground font-medium" style={{ marginTop: '12px' }}>
              <FollowerCount 
                followerCount={post.followerCount} 
                postId={post._id} 
                totalEntries={rssData?.totalEntries ?? null}
                mediaType={post.mediaType}
              />
            </div>
          </div>
          
          {/* Right Column: Image */}
          {post.featuredImg && (
            <div className="w-24 h-24 flex-shrink-0">
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
        </div>
        
        {/* Group 4: Action Buttons (16px gap from the container) */}
        <div className="grid grid-cols-2 gap-4 w-full" style={{ marginTop: '2px' }}>
          <FollowButton
            postId={post._id}
            feedUrl={post.feedUrl}
            postTitle={post.title}
            initialIsFollowing={followState.isFollowing}
            isAuthenticated={followState.isAuthenticated}
            className="w-full rounded-lg"
          />
          
          <ShareButton className="w-full py-2 rounded-lg" displayName={post.title} />
        </div>
      </div>
    </div>
  );
}

// Main page component with optimized data fetching
export default async function PostPage(props: NewsletterPageProps) {
  const params = await props.params;
  const { postSlug } = params;
  const pageData = await getPageData(postSlug);

  if (!pageData) notFound();
  const { post, rssData, followState, relatedFollowStates } = pageData;

  const siteUrl = process.env.SITE_URL;
  const profileUrl = `${siteUrl}/newsletters/${post.postSlug}`;

  // Generate consolidated structured data
  const structuredData = generateStructuredData(post, profileUrl, rssData);

  return (
    <>
      {/* Consolidated JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData, null, 2)
        }}
      />
      
      <PostLayoutManager post={post} relatedFollowStates={relatedFollowStates}>
        <PostSearchProvider>
          <PostSearchHeader title={post.title} mediaType={post.mediaType} />
          <PostContent post={post} followState={followState} rssData={rssData} />
          {rssData ? (
            <PostPageClientScope
              mediaType={post.mediaType}
              postTitle={post.title}
              feedUrl={post.feedUrl}
              rssData={rssData}
              featuredImg={post.featuredImg}
              verified={post.verified}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Unable to load feed data. Please try again later.
            </div>
          )}
        </PostSearchProvider>
      </PostLayoutManager>
    </>
  );
} 