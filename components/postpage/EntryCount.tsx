import { MessageSquare, Users } from 'lucide-react';

interface Props {
  count: number;
  followerCount: number;
}

export function EntryCount({ count, followerCount }: Props) {
  return (
    <div className="max-w-4xl mt-4 text-sm text-primary font-semibold flex items-center gap-4">
      <div className="flex items-center">
        <MessageSquare className="h-4 w-4 mr-2" />
        {count} Posts
      </div>
      <div className="flex items-center">
        <Users className="h-4 w-4 mr-2" />
        {followerCount} Followers
      </div>
    </div>
  );
} 