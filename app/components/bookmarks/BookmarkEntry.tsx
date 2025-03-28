import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

type BookmarkEntryProps = {
  title: string;
  link: string;
  pubDate: string;
  bookmarkedAt: number;
};

export const BookmarkEntry = ({ title, link, pubDate, bookmarkedAt }: BookmarkEntryProps) => {
  const timeAgo = formatDistanceToNow(new Date(bookmarkedAt), { addSuffix: true });
  
  return (
    <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <Link href={link} target="_blank">
        <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 mb-1">{title}</h3>
      </Link>
      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-gray-500">
          Published: {new Date(pubDate).toLocaleDateString()}
        </div>
        <div className="text-xs text-gray-500">
          Bookmarked: {timeAgo}
        </div>
      </div>
    </div>
  );
}; 