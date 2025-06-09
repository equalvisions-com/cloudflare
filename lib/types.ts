export interface RSSEntry {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

export interface LikeCount {
  entryLink: string;
  count: number;
}

export interface CommentCount {
  entryLink: string;
  count: number;
}

export interface RSSFeedData {
  entries: RSSEntry[];
  likes: Record<string, number>;
  comments: Record<string, number>;
}

// Type definitions for database operations
import { ExecutedQuery } from '@planetscale/database';
import { Id } from '@/convex/_generated/dataModel';

// PlanetScale database types
export type PlanetScaleQueryResult<T = Record<string, unknown>> = ExecutedQuery & {
  rows: T[];
};

// RSS Feed types
export interface RSSFeedRow {
  id: number;
  feed_url: string;
  title: string;
  media_type?: string | null;
  last_fetched: string | number;
  created_at: string;
  updated_at: string;
}

export interface RSSEntryRow {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string | null;
  media_type?: string | null;
  created_at: string;
}

// API response types
export interface APIResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

// XML parsing types
export interface XMLParseResult {
  rss?: {
    channel?: {
      title?: string;
      link?: string;
      description?: string;
      item?: Record<string, unknown>[] | Record<string, unknown>;
    };
  };
  feed?: {
    title?: string;
    link?: string | { "@_href": string }[];
    entry?: Record<string, unknown>[] | Record<string, unknown>;
  };
}

// Notification types
export interface FriendshipData {
  _id: Id<"friends">;
  requesterId: Id<"users">;
  requesteeId: Id<"users">;
  status: string;
  createdAt: number;
  updatedAt?: number;
  direction: string;
  type: string;
  friendId?: Id<"users">;
}

export interface ProfileData {
  _id: Id<"users">;
  userId: Id<"users">;
  username: string;
  name?: string | null;
  bio?: string | null;
  profileImage?: string | null;
}

export interface NotificationItem {
  friendship: FriendshipData;
  profile: ProfileData;
}

export interface User {
  _id: Id<"users">;
  username: string;
  name?: string | null;
  profileImage?: string | null;
}

export interface NotificationsData {
  user: User | null;
  notifications: NotificationItem[];
}

export interface NotificationItemProps {
  notification: NotificationItem;
  isAccepting: boolean;
  isDeclining: boolean;
  onAccept: (friendshipId: Id<"friends">) => void;
  onDecline: (friendshipId: Id<"friends">) => void;
  onRemove: (friendshipId: Id<"friends">) => void;
}

// Notification loading states
export interface NotificationLoadingState {
  acceptingIds: Set<string>;
  decliningIds: Set<string>;
}

// Bookmark types
export interface BookmarkItem {
  _id: string;
  entryGuid: string;
  feedUrl: string;
  title: string;
  link: string;
  pubDate: string;
  bookmarkedAt: number;
}

export interface BookmarkRSSEntry {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_title?: string;
  feed_url?: string;
  mediaType?: string;
  // Additional fields from Convex posts
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean;
}

export interface BookmarkInteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
  bookmarks: { isBookmarked: boolean };
}

export interface BookmarksData {
  bookmarks: BookmarkItem[];
  totalCount: number;
  hasMore: boolean;
  entryDetails: Record<string, BookmarkRSSEntry>;
  entryMetrics: Record<string, BookmarkInteractionStates>;
}

export interface BookmarkLoadingState {
  isLoading: boolean;
  isSearching: boolean;
}

export interface BookmarkSearchState {
  query: string;
  results: BookmarksData | null;
}

// Chat types
export type ActiveButton = "none" | "newsletters" | "podcasts" | "articles";

export interface ChatState {
  activeButton: ActiveButton;
  hasTyped: boolean;
  shouldAnimate: boolean;
  lastMessageId: string | null;
  likedMessages: Record<string, boolean>;
  dislikedMessages: Record<string, boolean>;
}

export interface ChatLoadingState {
  isLoading: boolean;
  isSubmitting: boolean;
}

export interface TouchState {
  activeTouchButton: string | null;
}

export interface SelectionState {
  start: number | null;
  end: number | null;
}

export interface TrendingTopic {
  _id: string;
  title: string;
  subtopic: string;
  imageUrl?: string;
}

export interface ChatActions {
  setActiveButton: (button: ActiveButton) => void;
  setHasTyped: (hasTyped: boolean) => void;
  setShouldAnimate: (shouldAnimate: boolean) => void;
  setLastMessageId: (id: string | null) => void;
  toggleLikeMessage: (messageId: string) => void;
  toggleDislikeMessage: (messageId: string) => void;
  resetChat: () => void;
}

