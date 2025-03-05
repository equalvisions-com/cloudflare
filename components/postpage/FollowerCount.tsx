"use client";

import { Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

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
    <div className="max-w-4xl mt-2 text-sm flex items-center gap-4">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="flex items-center h-auto p-0 hover:bg-transparent group">
            <span className="group-hover:underline">
              <span className="text-primary font-bold mr-[2px]">{followerCount}</span>{' '}
              <span className="text-primary">Followers</span>
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Followers</DialogTitle>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto pr-4">
            <div className="space-y-2">
              {followers === undefined ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : followers.length === 0 ? (
                <div className="text-sm text-muted-foreground">No followers yet</div>
              ) : (
                followers.map((follower) => (
                  <div key={follower.userId} className="flex items-center gap-2 py-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">@{follower.username}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {totalEntries ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="flex items-center h-auto p-0 hover:bg-transparent group">
            <span className="group-hover:underline">
              <span className="text-primary font-bold mr-[2px]">{totalEntries}</span>{' '}
              <span className="text-primary">{getContentLabel()}</span>
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
} 