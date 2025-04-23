"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@/components/ui/drawer";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileImage } from "@/components/profile/ProfileImage";
import { SimpleFriendButton } from "@/components/ui/SimpleFriendButton";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface Props {
  followerCount: number;
  postId: Id<"posts">;
  totalEntries?: number | null;
  mediaType?: string;
}

export function FollowerCount({ followerCount, postId, totalEntries, mediaType }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const followers = useQuery(api.following.getFollowers, 
    isOpen ? { postId } : "skip"
  );

  const getContentLabel = () => {
    switch (mediaType?.toLowerCase()) {
      case 'podcast':
        return totalEntries === 1 ? 'Episode' : 'Episodes';
      case 'newsletter':
        return totalEntries === 1 ? 'Newsletter' : 'Newsletters';
    }
  };

  return (
    <div className="max-w-4xl text-sm flex items-center gap-4">
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button variant="ghost" className="flex items-center h-auto p-0 hover:bg-transparent group">
              <span className="leading-none font-medium mr-[-3px]">{followerCount}</span>{' '}
              <span className="leading-none font-medium">{followerCount === 1 ? 'Follower' : 'Followers'}</span>
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[75vh] w-full max-w-[550px] mx-auto">
          <DrawerHeader className="px-4 pb-4 border-b border-border">
            <DrawerTitle className="text-base font-extrabold leading-none tracking-tight text-center">Followers</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="h-[calc(75vh-160px)]" scrollHideDelay={0} type="always">
            <div>
              <div className="space-y-0">
                {followers === undefined ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : followers.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4">No followers yet</div>
                ) : (
                  followers.map((follower) => (
                    <div key={follower.userId} className="flex items-center gap-3 p-4 border-b border-border">
                      <Link href={`/@${follower.username}`} className="flex-shrink-0">
                        <ProfileImage
                          profileImage={follower.profileImage}
                          username={follower.username}
                          size="md-lg"
                        />
                      </Link>
                      <div className="flex flex-col flex-1">
                        <Link href={`/@${follower.username}`}>
                          <span className="text-sm font-bold">{follower.name || follower.username}</span>
                        </Link>
                        <Link href={`/@${follower.username}`} className="mt-[-4px]">
                          <span className="text-xs text-muted-foreground">@{follower.username}</span>
                        </Link>
                      </div>
                      <SimpleFriendButton
                        username={follower.username}
                        userId={follower.userId}
                        profileData={{
                          username: follower.username,
                          name: follower.name,
                          profileImage: follower.profileImage
                        }}
                        className="rounded-full h-9 px-4 py-2 flex-shrink-0 mt-0 font-semibold text-sm"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
      {totalEntries ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="flex items-center h-auto p-0 hover:bg-transparent group">
              <span className="leading-none font-medium mr-[-3px]">{totalEntries}</span>{' '}
              <span className="leading-none font-medium">{getContentLabel()}</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
} 