import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProfileLayoutManager } from "@/components/profile/ProfileLayoutManager";
import { ProfileActivityData } from "@/components/profile/ProfileActivityData";
import { ProfileContentClient } from "@/components/profile/ProfileContentClient";
import { ProfilePageClientScope } from "./ProfilePageClientScope";
import { Id } from "@/convex/_generated/dataModel";
import { 
  ProfilePageProps, 
  ProfilePageData,
  TransformedProfileData,
  PersonSchema,
  BreadcrumbList,
  ProfilePageSchema,
  JsonLdGraph,
  FriendshipStatus,
  ProfileSocialData,
  ProfileFollowingData,
  SocialCounts
} from "@/lib/types";

// Add the Edge Runtime configuration
export const runtime = 'edge';
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Helper to normalize username consistently
const normalizeUsername = (username: string): string => {
  return decodeURIComponent(username).replace(/^@/, '').toLowerCase();
};

// Use the optimized batch query for profile data
const getProfilePageData = cache(async (username?: string): Promise<ProfilePageData | null> => {
  try {
    if (!username) {
      return null;
    }
    
    const normalizedUsername = normalizeUsername(username);
    
    // Use the new optimized batch query
    const profileData = await fetchQuery(api.users.getProfilePageData, { 
      username: normalizedUsername,
      limit: 30
    }) as unknown as ProfilePageData; // Proper type assertion through unknown
    
    // Ensure the profile has the required _id field
    if (profileData && profileData.profile) {
      // Add _id if it doesn't exist (use userId as fallback)
      if (!profileData.profile._id && profileData.profile.userId) {
        profileData.profile._id = profileData.profile.userId;
      }
    }
    
    return profileData;
  } catch (error) {
    return null;
  }
});

// Legacy function for backward compatibility with metadata generation
const getProfileByUsername = cache(async (username?: string) => {
  try {
    if (!username) {
      return null;
    }
    
    // Use the new optimized function first 
    const profileData = await getProfilePageData(username);
    if (profileData) {
      return profileData.profile;
    }
    
    // Fall back to the old method if needed
    const normalizedUsername = normalizeUsername(username);
    const profile = await fetchQuery(api.users.getProfileByUsername, { username: normalizedUsername });
    return profile;
  } catch (error) {
    return null;
  }
});

// Server-side data transformation using proper types
const getTransformedProfileData = (profileData: ProfilePageData, username: string): TransformedProfileData => {
  const siteUrl = process.env.SITE_URL || 'https://focusfix.app';
  
  // Use the same logic as the custom hook but in server context
  const normalizedUsername = normalizeUsername(username);
  const displayName = profileData.profile.name || normalizedUsername;
  
  // Transform friendship status
  const friendshipStatus: FriendshipStatus | null = profileData.friendshipStatus 
    ? {
        exists: true,
        status: profileData.friendshipStatus.status,
        direction: profileData.friendshipStatus.direction || null,
        friendshipId: profileData.friendshipStatus.id || null
      }
    : null;

  // Transform initial friends data with proper types
  const initialFriends: ProfileSocialData = {
    friends: profileData.social.friends || [], // Already in correct FriendWithProfile[] format
    hasMore: (profileData.social.friends?.length || 0) >= 30,
    cursor: null
  };

  // Transform initial following data
  const initialFollowing: ProfileFollowingData = {
    following: profileData.social.following || [],
    hasMore: (profileData.social.following?.length || 0) >= 30,
    cursor: null
  };

  // Generate JSON-LD structured data with proper types
  const personSchema: PersonSchema = {
    "@type": "Person",
    "@id": `${siteUrl}/@${normalizedUsername}#person`,
    "name": displayName,
    "alternateName": `@${normalizedUsername}`,
    "url": `${siteUrl}/@${normalizedUsername}`,
    "identifier": profileData.profile.userId,
    "interactionStatistic": [
      {
        "@type": "InteractionCounter",
        "interactionType": "http://schema.org/FollowAction",
        "userInteractionCount": profileData.social.followingCount
      },
      {
        "@type": "InteractionCounter",
        "interactionType": "http://schema.org/BefriendAction",
        "userInteractionCount": profileData.social.friendCount
      }
    ],
    ...(profileData.profile.profileImage && { image: profileData.profile.profileImage }),
    ...(profileData.profile.bio && { description: profileData.profile.bio })
  };

  const breadcrumbList: BreadcrumbList = {
    "@type": "BreadcrumbList",
    "@id": `${siteUrl}/@${normalizedUsername}#breadcrumbs`,
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
        "name": "Profile",
        "item": `${siteUrl}/@${normalizedUsername}`
      }
    ]
  };

  const profilePageSchema: ProfilePageSchema = {
    "@type": "ProfilePage",
    "@id": `${siteUrl}/@${normalizedUsername}`,
    "name": `${displayName} – Profile on FocusFix`,
    "url": `${siteUrl}/@${normalizedUsername}`,
    "mainEntity": { "@id": `${siteUrl}/@${normalizedUsername}#person` },
    "isPartOf": { "@id": `${siteUrl}/#website` },
    "breadcrumb": { "@id": `${siteUrl}/@${normalizedUsername}#breadcrumbs` },
    "about": { "@id": `${siteUrl}/@${normalizedUsername}#person` }
  };

  const jsonLdData: JsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [breadcrumbList, personSchema, profilePageSchema]
  };

  const socialCounts: SocialCounts = {
    friendCount: profileData.social.friendCount,
    followingCount: profileData.social.followingCount
  };

  return {
    normalizedUsername,
    displayName,
    friendshipStatus,
    initialFriends,
    initialFollowing,
    jsonLd: JSON.stringify(jsonLdData),
    socialCounts
  };
};

