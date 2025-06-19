import { memo } from 'react';
import { ProfileImage } from './ProfileImage';
import { FriendButton } from './FriendButton';
import { FriendsList } from './FriendsList';
import { FollowingList } from './FollowingList';
import { ShareButton } from '@/components/ui/share-button';
import { 
  ProfileData, 
  FriendshipStatus, 
  ProfileSocialData, 
  ProfileFollowingData 
} from '@/lib/types';
import { Id } from '@/convex/_generated/dataModel';

interface ProfileHeaderProps {
  profile: ProfileData;
  normalizedUsername: string;
  displayName: string;
  friendshipStatus: FriendshipStatus | null;
  socialCounts: {
    friendCount: number;
    followingCount: number;
  };
  initialFriends: ProfileSocialData;
  initialFollowing: ProfileFollowingData;
  shareUrl: string;
}

const ProfileHeaderComponent = ({
  profile,
  normalizedUsername,
  displayName,
  friendshipStatus,
  socialCounts,
  initialFriends,
  initialFollowing,
  shareUrl,
}: ProfileHeaderProps) => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex flex-col w-full" style={{ gap: '16px' }}>
        {/* Profile Header */}
        <div className="flex justify-between items-start w-full">
          {/* Left Column: Groups with specific gaps */}
          <div className="flex flex-col items-start text-left max-w-[70%]">
            {/* Group 1: Title */}
            <div className="w-full">
              <h1 className="text-2xl font-extrabold break-words leading-none tracking-tight m-0 p-0">
                {displayName}
              </h1>
              <p className="text-sm leading-none mt-1 text-muted-foreground font-medium">
                @{normalizedUsername}
              </p>
            </div>
            
            {/* Group 2: Bio (with 12px gap) */}
            {profile.bio && (
              <p className="w-full text-sm break-words text-primary" style={{ marginTop: '10px' }}>
                {profile.bio}
              </p>
            )}
            
            {/* Group 3: Follower/Friend Counts (with 12px gap) */}
            <div className="w-full text-muted-foreground font-medium" style={{ marginTop: '10px' }}>
              <div className="flex gap-4">
                <FollowingList 
                  username={normalizedUsername} 
                  initialCount={socialCounts.followingCount}
                  initialFollowing={initialFollowing}
                />
                <FriendsList 
                  username={normalizedUsername} 
                  initialCount={socialCounts.friendCount}
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
          
          <ShareButton 
            className="w-full py-2 rounded-lg" 
            displayName={displayName}
            shareUrl={shareUrl}
          />
        </div>
      </div>
    </div>
  );
};

// Export memoized component with custom comparison
export const ProfileHeader = memo(ProfileHeaderComponent, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.profile.userId === nextProps.profile.userId &&
    prevProps.profile.name === nextProps.profile.name &&
    prevProps.profile.bio === nextProps.profile.bio &&
    prevProps.profile.profileImage === nextProps.profile.profileImage &&
    prevProps.normalizedUsername === nextProps.normalizedUsername &&
    prevProps.socialCounts.friendCount === nextProps.socialCounts.friendCount &&
    prevProps.socialCounts.followingCount === nextProps.socialCounts.followingCount &&
    prevProps.friendshipStatus?.status === nextProps.friendshipStatus?.status &&
    prevProps.shareUrl === nextProps.shareUrl
  );
});

ProfileHeader.displayName = 'ProfileHeader'; 