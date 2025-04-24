import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProfileLayoutManager } from "@/components/profile/ProfileLayoutManager";
import { ProfileActivityData } from "@/components/profile/ProfileActivityData";
import { ProfileImage } from "@/components/profile/ProfileImage";
import { FriendButton } from "@/components/profile/FriendButton";
import { FriendsList } from "@/components/profile/FriendsList";
import { FollowingList } from "@/components/profile/FollowingList";
import { ShareButton } from "@/components/ui/share-button";
import { Id } from "@/convex/_generated/dataModel";

// Define FriendshipStatus type to match what FriendButton expects
type FriendshipStatus = {
  exists: boolean;
  status: string | null;
  direction: string | null;
  friendshipId: Id<"friends"> | null;
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

// Helper to normalize username consistently
const normalizeUsername = (username: string) => {
  // Remove @ and convert to lowercase for lookups
  return decodeURIComponent(username).replace(/^@/, '').toLowerCase();
};

// Use the optimized batch query for profile data
const getProfilePageData = cache(async (username?: string) => {
  try {
    if (!username) {
      console.error("Username is undefined or empty");
      return null;
    }
    const normalizedUsername = normalizeUsername(username);
    
    // Use the new optimized batch query
    const profileData = await fetchQuery(api.users.getProfilePageData, { 
      username: normalizedUsername,
      limit: 30
    });
    
    return profileData;
  } catch (error) {
    console.error("Failed to fetch profile data:", error);
    return null;
  }
});

// Legacy function for backward compatibility with metadata generation
const getProfileByUsername = cache(async (username?: string) => {
  try {
    if (!username) {
      console.error("Username is undefined or empty");
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
    console.error("Failed to fetch profile:", error);
    return null;
  }
});

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  if (!username) {
    console.error("No username provided in params for metadata generation");
    return {
      title: "Profile Not Found",
      description: "No username specified in the URL.",
    };
  }
  const normalizedUsername = normalizeUsername(username);
  const profile = await getProfileByUsername(username);

  if (!profile) {
    return {
      title: "Profile Not Found",
      description: "The requested user profile could not be found.",
    };
  }

  return {
    title: `${normalizedUsername}'s Profile`,
    description: `View the profile of ${normalizedUsername} on Grasper.`,
    alternates: {
      canonical: `/@${normalizedUsername}`, // Keep @ in canonical URL for routing
    },
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const resolvedParams = await params;
  const username = resolvedParams?.username;
  if (!username) {
    console.error("No username provided in params for ProfilePage");
    notFound();
  }
  const normalizedUsername = normalizeUsername(username);
  
  // Fetch optimized profile data
  const profileData = await getProfilePageData(username);
  
  if (!profileData || !profileData.profile) {
    notFound();
  }
  
  const profile = profileData.profile;
  const { friendCount, followingCount } = profileData.social;
  
  // Convert server response to expected component props format
  const initialFriends = {
    friends: profileData.social.friends || [],
    hasMore: profileData.social.friends?.length >= 30 || false,
    cursor: null
  };
  
  // Transform following data to match expected FollowingWithPost structure
  const initialFollowing = {
    following: (profileData.social.following || []).map(item => {
      if (!item) return null;
      return {
        following: {
          _id: item._id,
          userId: profile.userId,
          postId: item.postId,
          feedUrl: item.feedUrl
        },
        post: {
          _id: item.post._id,
          title: item.post.title,
          postSlug: item.post.postSlug,
          categorySlug: item.post.categorySlug,
          featuredImg: item.post.featuredImg,
          mediaType: item.post.mediaType,
          verified: item.post.verified
        }
      };
    }),
    hasMore: profileData.social.following?.length >= 30 || false,
    cursor: null
  };
  
  // Convert friendship status to expected format
  const friendshipStatus: FriendshipStatus | null = profileData.friendshipStatus 
    ? {
        exists: true,
        status: profileData.friendshipStatus.status,
        direction: profileData.friendshipStatus.direction || null,
        friendshipId: profileData.friendshipStatus.id || null
      }
    : null;
  
  return (
    <ProfileLayoutManager>
      <div>
        <div>
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex flex-col w-full" style={{ gap: '16px' }}>
              {/* Profile Header */}
              <div className="flex justify-between items-start w-full">
                {/* Left Column: Groups with specific gaps */}
                <div className="flex flex-col items-start text-left max-w-[70%]">
                  {/* Group 1: Title */}
                  <div className="w-full">
                    <h1 className="text-2xl font-extrabold leading-none tracking-tight m-0 p-0">
                      {profile.name || normalizedUsername}
                    </h1>
                    <p className="text-sm leading-none mt-1 text-muted-foreground font-medium">
                      @{normalizedUsername}
                    </p>
                  </div>
                  
                  {/* Group 2: Bio (with 12px gap) */}
                  {profile.bio && (
                    <p className="w-full text-sm text-primary" style={{ marginTop: '10px' }}>{profile.bio}</p>
                  )}
                  
                  {/* Group 3: Follower/Friend Counts (with 12px gap) */}
                  <div className="w-full text-muted-foreground font-medium" style={{ marginTop: '10px' }}>
                    <div className="flex gap-4">
                      <FollowingList 
                        username={normalizedUsername} 
                        initialCount={followingCount}
                        initialFollowing={initialFollowing}
                      />
                      <FriendsList 
                        username={normalizedUsername} 
                        initialCount={friendCount}
                        initialFriends={initialFriends}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Right Column: Profile Image */}
                <ProfileImage 
                  profileImage={profile.profileImage} 
                  username={normalizedUsername}
                  size="lg"
                />
              </div>
              
              {/* Group 4: Action Buttons (16px gap from container) */}
              <div className="grid grid-cols-2 gap-4 w-full">
                <FriendButton
                  username={normalizedUsername}
                  userId={profile.userId}
                  profileData={{
                    name: profile.name,
                    bio: profile.bio,
                    profileImage: profile.profileImage,
                    username: normalizedUsername
                  }}
                  initialFriendshipStatus={friendshipStatus}
                  className="w-full"
                />
                
                <ShareButton className="w-full py-2 rounded-lg" />
              </div>
            </div>
          </div>
          
          {/* Profile Activity */}
          <ProfileActivityData 
            userId={profile.userId} 
            username={normalizedUsername}
            name={profile.name || normalizedUsername}
            profileImage={profile.profileImage}
          />
        </div>
      </div>
    </ProfileLayoutManager>
  );
}