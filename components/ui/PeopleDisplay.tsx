'use client';

import React, { useEffect, useState, memo, useRef, useCallback, useMemo } from 'react';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SimpleFriendButton } from '@/components/ui/SimpleFriendButton';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { Virtuoso } from 'react-virtuoso';
import { 
  UserProfile, 
  PeopleDisplayProps, 
  BatchFriendshipStatusResponse,
  transformBatchFriendshipStatusToRecord 
} from '@/lib/types';
import { UsersListSkeleton } from '@/components/users/UsersSkeleton';

// Memoized no users state component
const NoUsersState = memo<{ 
  searchQuery?: string;
  className?: string;
}>(({ searchQuery, className }) => (
  <div className={cn("flex flex-col items-center justify-center py-6 px-4", className)}>
    {/* Icon cluster */}
    <div className="relative mb-4">
      <div className="w-12 h-12 bg-gradient-to-br from-muted to-muted/60 rounded-2xl flex items-center justify-center border border-border shadow-lg">
        <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
    </div>

    {/* Text content */}
    <div className="text-center space-y-1">
      <h3 className="text-foreground font-medium text-sm">No people found</h3>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {searchQuery 
          ? "No people found"
          : "Try searching for people to connect with"}
      </p>
    </div>
  </div>
));

NoUsersState.displayName = 'NoUsersState';

// Memoized user card component with proper props comparison
const UserCard = memo<{ user: UserProfile }>(({ user }) => {
  // Default SVG profile image
  const defaultProfileImage = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%20100%20100%27%3E%3Ccircle%20cx=%2750%27%20cy=%2750%27%20r=%2750%27%20fill=%27%23E1E8ED%27/%3E%3Ccircle%20cx=%2750%27%20cy=%2740%27%20r=%2712%27%20fill=%27%23FFF%27/%3E%3Cpath%20fill=%27%23FFF%27%20d=%27M35,70c0-8.3%208.4-15%2015-15s15,6.7%2015,15v5H35V70z%27/%3E%3C/svg%3E";
  
  // Memoized profile data
  const profileData = useMemo(() => ({
    username: user.username,
    name: user.name,
    bio: user.bio,
    profileImage: user.profileImage
  }), [user.username, user.name, user.bio, user.profileImage]);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Link href={`/@${user.username}`} prefetch={false}>
            <div className="flex-shrink-0 w-16 h-16">
              <AspectRatio ratio={1/1} className="overflow-hidden rounded-full">
                <Image
                  src={user.profileImage || defaultProfileImage}
                  alt={user.name || user.username}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </AspectRatio>
            </div>
          </Link>
          <div className="flex-1 min-w-0 space-y-2 pt-0">
            <div className="flex justify-between items-start gap-4">
              <Link href={`/@${user.username}`} className="block flex-1" prefetch={false}>
                <h3 className="text-base font-bold leading-tight line-clamp-1 overflow-anywhere">
                  {user.name || user.username}
                </h3>
                <div className="text-muted-foreground text-xs font-normal mt-[1px]">
                  @{user.username}
                </div>
              </Link>
              <div className="flex-shrink-0">
                {(!user.friendshipStatus || user.friendshipStatus.status !== "self") && (
                  <SimpleFriendButton 
                    username={user.username}
                    userId={user.userId}
                    profileData={profileData}
                    initialFriendshipStatus={user.friendshipStatus}
                    className="rounded-full h-[23px] text-xs px-2 flex-shrink-0 mt-0 font-semibold border-0 shadow-none"
                    pendingClassName="text-muted-foreground"
                    friendsClassName="text-muted-foreground"
                  />
                )}
              </div>
            </div>
            <Link href={`/@${user.username}`} className="block !mt-[5px] text-muted-foreground overflow-anywhere" prefetch={false}>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {user.bio || ''}
              </p>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  return (
    prevProps.user.userId === nextProps.user.userId &&
    prevProps.user.friendshipStatus?.status === nextProps.user.friendshipStatus?.status
  );
});

UserCard.displayName = 'UserCard';

