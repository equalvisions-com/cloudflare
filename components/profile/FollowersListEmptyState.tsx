"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Users, RefreshCw } from "lucide-react";

interface FollowersListEmptyStateProps {
  variant?: "default" | "error";
  postTitle?: string;
  onRetry?: () => void;
  className?: string;
}

const FollowersListEmptyStateComponent = ({
  variant = "default",
  postTitle,
  onRetry,
  className = "",
}: FollowersListEmptyStateProps) => {
  if (variant === "error") {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 text-center ${className}`}>
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <RefreshCw className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Failed to load followers</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          We couldn't load the followers list. Please check your connection and try again.
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center h-full p-8 text-center ${className}`}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No followers yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {postTitle 
          ? `Be the first to follow "${postTitle}"!`
          : "Be the first to follow this post!"
        }
      </p>
      <p className="text-xs text-muted-foreground">
        When people follow this post, they'll appear here.
      </p>
    </div>
  );
};

export const FollowersListEmptyState = memo(FollowersListEmptyStateComponent); 