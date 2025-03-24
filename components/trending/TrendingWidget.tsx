"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Flame } from "lucide-react";
import Link from "next/link";

export interface TrendingTopic {
  id: string;
  title: string;
  count: number;
  slug: string;
}

interface TrendingWidgetProps {
  topics?: TrendingTopic[];
  className?: string;
}

// Placeholder trending data
const placeholderTrendingTopics: TrendingTopic[] = [
  { id: '1', title: 'Artificial Intelligence', count: 1250, slug: 'artificial-intelligence' },
  { id: '2', title: 'Web Development', count: 890, slug: 'web-development' },
  { id: '3', title: 'Blockchain', count: 745, slug: 'blockchain' },
  { id: '4', title: 'Productivity', count: 612, slug: 'productivity' },
  { id: '5', title: 'Machine Learning', count: 578, slug: 'machine-learning' },
];

export function TrendingWidget({ topics = placeholderTrendingTopics, className = "" }: TrendingWidgetProps) {
  return (
    <Card className={`shadow-none ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span>Trending Topics</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <ul className="space-y-3">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link 
                href={`/topic/${topic.slug}`} 
                className="flex items-center justify-between group"
              >
                <span className="text-sm hover:text-primary group-hover:underline">
                  {topic.title}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{topic.count}</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
} 