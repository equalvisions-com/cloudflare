'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Repeat } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useToast } from "@/components/ui/use-toast";

interface RetweetButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
  initialData?: {
    isRetweeted: boolean;
    count: number;
  };
}

export function RetweetButtonClientWithErrorBoundary(props: RetweetButtonProps) {
  return (
    <ErrorBoundary>
      <RetweetButtonClient {...props} />
    </ErrorBoundary>
  );
}

export function RetweetButtonClient({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isRetweeted: false, count: 0 }
}: RetweetButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const retweet = useMutation(api.retweets.retweet);
  const unretweet = useMutation(api.retweets.unretweet);
  
  // Use SWR for state management but without the fetcher
  const { data, mutate } = useSWR(
    `retweet-${entryGuid}`,
    null, // No fetcher function
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const isRetweeted = data?.isRetweeted ?? initialData.isRetweeted;
  const retweetCount = data?.count ?? initialData.count;

  const handleClick = async () => {
    if (!isAuthenticated) {
      router.push('/signin');
      return;
    }

    // Calculate the new state for optimistic update
    const newState = {
      isRetweeted: !isRetweeted,
      count: retweetCount + (isRetweeted ? -1 : 1)
    };

    // Optimistic update
    await mutate(newState, false);

    try {
      let result;
      if (isRetweeted) {
        // If currently retweeted, unretweet
        result = await unretweet({ entryGuid });
        if (result.success) {
          toast({
            description: "Removed from your shares",
          });
        }
      } else {
        // If not currently retweeted, retweet
        result = await retweet({
          entryGuid,
          feedUrl,
          title,
          pubDate,
          link,
        });
        if (result.success) {
          toast({
            description: "Added to your shares",
          });
        }
      }
      
      if (!result?.success) {
        // If the mutation wasn't successful, revalidate to get the correct state
        console.error('Retweet operation failed:', result);
        await mutate(initialData); // Revert to initial state
        toast({
          variant: "destructive",
          description: "Failed to update share status. Please try again.",
        });
        return;
      }
      
      // After successful mutation, update the global cache
      globalMutate(
        `/api/batch`,
        (data) => {
          if (!data?.entries) return data;
          return {
            ...data,
            entries: {
              ...data.entries,
              [entryGuid]: {
                ...data.entries[entryGuid],
                retweets: newState
              }
            }
          };
        },
        { revalidate: false }
      );
    } catch (err) {
      console.error('Error updating retweet status:', err);
      // Revert on error by reverting to initial state
      await mutate(initialData);
      toast({
        variant: "destructive",
        description: "Failed to update share status. Please try again.",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full"
      onClick={handleClick}
    >
      <Repeat 
        className={`h-4 w-4 transition-colors ${isRetweeted ? 'text-[#00ba7c]' : ''}`}
      />
      <span>{retweetCount}</span>
    </Button>
  );
} 