// Users types
export interface UserProfile {
  userId: Id<"users">;
  username: string;
  name?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  isAuthenticated?: boolean;
  friendshipStatus?: {
    exists: boolean;
    status: string | null;
    direction: string | null;
    friendshipId: Id<"friends"> | null;
  } | null;
}

export interface UsersState {
  searchQuery: string;
  pendingSearchQuery: string;
  isSearching: boolean;
}

// Podcasts types
export interface PodcastItem {
  position: number;
  url: string;
  name: string;
  description?: string;
  image?: string;
  category?: string;
  feedUrl?: string;
  lastUpdated?: string;
}

export interface PodcastsState {
  items: PodcastItem[];
  selectedCategory: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface PodcastsActions {
  setItems: (items: PodcastItem[]) => void;
  setSelectedCategory: (category: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Newsletters types
export interface NewsletterItem {
  position: number;
  url: string;
  name: string;
  description?: string;
  image?: string;
  category?: string;
  feedUrl?: string;
  lastUpdated?: string;
}

export interface NewslettersState {
  items: NewsletterItem[];
  selectedCategory: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface NewslettersActions {
  setItems: (items: NewsletterItem[]) => void;
  setSelectedCategory: (category: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Posts Display types
export interface Post {
  _id: Id<"posts">;
  _creationTime: number;
  title: string;
  postSlug: string;
  category: string;
  categorySlug: string;
  body: string;
  featuredImg: string;
  mediaType: string;
  isFeatured?: boolean;
  publishedAt?: number;
  feedUrl?: string;
  isFollowing?: boolean;
  isAuthenticated?: boolean;
  verified?: boolean;
}

export interface PostsDisplayProps {
  categoryId: string;
  mediaType: string;
  initialPosts?: Post[];
  className?: string;
  searchQuery?: string;
  isVisible?: boolean;
}

// Entries Display types
export interface EntriesRSSEntry {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_title?: string;
  feed_url?: string;
  mediaType?: string;
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean;
}

export interface EntriesDisplayProps {
  mediaType: string;
  searchQuery: string;
  className?: string;
  isVisible?: boolean;
  pageSize?: number;
}

export interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

// Entries Store types
export interface EntriesLoadingState {
  isLoading: boolean;
  isInitialLoad: boolean;
  isMetricsLoading: boolean;
}

export interface EntriesState {
  entries: EntriesRSSEntry[];
  page: number;
  hasMore: boolean;
  lastSearchQuery: string;
  loadingState: EntriesLoadingState;
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
}

export interface EntriesActions {
  setEntries: (entries: EntriesRSSEntry[]) => void;
  addEntries: (entries: EntriesRSSEntry[]) => void;
  setPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  setLastSearchQuery: (query: string) => void;
  setLoading: (isLoading: boolean) => void;
  setInitialLoad: (isInitialLoad: boolean) => void;
  setMetricsLoading: (isLoading: boolean) => void;
  setCommentDrawerOpen: (open: boolean) => void;
  setSelectedCommentEntry: (entry: EntriesState['selectedCommentEntry']) => void;
  reset: () => void;
}

// Category types
export interface Category {
  _id: string;
  name: string;
  slug: string;
  mediaType: string;
  order?: number;
}

export interface CategoryData {
  categories: Category[];
  featured: {
    posts: Post[];
    hasMore: boolean;
    nextCursor: string | null;
  };
  initialPostsByCategory: Record<string, {
    posts: Post[];
    hasMore: boolean;
    nextCursor: string | null;
  }>;
}

export interface CategorySliderProps {
  categories: Category[] | undefined;
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  className?: string;
  isLoading?: boolean;
}

export interface CategorySwipeableWrapperProps {
  mediaType: string;
  className?: string;
  showEntries?: boolean;
}

export interface SearchTabsProps {
  searchTab: 'posts' | 'entries';
  displayMediaType: string;
  entriesTabLabel: string;
  handleSearchTabChange: (tab: 'posts' | 'entries') => void;
}

export interface CategorySwipeableState {
  selectedCategoryId: string;
  searchQuery: string;
  pendingSearchQuery: string;
  searchTab: 'posts' | 'entries';
  isSearchLoading: boolean;
  isTransitioning: boolean;
  isInteracting: boolean;
  searchContentLoaded: boolean;
  isMobile: boolean;
}

export interface ScrollPositions {
  [key: string]: number;
}

export interface TabHeights {
  [key: string]: number;
} 