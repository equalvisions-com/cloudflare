'use client';

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface TrendingTopicsGridProps {
  isAuthenticated: boolean;
  onTopicClick: (title: string, subtopic: string) => void;
}

export function TrendingTopicsGrid({ isAuthenticated, onTopicClick }: TrendingTopicsGridProps) {
  // Fetch trending topics from Convex
  const trendingTopics = useQuery(api.trendingTopics.getActiveTrendingTopics);

  // Show loading state while fetching
  if (trendingTopics === undefined) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border rounded-xl p-3 bg-secondary/0 animate-pulse">
              <div className="flex items-center mb-3">
                <div className="w-4 h-4 bg-muted rounded mr-2" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
              <div className="h-4 bg-muted rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Return nothing if no topics are available
  if (!trendingTopics || trendingTopics.length === 0) {
    return null;
  }

  // Render dynamic topics from database
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-4">
        {trendingTopics.map((topic) => (
          <div 
            key={topic._id}
            className={cn(
              "border rounded-xl p-3 bg-secondary/0 hover:bg-secondary/80 cursor-pointer transition-colors",
              !isAuthenticated && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => isAuthenticated && onTopicClick(topic.title, topic.subtopic)}
          >
            <h3 className="text-muted-foreground text-sm font-medium mb-3 flex items-center leading-none">
              {topic.imageUrl && (
                <Image
                  src={topic.imageUrl}
                  alt={topic.title}
                  width={16}
                  height={16}
                  className="mr-2 rounded-sm object-cover"
                />
              )}
              <span>{topic.title}</span>
            </h3>
            <p className="text-primary text-sm leading-none">{topic.subtopic}</p>
          </div>
        ))}
      </div>
    </div>
  );
} 