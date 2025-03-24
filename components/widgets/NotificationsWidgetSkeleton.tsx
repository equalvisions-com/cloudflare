import { Skeleton } from "@/components/ui/skeleton";

export function NotificationsWidgetSkeleton() {
  return (
    <div className="p-4 rounded-lg border">
      <div className="flex items-center mb-2">
        <Skeleton className="h-5 w-5 mr-2 rounded-full" />
        <Skeleton className="h-7 w-32" />
      </div>
      <Skeleton className="h-5 w-full max-w-[200px] mt-3" />
    </div>
  );
} 