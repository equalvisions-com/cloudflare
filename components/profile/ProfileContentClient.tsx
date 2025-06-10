'use client';

import { memo } from 'react';
import { ProfileHeader } from './ProfileHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  ProfileData, 
  FriendshipStatus, 
  ProfileSocialData, 
  ProfileFollowingData 
} from '@/lib/types';

interface ProfileContentClientProps {
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
}

const ProfileContentClientComponent = ({
  profile,
  normalizedUsername,
  displayName,
  friendshipStatus,
  socialCounts,
  initialFriends,
  initialFollowing,
}: ProfileContentClientProps) => {
  // Validate required data
  if (!profile || !profile.userId || !normalizedUsername) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Profile Unavailable
          </h1>
          <p className="text-gray-600 mb-4">
            We&apos;re having trouble loading this profile right now.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary 
      fallback={
        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Profile Unavailable
            </h1>
            <p className="text-gray-600 mb-4">
              We&apos;re having trouble loading @{normalizedUsername}&apos;s profile right now.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      }
    >
      <ProfileHeader
        profile={profile}
        normalizedUsername={normalizedUsername}
        displayName={displayName}
        friendshipStatus={friendshipStatus}
        socialCounts={socialCounts}
        initialFriends={initialFriends}
        initialFollowing={initialFollowing}
      />
    </ErrorBoundary>
  );
};

// Export memoized component
export const ProfileContentClient = memo(ProfileContentClientComponent, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.profile?.userId === nextProps.profile?.userId &&
    prevProps.profile?.name === nextProps.profile?.name &&
    prevProps.profile?.bio === nextProps.profile?.bio &&
    prevProps.profile?.profileImage === nextProps.profile?.profileImage &&
    prevProps.normalizedUsername === nextProps.normalizedUsername &&
    prevProps.socialCounts.friendCount === nextProps.socialCounts.friendCount &&
    prevProps.socialCounts.followingCount === nextProps.socialCounts.followingCount &&
    prevProps.friendshipStatus?.status === nextProps.friendshipStatus?.status
  );
});

ProfileContentClient.displayName = 'ProfileContentClient'; 