import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProfileLayoutManager } from "@/components/profile/ProfileLayoutManager";
import { ProfileActivityData } from "@/components/profile/ProfileActivityData";

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
          <div className="prose dark:prose-invert p-4 border-l border-r">
            <h1 className="text-3xl font-bold mb-4">{normalizedUsername}</h1>
            <p>User ID: {profile.userId}</p>
            {profile.rssKeys && profile.rssKeys.length > 0 ? (
              <div>
                <h2 className="text-xl font-semibold mt-6 mb-2">Followed Feeds</h2>
                <ul className="list-disc pl-5">
                  {profile.rssKeys.map((key) => (
                    <li key={key}>{key}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>No followed feeds yet.</p>
            )}
          </div>
          
          <ProfileActivityData 
            userId={profile.userId} 
            username={normalizedUsername} 
          />
        </div>
      </div>
    </ProfileLayoutManager>
  );
}