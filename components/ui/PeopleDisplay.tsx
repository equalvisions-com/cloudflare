'use client';

import React, { useEffect, useState, memo, useRef, useCallback } from 'react';
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

export function PeopleDisplay({
  initialUsers = [],
  className,
  searchQuery = '',
}: PeopleDisplayProps) {
  // Store users and pagination state
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [nextCursor, setNextCursor] = useState<Id<"users"> | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { isAuthenticated } = useConvexAuth();
  
  // Reference for loading more users
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Query for users - search results
  const usersResult = useQuery(
    api.users.searchUsers,
    { query: searchQuery || " ", cursor: nextCursor, limit: 10 }
  );

  // Reset state when search query changes
  useEffect(() => {
    setUsers([]);
    setNextCursor(undefined);
    setIsInitialLoad(true);
    setHasMore(true);
  }, [searchQuery]);

  // Load users when results come in
  useEffect(() => {
    if (usersResult && isInitialLoad) {
      if (usersResult.users && usersResult.users.length > 0) {
        setUsers(usersResult.users);
        setNextCursor(usersResult.nextCursor || undefined);
        setHasMore(!!usersResult.hasMore);
      }
      setIsInitialLoad(false);
      setIsLoading(false);
    }
  }, [usersResult, isInitialLoad]);

  // Function to load more users
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || !nextCursor) return;
    setIsLoading(true);
  }, [hasMore, isLoading, nextCursor]);

  // Load more users when needed
  useEffect(() => {
    if (usersResult && isLoading && !isInitialLoad) {
      if (usersResult.users && usersResult.users.length > 0) {
        setUsers(prev => [...prev, ...usersResult.users]);
        setNextCursor(usersResult.nextCursor || undefined);
        setHasMore(!!usersResult.hasMore);
      } else {
        setHasMore(false);
      }
      setIsLoading(false);
    }
  }, [usersResult, isLoading, isInitialLoad]);

  // Initial loading state
  if (isInitialLoad && (!usersResult || !usersResult.users)) {
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
        endReached={() => {
          if (hasMore && !isLoading) {
            loadMore();
          }
        }}
        overscan={100}
        itemContent={(index, user) => (
          <UserCard key={user.userId} user={user} />
        )}
        components={{
          Footer: () => (
            <div ref={loadMoreRef} className="py-4 text-center">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : hasMore ? (
                <div className="h-8" />
              ) : (
                <div className="text-muted-foreground text-sm py-2">
                  {users.length > 0 ? 'No more people to load' : 'No people found'}
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  );
}

// User card component - memoized with proper props comparison
const UserCard = memo(({ user }: { user: UserProfile }) => {
  // Default SVG profile image
  const defaultProfileImage = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%20100%20100%27%3E%3Ccircle%20cx=%2750%27%20cy=%2750%27%20r=%2750%27%20fill=%27%23E1E8ED%27/%3E%3Ccircle%20cx=%2750%27%20cy=%2740%27%20r=%2712%27%20fill=%27%23FFF%27/%3E%3Cpath%20fill=%27%23FFF%27%20d=%27M35,70c0-8.3%208.4-15%2015-15s15,6.7%2015,15v5H35V70z%27/%3E%3C/svg%3E";
  const [descriptionLines, setDescriptionLines] = useState(2);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const checkTitleHeight = () => {
      if (titleRef.current) {
        const styles = window.getComputedStyle(titleRef.current);
        const lineHeight = styles.lineHeight;
        const titleHeight = titleRef.current.offsetHeight;
        const fontSize = parseInt(styles.fontSize);
        
        // Calculate approximate number of lines (using fontSize as fallback if lineHeight is 'normal')
        const effectiveLineHeight = lineHeight === 'normal' ? fontSize * 1.2 : parseInt(lineHeight);
        const numberOfLines = Math.round(titleHeight / effectiveLineHeight);
        
        // If title is single line, show 3 lines of description, else show 2
        setDescriptionLines(numberOfLines === 1 ? 3 : 2);
      }
    };

    checkTitleHeight();
    // Add resize listener to handle window size changes
    window.addEventListener('resize', checkTitleHeight);
    return () => window.removeEventListener('resize', checkTitleHeight);
  }, []);
  
  return (
    <Card className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
      <CardContent className="p-4 h-[116px]">
        <div className="flex items-start gap-4">
          <Link href={`/@${user.username}`}>
            <div className="flex-shrink-0 w-[82px] h-[82px]">
              <AspectRatio ratio={1/1} className="overflow-hidden rounded-md">
                <Image
                  src={user.profileImage || defaultProfileImage}
                  alt={user.name || user.username}
                  fill
                  sizes="82px"
                  className="object-cover"
                />
              </AspectRatio>
            </div>
          </Link>
          <div className="flex-1 min-w-0 space-y-2 pt-0">
            <div className="flex justify-between items-start gap-4 mt-[-4px]">
              <Link href={`/@${user.username}`} className="block flex-1">
                <h3 ref={titleRef} className="text-lg font-semibold leading-tight line-clamp-2 mt-[2px]">
                  {user.name || user.username}
                  {user.name && (
                    <span className="text-muted-foreground text-sm font-normal ml-2">
                      @{user.username}
                    </span>
                  )}
                </h3>
              </Link>
              <div className="flex-shrink-0">
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
                  className="bg-primary text-primary-foreground shadow-none py-2 rounded-full px-2 h-[25px] text-xs"
                  pendingClassName="bg-muted/50 text-muted-foreground"
                  friendsClassName="bg-primary/5 text-primary/90"
                />
              </div>
            </div>
            <Link href={`/@${user.username}`} className="block !mt-[3px]">
              <p className={cn(
                "text-sm text-muted-foreground",
                descriptionLines === 3 ? "line-clamp-3" : "line-clamp-2"
              )}>
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