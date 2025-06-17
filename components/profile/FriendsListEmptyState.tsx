"use client";

import { Button } from "@/components/ui/button";
import { Users, UserPlus, RefreshCw } from "lucide-react";
import { memo } from "react";

interface FriendsListEmptyStateProps {
  type: 'no-friends' | 'error' | 'search-no-results';
  username?: string;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const FriendsListEmptyState = memo<FriendsListEmptyStateProps>(({
  type,
  username,
  error,
  onRetry,
  onRefresh,
  isLoading = false
}) => {
  const getEmptyStateContent = () => {
    switch (type) {
      case 'no-friends':
        return {
          icon: <Users className="h-12 w-12 text-muted-foreground/50" />,
          title: "No friends yet",
          description: username 
            ? `${username} hasn't added any friends yet.`
            : "Start connecting with people to see them here.",
          action: null
        };
      
      case 'error':
        return {
          icon: <RefreshCw className="h-12 w-12 text-destructive/50" />,
          title: "Unable to load friends",
          description: error || "Something went wrong while loading the friends list.",
          action: onRetry ? (
            <Button 
              variant="outline" 
              onClick={onRetry}
              disabled={isLoading}
              className="mt-4"
              aria-label="Retry loading friends"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          ) : null
        };
      
      case 'search-no-results':
        return {
          icon: <UserPlus className="h-12 w-12 text-muted-foreground/50" />,
          title: "No friends found",
          description: "Try adjusting your search or browse all friends.",
          action: onRefresh ? (
            <Button 
              variant="ghost" 
              onClick={onRefresh}
              className="mt-4"
              aria-label="Clear search and show all friends"
            >
              Show All Friends
            </Button>
          ) : null
        };
      
      default:
        return {
          icon: <Users className="h-12 w-12 text-muted-foreground/50" />,
          title: "No friends",
          description: "No friends to display.",
          action: null
        };
    }
  };

  const { icon, title, description, action } = getEmptyStateContent();

  return (
    <div 
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="mb-4" aria-hidden="true">
        {icon}
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        {description}
      </p>
      
      {action}
      
      {/* Screen reader announcement */}
      <span className="sr-only">
        {type === 'error' 
          ? `Error loading friends: ${error || 'Unknown error'}`
          : `${title}: ${description}`
        }
      </span>
    </div>
  );
});

FriendsListEmptyState.displayName = "FriendsListEmptyState"; 