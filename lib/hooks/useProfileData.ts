import { useMemo } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import { 
  ProfilePageData, 
  FriendshipStatus, 
  ProfileSocialData, 
  ProfileFollowingData,
  ProfileMetadata 
} from '@/lib/types';

interface UseProfileDataProps {
  profileData: ProfilePageData | null;
  username: string;
  siteUrl?: string;
}

export const useProfileData = ({ 
  profileData, 
  username, 
  siteUrl = process.env.SITE_URL || '' 
}: UseProfileDataProps) => {
  // Memoize the normalized username
  const normalizedUsername = useMemo(() => {
    return username.replace(/^@/, '').toLowerCase();
  }, [username]);

  // Memoize the display name
  const displayName = useMemo(() => {
    return profileData?.profile?.name || normalizedUsername;
  }, [profileData?.profile?.name, normalizedUsername]);

  // Memoize the friendship status transformation
  const friendshipStatus = useMemo((): FriendshipStatus | null => {
    if (!profileData?.friendshipStatus) return null;
    
    return {
      exists: true,
      status: profileData.friendshipStatus.status,
      direction: profileData.friendshipStatus.direction || null,
      friendshipId: profileData.friendshipStatus.id || null
    };
  }, [profileData?.friendshipStatus]);

  // Memoize the initial friends data transformation
  const initialFriends = useMemo((): ProfileSocialData => {
    const friends = profileData?.social?.friends || [];
    
    // The friends data is already in FriendWithProfile[] format from the Convex function
    return {
      friends: friends, // Already in correct FriendWithProfile[] format
      hasMore: friends.length >= 30,
      cursor: null
    };
  }, [profileData?.social?.friends]);

  // Memoize the initial following data transformation
  const initialFollowing = useMemo((): ProfileFollowingData => {
    const following = profileData?.social?.following || [];
    
    return {
      following: following, // API already returns correct FollowingWithPost structure
      hasMore: following.length >= 30,
      cursor: null
    };
  }, [profileData?.social?.following]);

  // Memoize the metadata generation
  const metadata = useMemo((): ProfileMetadata => {
    const description = profileData?.profile?.bio || 
      `See what ${displayName} is following and sharing on FocusFix.`;

    return {
      title: `${displayName} – Profile on FocusFix`,
      description,
      canonical: `${siteUrl}/@${normalizedUsername}`,
      openGraph: {
        title: `${displayName} – FocusFix`,
        description,
        url: `${siteUrl}/@${normalizedUsername}`,
        type: 'profile',
                  images: [`${siteUrl}/favicon.ico`]
      },
      twitter: {
        card: 'summary_large_image',
        title: `${displayName} on FocusFix`,
        description
      }
    };
  }, [profileData?.profile?.bio, displayName, siteUrl, normalizedUsername]);

  // Memoize the JSON-LD structured data
  const jsonLd = useMemo(() => {
    if (!profileData?.profile) return null;

    const personSchema: any = {
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
      ]
    };

    // Add optional fields
    if (profileData.profile.profileImage) {
      personSchema.image = profileData.profile.profileImage;
    }
    if (profileData.profile.bio) {
      personSchema.description = profileData.profile.bio;
    }

    return JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
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
        },
        personSchema,
        {
          "@type": "ProfilePage",
          "@id": `${siteUrl}/@${normalizedUsername}`,
          "name": `${displayName} – Profile on FocusFix`,
          "url": `${siteUrl}/@${normalizedUsername}`,
          "mainEntity": { "@id": `${siteUrl}/@${normalizedUsername}#person` },
          "isPartOf": { "@id": `${siteUrl}/#website` },
          "breadcrumb": { "@id": `${siteUrl}/@${normalizedUsername}#breadcrumbs` },
          "about": { "@id": `${siteUrl}/@${normalizedUsername}#person` }
        }
      ]
    });
  }, [profileData, displayName, siteUrl, normalizedUsername]);

  return {
    // Computed values
    normalizedUsername,
    displayName,
    
    // Transformed data
    friendshipStatus,
    initialFriends,
    initialFollowing,
    metadata,
    jsonLd,
    
    // Raw data (for components that need it)
    profile: profileData?.profile || null,
    socialCounts: {
      friendCount: profileData?.social?.friendCount || 0,
      followingCount: profileData?.social?.followingCount || 0
    }
  };
}; 