// Memoized metadata generation function
const generateProfileMetadata = cache(async (username: string): Promise<Metadata> => {
  if (!username) {
    return {
      title: "Profile Not Found",
      description: "No username specified in the URL.",
      robots: { index: false, follow: false }
    };
  }
  
  const normalizedUsername = normalizeUsername(username);
  const profile = await getProfileByUsername(username);
  
  if (!profile) {
    return {
      title: "Profile Not Found",
      description: "The requested user profile could not be found.",
      robots: { index: false, follow: false }
    };
  }

  const siteUrl = process.env.SITE_URL || 'https://focusfix.app';
  const displayName = profile.name || normalizedUsername;
  const description = profile.bio || `See what ${displayName} is following and sharing on FocusFix.`;

  return {
    title: `${displayName} – Profile on FocusFix`,
    description,
    alternates: {
      canonical: `${siteUrl}/@${normalizedUsername}`,
    },
    openGraph: {
      title: `${displayName} – FocusFix`,
      description,
      url: `${siteUrl}/@${normalizedUsername}`,
      type: 'profile',
              images: profile.profileImage ? [profile.profileImage] : [`${siteUrl}/favicon.ico`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} on FocusFix`,
      description,
    },
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
    }
  };
});

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  return generateProfileMetadata(username);
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const resolvedParams = await params;
  const username = resolvedParams?.username;
  
  if (!username) {
    notFound();
  }
  
  // Fetch optimized profile data
  const profileData = await getProfilePageData(username);
  
  if (!profileData || !profileData.profile) {
    notFound();
  }
  
  // Transform data on the server
  const transformedData = getTransformedProfileData(profileData, username);
  
  return (
    <>
      <script
        id="profile-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: transformedData.jsonLd }}
      />
      
      <ProfileLayoutManager>
        <ProfilePageClientScope
          profileUserId={profileData.profile.userId}
          username={transformedData.normalizedUsername}
        >
          <div>
            <ProfileContentClient
              profile={profileData.profile}
              normalizedUsername={transformedData.normalizedUsername}
              displayName={transformedData.displayName}
              friendshipStatus={transformedData.friendshipStatus}
              socialCounts={transformedData.socialCounts}
              initialFriends={transformedData.initialFriends}
              initialFollowing={transformedData.initialFollowing}
            />
            
            <ProfileActivityData 
              userId={profileData.profile.userId} 
              username={transformedData.normalizedUsername}
              name={profileData.profile.name || transformedData.normalizedUsername}
              profileImage={profileData.profile.profileImage}
            />
          </div>
        </ProfilePageClientScope>
      </ProfileLayoutManager>
    </>
  );
}