import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

interface FeaturedPostsWidgetSkeletonProps {
  className?: string;
}

export function FeaturedPostsWidgetSkeleton({ className = "" }: FeaturedPostsWidgetSkeletonProps) {
  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <span>You might like</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex items-center flex-grow min-h-[40px]">
                <div className="flex justify-between w-full">
                  <div className="flex-grow">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                  </div>
                  <Skeleton className="h-7 w-20 flex-shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 