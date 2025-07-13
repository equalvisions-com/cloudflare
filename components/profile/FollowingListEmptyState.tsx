"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Heart, 
  Search, 
  Plus, 
  BookOpen, 
  Rss, 
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

// Props for the empty state component
interface FollowingListEmptyStateProps {
  variant?: 'default' | 'search' | 'error' | 'first-time' | 'loading-failed';
  username?: string;
  isOwnProfile?: boolean;
  onRetry?: () => void;
  onExplore?: () => void;
  className?: string;
}

// Default empty state for when user has no following
const DefaultEmptyState: React.FC<{
  isOwnProfile: boolean;
  username?: string;
  onExplore?: () => void;
}> = ({ isOwnProfile, username, onExplore }) => (
  <div className="text-center py-12 px-6">
    {/* Illustration */}
    <div className="mx-auto w-24 h-24 mb-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
        <Heart className="h-10 w-10 text-gray-400" />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-full flex items-center justify-center">
        <Plus className="h-4 w-4 text-orange-600" />
      </div>
    </div>

    {/* Content */}
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      {isOwnProfile ? "Start Following Content" : `${username} isn't following anything yet`}
    </h3>
    
    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
      {isOwnProfile 
        ? "Discover and follow newsletters, podcasts, and articles that interest you."
        : `When ${username} starts following content, it will appear here.`
      }
    </p>

    {/* Actions */}
    {isOwnProfile && (
      <div className="space-y-3">
        <Button 
          onClick={onExplore}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
        >
          <Search className="h-4 w-4 mr-2" />
          Explore Content
        </Button>
        
        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
          <Link href="/newsletters" className="flex items-center hover:text-blue-600 transition-colors" prefetch={false}>
            <BookOpen className="h-4 w-4 mr-1" />
            Newsletters
          </Link>
          <Link href="/podcasts" className="flex items-center hover:text-blue-600 transition-colors" prefetch={false}>
            <Rss className="h-4 w-4 mr-1" />
            Podcasts
          </Link>
          <Link href="/trending" className="flex items-center hover:text-blue-600 transition-colors" prefetch={false}>
            <TrendingUp className="h-4 w-4 mr-1" />
            Trending
          </Link>
        </div>
      </div>
    )}
  </div>
);

