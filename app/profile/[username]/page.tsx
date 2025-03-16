import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProfileLayoutManager } from "@/components/profile/ProfileLayoutManager";
import { ProfileActivityData } from "@/components/profile/ProfileActivityData";
import { ProfileImage } from "@/components/profile/ProfileImage";
import { FriendButton } from "@/components/profile/FriendButton";

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
                />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold mb-2 leading-tight">{profile.name || normalizedUsername}</h1>
                <p className="text-sm mb-2 text-muted-foreground">@{normalizedUsername}</p>
                {profile.bio && (
                  <p className="text-sm text-muted-foreground">{profile.bio}</p>
                )}
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