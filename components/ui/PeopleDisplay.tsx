'use client';

import React, { useEffect, useState, memo, useRef, useCallback, useMemo } from 'react';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SimpleFriendButton } from '@/components/ui/SimpleFriendButton';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { Virtuoso } from 'react-virtuoso';

// Define the shape of a user profile from the database
export interface UserProfile {
  userId: Id<"users">;
  username: string;
  name?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  isAuthenticated?: boolean;
  friendshipStatus?: {
    exists: boolean;
    status: string | null;
    direction: string | null;
    friendshipId: Id<"friends"> | null;
  } | null;
}

interface PeopleDisplayProps {
  initialUsers?: UserProfile[];
  className?: string;
  searchQuery?: string;
}

// Memoize no users state component
const NoUsersState = memo(({ 
  searchQuery, 
  className 
}: { 
  searchQuery?: string;
  className?: string;
}) => (
  <div className={cn("py-8 text-center", className)}>
    <p className="text-muted-foreground text-sm">
      {searchQuery 
        ? `No people found matching "${searchQuery}"`
        : `No people found`}
    </p>
  </div>
));

NoUsersState.displayName = 'NoUsersState';

// Convert to an arrow function component for consistency and prepare for memoization
const PeopleDisplayComponent = ({
  initialUsers = [],
  className,
  searchQuery = '',
}: PeopleDisplayProps) => {
  // Store users and pagination state
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [nextCursor, setNextCursor] = useState<Id<"users"> | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(initialUsers.length === 0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { isAuthenticated } = useConvexAuth();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Reference for loading more users
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Memoize query parameters to prevent unnecessary re-renders
  const queryParams = useMemo(() => {
    return searchQuery 
      ? { query: searchQuery, cursor: nextCursor, limit: 10 } 
      : "skip";
  }, [searchQuery, nextCursor]);

  // Query for users - search results
  const usersResult = useQuery(
    api.users.searchUsersOptimized,
    queryParams
  );

  // Reset state when search query changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (searchQuery) {
      setUsers([]);
      setNextCursor(undefined);
      setIsInitialLoad(true);
      setHasMore(true);
    }
  }, [searchQuery]);

  // Load users when results come in
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (usersResult && isInitialLoad && searchQuery) {
      if (usersResult.users && usersResult.users.length > 0) {
        setUsers(usersResult.users);
        setNextCursor(usersResult.nextCursor || undefined);
        setHasMore(!!usersResult.hasMore);
      }
      setIsInitialLoad(false);
      setIsLoading(false);
    }
  }, [usersResult, isInitialLoad, searchQuery]);

  // Function to load more users
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || !nextCursor || !searchQuery || !isMountedRef.current) return;
    setIsLoading(true);
  }, [hasMore, isLoading, nextCursor, searchQuery]);

  // Load more users when needed
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (usersResult && isLoading && !isInitialLoad && searchQuery) {
      if (usersResult.users && usersResult.users.length > 0) {
        setUsers(prev => [...prev, ...usersResult.users]);
        setNextCursor(usersResult.nextCursor || undefined);
        setHasMore(!!usersResult.hasMore);
      } else {
        setHasMore(false);
      }
      setIsLoading(false);
    }
  }, [usersResult, isLoading, isInitialLoad, searchQuery]);
  
  // Handle end reached for Virtuoso
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);
  
  // Memoize the Footer component for Virtuoso
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
  ), [isLoading, hasMore, loadMoreRef]);
  
  // Initial loading state for search queries
  if (isInitialLoad && searchQuery && (!usersResult || !usersResult.users)) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
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
        itemContent={(index, user) => (
          <UserCard key={user.userId} user={user} />
        )}
        components={{
          Footer
        }}
      />
    </div>
  );
};

// Export the memoized version of the component
export const PeopleDisplay = memo(PeopleDisplayComponent);

// User card component - memoized with proper props comparison
export const UserCard = memo(({ user }: { user: UserProfile }) => {
  // Default SVG profile image
  const defaultProfileImage = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%20100%20100%27%3E%3Ccircle%20cx=%2750%27%20cy=%2750%27%20r=%2750%27%20fill=%27%23E1E8ED%27/%3E%3Ccircle%20cx=%2750%27%20cy=%2740%27%20r=%2712%27%20fill=%27%23FFF%27/%3E%3Cpath%20fill=%27%23FFF%27%20d=%27M35,70c0-8.3%208.4-15%2015-15s15,6.7%2015,15v5H35V70z%27/%3E%3C/svg%3E";
  
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
                />
              </AspectRatio>
            </div>
          </Link>
          <div className="flex-1 min-w-0 space-y-2 pt-0">
            <div className="flex justify-between items-start gap-4">
              <Link href={`/@${user.username}`} className="block flex-1" prefetch={false}>
                <h3 className="text-base font-bold leading-tight line-clamp-1">
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
                    profileData={{
                      username: user.username,
                      name: user.name,
                      bio: user.bio,
                      profileImage: user.profileImage
                    }}
                    initialFriendshipStatus={user.friendshipStatus}
                    className="rounded-full h-[23px] text-xs px-2 flex-shrink-0 mt-0 font-semibold border-0 shadow-none"
                    pendingClassName="text-muted-foreground"
                    friendsClassName="text-muted-foreground"
                  />
                )}
              </div>
            </div>
            <Link href={`/@${user.username}`} className="block !mt-[5px] text-muted-foreground" prefetch={false}>
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