// Convert to an arrow function component for consistency and prepare for memoization
const PeopleDisplayComponent = memo<PeopleDisplayProps>(({
  initialUsers = [],
  className,
  searchQuery = '',
}) => {
  // Store users and pagination state
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [nextCursor, setNextCursor] = useState<Id<"users"> | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(initialUsers.length === 0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // 🔥 CLIENT-SIDE DEDUPLICATION: Track shown user IDs to prevent duplicates
  const [shownUserIds, setShownUserIds] = useState<Set<string>>(new Set());
  
  // Trigger for refreshing random users
  const [randomRefreshTrigger, setRandomRefreshTrigger] = useState(0);
  
  const { isAuthenticated } = useConvexAuth();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Reference for loading more users
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Set up the mounted ref (only useEffect needed)
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Query for random users when not searching (with refresh capability)
  const randomUsersQuery1 = useQuery(
    api.users.getRandomUsers,
    !searchQuery && randomRefreshTrigger === 0 ? { limit: 75 } : "skip" // Larger batch for 30 users after deduplication
  );
  
  const randomUsersQuery2 = useQuery(
    api.users.getRandomUsers,
    !searchQuery && randomRefreshTrigger === 1 ? { limit: 75 } : "skip" // Larger batch for 30 users after deduplication
  );
  
  const randomUsersQuery3 = useQuery(
    api.users.getRandomUsers,
    !searchQuery && randomRefreshTrigger === 2 ? { limit: 75 } : "skip" // Larger batch for 30 users after deduplication
  );
  
  // Get the active random users result
  const randomUsersResult = randomRefreshTrigger === 0 ? randomUsersQuery1 :
                           randomRefreshTrigger === 1 ? randomUsersQuery2 :
                           randomRefreshTrigger === 2 ? randomUsersQuery3 :
                           randomUsersQuery1; // fallback

  // Effect to trigger random user refresh when needed
  useEffect(() => {
    if (!searchQuery && randomRefreshTrigger > 0) {
      // This will cause the randomUsersResult to re-run
      // The trigger is just to force a refresh of the random query
    }
  }, [randomRefreshTrigger, searchQuery]);

  // Memoize query parameters to prevent unnecessary re-renders
  const queryParams = useMemo(() => {
    if (!searchQuery) return "skip";
    return { query: searchQuery, cursor: nextCursor, limit: 30 };
  }, [searchQuery, nextCursor]);

  // Query for users - search results
  const usersResult = useQuery(
    api.users.searchUsersOptimized,
    queryParams
  );

  // 🔥 REACTIVE FIX FOR SEARCH: Get friendship statuses for all users in state
  // This is needed because search results are paginated, so the main query only has current page
  const searchUserIds = useMemo(() => 
    searchQuery ? users.map(user => user.userId).filter(Boolean) : [],
    [searchQuery, users]
  );

  const searchFriendshipStatuses = useQuery(
    api.friends.getBatchFriendshipStatuses,
    isAuthenticated && searchQuery && searchUserIds.length > 0 ? { userIds: searchUserIds } : "skip"
  );

  // 🔥 REACTIVE FIX FOR RANDOM USERS: Get friendship statuses for all users when not searching
  const randomUserIds = useMemo(() => 
    !searchQuery ? users.map(user => user.userId).filter(Boolean) : [],
    [searchQuery, users]
  );

  const randomFriendshipStatuses = useQuery(
    api.friends.getBatchFriendshipStatuses,
    isAuthenticated && !searchQuery && randomUserIds.length > 0 ? { userIds: randomUserIds } : "skip"
  );

  // Update search users with reactive friendship statuses
  useEffect(() => {
    if (!isMountedRef.current || !searchQuery || !searchFriendshipStatuses) return;
    
    setUsers(prevUsers => 
      prevUsers.map(user => {
        const friendshipStatus = (searchFriendshipStatuses as BatchFriendshipStatusResponse).find(
          (status) => status.userId === user.userId
        );
        
        if (friendshipStatus && 
            (!user.friendshipStatus || 
             user.friendshipStatus.status !== friendshipStatus.status)) {
          return {
            ...user,
            friendshipStatus: {
              exists: friendshipStatus.exists,
              status: friendshipStatus.status,
              direction: friendshipStatus.direction,
              friendshipId: friendshipStatus.friendshipId
            }
          };
        }
        
        return user;
      })
    );
  }, [searchFriendshipStatuses, searchQuery]);

  // Update random users with reactive friendship statuses
  useEffect(() => {
    if (!isMountedRef.current || searchQuery || !randomFriendshipStatuses) return;
    
    setUsers(prevUsers => 
      prevUsers.map(user => {
        const friendshipStatus = (randomFriendshipStatuses as BatchFriendshipStatusResponse).find(
          (status) => status.userId === user.userId
        );
        
        if (friendshipStatus && 
            (!user.friendshipStatus || 
             user.friendshipStatus.status !== friendshipStatus.status)) {
          return {
            ...user,
            friendshipStatus: {
              exists: friendshipStatus.exists,
              status: friendshipStatus.status,
              direction: friendshipStatus.direction,
              friendshipId: friendshipStatus.friendshipId
            }
          };
        }
        
        return user;
      })
    );
  }, [randomFriendshipStatuses, searchQuery]);

  // Handle initial users (for random users display)
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Handle random users (not searching)
    if (!searchQuery && randomUsersResult?.users) {
      if (isInitialLoad) {
        // Initial load - set users and track IDs
        const newUsers = randomUsersResult.users
          .filter(user => !shownUserIds.has(user.userId))
          .slice(0, 30) // Take first 30 for consistent page size
          .map(user => ({
            ...user,
            // Ensure every user has a friendshipStatus to prevent SimpleFriendButton loading
            friendshipStatus: user.friendshipStatus || {
              exists: false,
              status: null,
              direction: null,
              friendshipId: null
            }
          }));
        
        setUsers(newUsers);
        setShownUserIds(prev => {
          const newSet = new Set(prev);
          newUsers.forEach(user => newSet.add(user.userId));
          return newSet;
        });
        setIsInitialLoad(false);
        setIsLoading(false);
      } else if (isLoading) {
        // Loading more random users - deduplicate and append
        const allNewUsers = randomUsersResult.users.filter(user => 
          !shownUserIds.has(user.userId)
        );
        
        // Take first 30 for consistent page size
        const newUsers = allNewUsers.slice(0, 30).map(user => ({
          ...user,
          // Ensure every user has a friendshipStatus to prevent SimpleFriendButton loading
          friendshipStatus: user.friendshipStatus || {
            exists: false,
            status: null,
            direction: null,
            friendshipId: null
          }
        }));
        
        if (newUsers.length > 0) {
          setUsers(prev => [...prev, ...newUsers]);
          setShownUserIds(prev => {
            const newSet = new Set(prev);
            newUsers.forEach(user => newSet.add(user.userId));
            return newSet;
          });
        }
        
        // 🔥 CONSISTENT PAGE SIZES: Check if we got enough new users
        if (newUsers.length < 20) {
          // If we're getting very few new users, we're running out
          setHasMore(false);
        }
        
        setIsLoading(false);
      }
    }
    
    // Handle search users (existing logic)
    if (searchQuery && initialUsers.length > 0) {
      const usersWithStatus = initialUsers.map(user => ({
        ...user,
        // Ensure every user has a friendshipStatus to prevent SimpleFriendButton loading
        friendshipStatus: user.friendshipStatus || {
          exists: false,
          status: null,
          direction: null,
          friendshipId: null
        }
      }));
      setUsers(usersWithStatus);
      setIsInitialLoad(false);
    }
  }, [randomUsersResult, initialUsers, searchQuery, isInitialLoad, isLoading, shownUserIds]);

  // Reset state when search query changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (searchQuery) {
      // Switching to search mode
      setUsers([]);
      setNextCursor(undefined);
      setIsInitialLoad(true);
      setHasMore(true);
      setShownUserIds(new Set()); // Reset deduplication for search
    } else {
      // Switching back to random mode
      setUsers([]);
      setNextCursor(undefined);
      setIsInitialLoad(true);
      setHasMore(true);
      // Keep shownUserIds to continue deduplication in random mode
    }
  }, [searchQuery]);

  // Load users when results come in (initial load)
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (usersResult && searchQuery) {
      if (isInitialLoad) {
        // Initial load - set the users directly
        if (usersResult.users && usersResult.users.length > 0) {
          const usersWithStatus = usersResult.users.map(user => ({
            ...user,
            // Ensure every user has a friendshipStatus to prevent SimpleFriendButton loading
            friendshipStatus: user.friendshipStatus || {
              exists: false,
              status: null,
              direction: null,
              friendshipId: null
            }
          }));
          setUsers(usersWithStatus);
          setNextCursor(usersResult.nextCursor || undefined);
          setHasMore(!!usersResult.hasMore);
        }
        setIsInitialLoad(false);
        setIsLoading(false);
      } else if (isLoading) {
        // Loading more - append to existing users
        if (usersResult.users && usersResult.users.length > 0) {
          const usersWithStatus = usersResult.users.map(user => ({
            ...user,
            // Ensure every user has a friendshipStatus to prevent SimpleFriendButton loading
            friendshipStatus: user.friendshipStatus || {
              exists: false,
              status: null,
              direction: null,
              friendshipId: null
            }
          }));
          setUsers(prev => [...prev, ...usersWithStatus]);
          setNextCursor(usersResult.nextCursor || undefined);
          setHasMore(!!usersResult.hasMore);
        } else {
          setHasMore(false);
        }
        setIsLoading(false);
      }
      // Note: Reactive updates are now handled by the separate getBatchFriendshipStatuses query
    }
  }, [usersResult, isInitialLoad, searchQuery, isLoading]);

  // Function to load more users
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || !isMountedRef.current) return;
    
    if (searchQuery) {
      // Search pagination (existing logic)
      if (!nextCursor) return;
      setIsLoading(true);
    } else {
      // Random users - cycle through different queries to get fresh results
      setIsLoading(true);
      setRandomRefreshTrigger(prev => (prev + 1) % 3); // Cycle 0, 1, 2, 0, 1, 2...
    }
  }, [hasMore, isLoading, nextCursor, searchQuery]);

  // Handle end reached for Virtuoso
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  // Memoized Footer component for Virtuoso
  const Footer = useCallback(() => (
    <div ref={loadMoreRef} className="py-4 text-center">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : hasMore ? (
        <div className="h-8" />
      ) : (
        <div className="h-8" />
      )}
    </div>
  ), [isLoading, hasMore]);

  // Memoized item content renderer
  const itemContent = useCallback((index: number, user: UserProfile) => (
    <UserCard key={user.userId} user={user} />
  ), []);
  
  // Check if we have friendship statuses for all users (similar to FriendsList pattern)
  const userIds = useMemo(() => users.map(user => user.userId), [users]);
  
  const hasFriendshipStatuses = useMemo(() => {
    if (!isAuthenticated || users.length === 0) return true; // No auth or no users = no statuses needed
    
    if (searchQuery) {
      // For search: check if we have friendship statuses for all users
      return searchFriendshipStatuses !== undefined && 
             userIds.every(userId => 
               (searchFriendshipStatuses as BatchFriendshipStatusResponse)?.some(status => status.userId === userId)
             );
    } else {
      // For random users: check if we have friendship statuses for all users
      return randomFriendshipStatuses !== undefined && 
             userIds.every(userId => 
               (randomFriendshipStatuses as BatchFriendshipStatusResponse)?.some(status => status.userId === userId)
             );
    }
  }, [isAuthenticated, users.length, searchQuery, searchFriendshipStatuses, randomFriendshipStatuses, userIds]);

  // Show skeleton until we have both users AND their friendship statuses
  const shouldShowSkeleton = isInitialLoad || 
                             (users.length > 0 && !hasFriendshipStatuses) ||
                             (searchQuery && (!usersResult || !usersResult.users));

  if (shouldShowSkeleton) {
    return <UsersListSkeleton count={6} />;
  }

  // No users state
  if (users.length === 0 && !isInitialLoad && !isLoading) {
    return <NoUsersState searchQuery={searchQuery} className={className} />;
  }

  // Don't render Virtuoso if we have no results yet
  if (users.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-0", className)}>
      <Virtuoso
        useWindowScroll
        data={users}
        endReached={handleEndReached}
        overscan={100}
        itemContent={itemContent}
        components={{
          Footer
        }}
      />
    </div>
  );
});

PeopleDisplayComponent.displayName = 'PeopleDisplay';

// Export the memoized version of the component
export const PeopleDisplay = PeopleDisplayComponent;
export type { UserProfile }; 