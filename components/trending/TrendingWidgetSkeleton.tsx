import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendingWidgetSkeletonProps {
  className?: string;
}

export function TrendingWidgetSkeleton({ className = "" }: TrendingWidgetSkeletonProps) {
  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <span>Trending Now</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <TrendingItemSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendingItemSkeleton() {
  return (
    <div className="flex flex-col space-y-2">
      <div>
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
} 