// Search empty state for when search returns no results
const SearchEmptyState: React.FC<{
  searchQuery?: string;
  onRetry?: () => void;
}> = ({ searchQuery, onRetry }) => (
  <div className="text-center py-12 px-6">
    {/* Illustration */}
    <div className="mx-auto w-20 h-20 mb-6 bg-gray-100 rounded-full flex items-center justify-center">
      <Search className="h-8 w-8 text-gray-400" />
    </div>

    {/* Content */}
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      No Results Found
    </h3>
    
    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
      {searchQuery 
        ? `No following items match "${searchQuery}". Try a different search term.`
        : "No following items match your search criteria."
      }
    </p>

    {/* Actions */}
    <div className="space-y-3">
      {onRetry && (
        <Button 
          onClick={onRetry}
          variant="outline"
          className="px-4 py-2"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  </div>
);

// Error empty state for when loading fails
const ErrorEmptyState: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <div className="text-center py-12 px-6">
    {/* Illustration */}
    <div className="mx-auto w-20 h-20 mb-6 bg-red-50 rounded-full flex items-center justify-center">
      <RefreshCw className="h-8 w-8 text-red-400" />
    </div>

    {/* Content */}
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      Failed to Load Following
    </h3>
    
    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
      We couldn&apos;t load the following list. Please check your connection and try again.
    </p>

    {/* Actions */}
    <Button 
      onClick={onRetry}
      variant="outline"
      className="px-6 py-2"
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Retry
    </Button>
  </div>
);

// First-time user empty state with onboarding
const FirstTimeEmptyState: React.FC<{
  onExplore?: () => void;
}> = ({ onExplore }) => (
  <div className="text-center py-12 px-6">
    {/* Illustration */}
    <div className="mx-auto w-28 h-28 mb-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
        <Sparkles className="h-12 w-12 text-blue-500" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-300 to-orange-300 rounded-full animate-pulse" />
      <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-gradient-to-br from-pink-300 to-purple-300 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
    </div>

    {/* Content */}
    <h3 className="text-xl font-bold text-gray-900 mb-2">
      Welcome to Your Following List!
    </h3>
    
    <p className="text-gray-600 mb-8 max-w-md mx-auto">
      This is where you&apos;ll see all the newsletters, podcasts, and articles you follow. 
      Start building your personalized content feed today!
    </p>

    {/* Features */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <BookOpen className="h-6 w-6 text-blue-600 mx-auto mb-2" />
        <h4 className="font-medium text-gray-900 mb-1">Newsletters</h4>
        <p className="text-xs text-gray-600">Stay updated with your favorite publications</p>
      </div>
      
      <div className="text-center p-4 bg-purple-50 rounded-lg">
        <Rss className="h-6 w-6 text-purple-600 mx-auto mb-2" />
        <h4 className="font-medium text-gray-900 mb-1">Podcasts</h4>
        <p className="text-xs text-gray-600">Never miss an episode from your shows</p>
      </div>
      
      <div className="text-center p-4 bg-green-50 rounded-lg">
        <Users className="h-6 w-6 text-green-600 mx-auto mb-2" />
        <h4 className="font-medium text-gray-900 mb-1">Community</h4>
        <p className="text-xs text-gray-600">Connect with like-minded readers</p>
      </div>
    </div>

    {/* Actions */}
    <div className="space-y-4">
      <Button 
        onClick={onExplore}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
      >
        <Search className="h-5 w-5 mr-2" />
        Start Exploring
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
      
      <p className="text-xs text-gray-500">
        Discover trending content and popular creators
      </p>
    </div>
  </div>
);

// Loading failed state with detailed error info
const LoadingFailedEmptyState: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <div className="text-center py-12 px-6">
    {/* Illustration */}
    <div className="mx-auto w-20 h-20 mb-6 bg-orange-50 rounded-full flex items-center justify-center">
      <RefreshCw className="h-8 w-8 text-orange-400" />
    </div>

    {/* Content */}
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      Connection Issue
    </h3>
    
    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
      We&apos;re having trouble loading the following list. This might be due to a temporary network issue.
    </p>

    {/* Actions */}
    <div className="space-y-3">
      <Button 
        onClick={onRetry}
        className="px-6 py-2"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
      
      <p className="text-xs text-gray-500">
        If the problem persists, please check your internet connection
      </p>
    </div>
  </div>
);

// Main empty state component
export const FollowingListEmptyState: React.FC<FollowingListEmptyStateProps> = ({
  variant = 'default',
  username,
  isOwnProfile = false,
  onRetry,
  onExplore,
  className = "",
}) => {
  const baseClasses = "flex flex-col items-center justify-center min-h-[400px] bg-white rounded-lg";
  
  return (
    <div 
      className={`${baseClasses} ${className}`}
      role="status"
      aria-live="polite"
    >
      {variant === 'default' && (
        <DefaultEmptyState 
          isOwnProfile={isOwnProfile} 
          username={username}
          onExplore={onExplore}
        />
      )}
      
      {variant === 'search' && (
        <SearchEmptyState onRetry={onRetry} />
      )}
      
      {variant === 'error' && (
        <ErrorEmptyState onRetry={onRetry} />
      )}
      
      {variant === 'first-time' && (
        <FirstTimeEmptyState onExplore={onExplore} />
      )}
      
      {variant === 'loading-failed' && (
        <LoadingFailedEmptyState onRetry={onRetry} />
      )}
    </div>
  );
};

// Compact empty state for smaller spaces
export const FollowingListCompactEmptyState: React.FC<{
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({ 
  message = "No following items", 
  actionLabel = "Explore", 
  onAction,
  className = "" 
}) => (
  <div className={`text-center py-8 px-4 ${className}`}>
    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <Heart className="h-6 w-6 text-gray-400" />
    </div>
    
    <p className="text-gray-600 mb-4 text-sm">{message}</p>
    
    {onAction && (
      <Button 
        onClick={onAction}
        variant="outline"
        size="sm"
        className="px-4 py-2"
      >
        {actionLabel}
      </Button>
    )}
  </div>
);

// Inline empty state for use within lists
export const FollowingListInlineEmptyState: React.FC<{
  message?: string;
  className?: string;
}> = ({ 
  message = "No items to display", 
  className = "" 
}) => (
  <div className={`flex items-center justify-center py-12 px-4 text-gray-500 ${className}`}>
    <div className="text-center">
      <Heart className="h-8 w-8 mx-auto mb-2 text-gray-300" />
      <p className="text-sm">{message}</p>
    </div>
  </div>
);

// Export default as the main empty state
export default FollowingListEmptyState; 