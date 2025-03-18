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

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

// Helper to normalize username consistently
const normalizeUsername = (username: string) => {
  return decodeURIComponent(username).replace(/^@/, '').toLowerCase();
};

const getProfileByUsername = cache(async (username?: string) => {
  try {
    if (!username) {
      console.error("Username is undefined or empty");
      return null;
    }
    const normalizedUsername = normalizeUsername(username);
    const profile = await fetchQuery(api.profiles.getProfileByUsername, { username: normalizedUsername });
    if (!profile) return null;
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
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }
  
  // Fetch all data in parallel
  const [friendCount, followingCount, initialFriendsData, initialFollowingData] = await Promise.all([
    // Get friend count
    fetchQuery(api.friends.getFriendCountByUsername, { 
      username: normalizedUsername, 
      status: "accepted" 
    }),
    
    // Get following count
    fetchQuery(api.following.getFollowingCountByUsername, { 
      username: normalizedUsername 
    }),
    
    // Get first page of friends
    fetchQuery(api.friends.getFriendsByUsername, {
      username: normalizedUsername,
      status: "accepted",
      limit: 30
    }),
    
    // Get first page of following
    fetchQuery(api.following.getFollowingByUsername, {
      username: normalizedUsername,
      limit: 30
    })
  ]);
  
  // Extract and prepare the data for the components to avoid type errors
  const initialFriends = {
    friends: initialFriendsData.friends,
    hasMore: initialFriendsData.hasMore,
    cursor: initialFriendsData.cursor || null
  };
  
  const initialFollowing = {
    following: initialFollowingData.following,
    hasMore: initialFollowingData.hasMore,
    cursor: initialFollowingData.cursor || null
  };
  
  return (
    <ProfileLayoutManager>
      <div>
        <div>
          <div className="max-w-4xl mx-auto p-4 border-l border-r">
            <div className="flex flex-col items-start mb-4">
              <div className="flex w-full items-center justify-between">
                <ProfileImage 
                  profileImage={profile.profileImage} 
                  username={normalizedUsername}
                  size="lg"
                  className="mb-4"
                />
                <FriendButton 
                  username={normalizedUsername}
                  userId={profile.userId}
                  profileData={{
                    name: profile.name,
                    bio: profile.bio,
                    profileImage: profile.profileImage,
                    username: normalizedUsername
                  }}
                />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold mb-2 leading-tight">{profile.name || normalizedUsername}</h1>
                <p className="text-sm mb-2 text-muted-foreground">@{normalizedUsername}</p>
                {profile.bio && (
                  <p className="text-sm text-muted-foreground mb-2">{profile.bio}</p>
                )}
                <div className="flex gap-4">
                  <FriendsList 
                    username={normalizedUsername} 
                    initialCount={friendCount}
                    initialFriends={initialFriends}
                  />
                  <FollowingList 
                    username={normalizedUsername} 
                    initialCount={followingCount}
                    initialFollowing={initialFollowing}
                  />
                </div>
              </div>
            </div>
          </div>
          
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