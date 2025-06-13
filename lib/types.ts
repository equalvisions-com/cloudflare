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
import { Id, Doc } from '@/convex/_generated/dataModel';
import type { RSSItem } from '@/lib/rss';

// Re-export RSSItem for centralized access
export type { RSSItem };

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
  name?: string;
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

// Profile Page types
export interface ProfilePageData {
  profile: ProfileData;
  social: {
    friendCount: number;
    followingCount: number;
    friends: ProfileData[];
    following: FollowingWithPost[];
  };
  friendshipStatus: {
    id: Id<"friends">;
    status: string;
    direction: string;
  } | null;
}

export interface FriendshipStatus {
  exists: boolean;
  status: string | null;
  direction: string | null;
  friendshipId: Id<"friends"> | null;
}

export interface FollowingWithPost {
  following: {
    userId: Id<"users">;
    postId: Id<"posts">;
    feedUrl: string;
    _id: Id<"following">;
  };
  post: {
    _id: Id<"posts">;
    title: string;
    postSlug: string;
    categorySlug: string;
    featuredImg?: string;
    mediaType: string;
    verified?: boolean;
  };
}

// Types that match what the components expect
export interface FriendWithProfile {
  friendship: {
    _id: Id<"friends">;
    requesterId: Id<"users">;
    requesteeId: Id<"users">;
    status: string;
    createdAt: number;
    updatedAt?: number;
    direction: string;
    friendId: Id<"users">;
  };
  profile: {
    _id: Id<"users">;
    userId: Id<"users">;
    username: string;
    name?: string;
    profileImage?: string;
    bio?: string;
  };
}

export interface ProfileSocialData {
  friends: (FriendWithProfile | null)[];
  hasMore: boolean;
  cursor: string | null;
}

export interface ProfileFollowingData {
  following: (FollowingWithPost | null)[];
  hasMore: boolean;
  cursor: Id<"following"> | null;
}

export interface ActivityItem {
  type: "comment" | "retweet";
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  _id: string;
}

export interface ProfileActivityData {
  activities: ActivityItem[];
  entryDetails: Record<string, EntriesRSSEntry>;
  hasMore: boolean;
  cursor: string | null;
}

export interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export interface ProfileMetadata {
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    images: string[];
  };
  twitter: {
    card: string;
    title: string;
    description: string;
  };
}

// JSON-LD Schema types
export interface PersonSchema {
  "@type": "Person";
  "@id": string;
  name: string;
  alternateName: string;
  url: string;
  identifier: Id<"users">;
  interactionStatistic: InteractionCounter[];
  image?: string;
  description?: string;
}

export interface InteractionCounter {
  "@type": "InteractionCounter";
  interactionType: string;
  userInteractionCount: number;
}

export interface BreadcrumbListItem {
  "@type": "ListItem";
  position: number;
  name: string;
  item: string;
}

export interface BreadcrumbList {
  "@type": "BreadcrumbList";
  "@id": string;
  itemListElement: BreadcrumbListItem[];
}

export interface ProfilePageSchema {
  "@type": "ProfilePage";
  "@id": string;
  name: string;
  url: string;
  mainEntity: { "@id": string };
  isPartOf: { "@id": string };
  breadcrumb: { "@id": string };
  about: { "@id": string };
}

export interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": (BreadcrumbList | PersonSchema | ProfilePageSchema)[];
}

// Profile transformation types
export interface TransformedProfileData {
  normalizedUsername: string;
  displayName: string;
  friendshipStatus: FriendshipStatus | null;
  initialFriends: ProfileSocialData;
  initialFollowing: ProfileFollowingData;
  jsonLd: string;
  socialCounts: {
    friendCount: number;
    followingCount: number;
  };
}

// Social counts type
export interface SocialCounts {
  friendCount: number;
  followingCount: number;
}

// Profile tabs types
export interface ProfileTabsState {
  selectedTabIndex: number;
  likesData: ProfileFeedData | null;
  likesStatus: 'idle' | 'loading' | 'loaded' | 'error';
  likesError: Error | null;
  isPending: boolean;
}

export interface ProfileFeedData {
  activities: ActivityItem[];
  totalCount: number;
  hasMore: boolean;
  entryDetails: Record<string, EntriesRSSEntry>;
}

export interface ProfileTabsActions {
  setSelectedTabIndex: (index: number) => void;
  setLikesData: (data: ProfileFeedData | null) => void;
  setLikesStatus: (status: 'idle' | 'loading' | 'loaded' | 'error') => void;
  setLikesError: (error: Error | null) => void;
  setIsPending: (pending: boolean) => void;
  resetLikes: () => void;
  reset: () => void;
}

// UserProfileTabs component types
export interface UserProfileTabsProps {
  userId: Id<"users">;
  username: string;
  name: string;
  profileImage?: string | null;
  activityData: ProfileFeedData | null;
  likesData?: ProfileFeedData | null;
  pageSize?: number;
}

export interface UserActivityFeedProps {
  userId: Id<"users">;
  username: string;
  name: string;
  profileImage?: string | null;
  initialData: ProfileFeedData;
  pageSize: number;
  apiEndpoint: string;
}

export interface UserLikesFeedProps {
  userId: Id<"users">;
  initialData: {
    activities: UserLikesActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, UserLikesRSSEntry>;
    entryMetrics?: Record<string, InteractionStates>;
  } | null;
  pageSize?: number;
  isActive?: boolean;
}

export interface ActivityTabContentProps {
  userId: Id<"users">;
  username: string;
  name: string;
  profileImage?: string | null;
  activityData: ProfileFeedData | null;
  pageSize: number;
}

export interface LikesTabContentProps {
  userId: Id<"users">;
  likesData: ProfileFeedData | null;
  pageSize: number;
  isLoading: boolean;
  error: Error | null;
}

// Custom hook types
export interface UseProfileTabsProps {
  userId: Id<"users">;
  pageSize: number;
  initialLikesData?: ProfileFeedData | null;
}

// UserActivityFeed types
export interface ActivityFeedItem {
  type: "comment" | "retweet";
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  _id: string | Id<"comments">;
}

export interface ActivityFeedRSSEntry {
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

export interface ActivityFeedComment {
  _id: Id<"comments">;
  _creationTime: number;
  userId: Id<"users">;
  username: string;
  content: string;
  parentId?: Id<"comments">;
  entryGuid: string;
  feedUrl: string;
  createdAt: number;
  user?: {
    name?: string;
    username?: string;
    profileImage?: string;
  } | null;
}

export interface ActivityFeedInteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

export interface UserActivityFeedComponentProps {
  userId: Id<"users">;
  username: string;
  name: string;
  profileImage?: string | null;
  initialData: {
    activities: ActivityFeedItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, ActivityFeedRSSEntry>;
    entryMetrics?: Record<string, ActivityFeedInteractionStates>;
  } | null;
  pageSize?: number;
  apiEndpoint?: string;
  isActive?: boolean;
}

export interface ActivityFeedGroupedActivity {
  entryGuid: string;
  firstActivity: ActivityFeedItem;
  comments: ActivityFeedItem[];
  hasMultipleComments: boolean;
  type: string;
}

export interface ActivityFeedGroupRendererProps {
  group: ActivityFeedGroupedActivity;
  entryDetails: Record<string, ActivityFeedRSSEntry>;
  username: string;
  name: string;
  profileImage?: string | null;
  userId: Id<"users">;
  getEntryMetrics: (entryGuid: string) => ActivityFeedInteractionStates;
  handleOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  currentTrack: { src: string | null } | null;
  playTrack: (src: string, title: string, image?: string) => void;
}

export interface ActivityFeedState {
  activities: ActivityFeedItem[];
  isLoading: boolean;
  hasMore: boolean;
  entryDetails: Record<string, ActivityFeedRSSEntry>;
  currentSkip: number;
  isInitialLoad: boolean;
}

export type ActivityFeedAction =
  | { type: 'INITIAL_LOAD'; payload: { activities: ActivityFeedItem[], entryDetails: Record<string, ActivityFeedRSSEntry>, hasMore: boolean } }
  | { type: 'LOAD_MORE_START' }
  | { type: 'LOAD_MORE_SUCCESS'; payload: { activities: ActivityFeedItem[], entryDetails: Record<string, ActivityFeedRSSEntry>, hasMore: boolean } }
  | { type: 'LOAD_MORE_FAILURE' }
  | { type: 'SET_INITIAL_LOAD_COMPLETE' };

export interface ActivityDescriptionProps {
  item: ActivityFeedItem;
  username: string;
  name: string;
  profileImage?: string | null;
  timestamp?: string;
  userId?: Id<"users">;
}

// User Likes Feed Types
export interface UserLikesActivityItem {
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  _id: string;
}

export interface UserLikesRSSEntry {
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

// Post page types for podcast/newsletter post-slug pages
export interface PostPageProps {
  params: {
    postSlug: string;
  };
}

export interface PostWithFollowerCount {
  _id: Id<"posts">;
  _creationTime: number;
  title: string;
  postSlug: string;
  category: string;
  categorySlug: string;
  body: string;
  featuredImg?: string;
  mediaType: string;
  isFeatured?: boolean;
  publishedAt?: number;
  feedUrl: string;
  isFollowing?: boolean;
  isAuthenticated?: boolean;
  verified?: boolean;
  followerCount: number;
  relatedPosts?: RelatedPost[];
}

export interface RelatedPost {
  _id: Id<"posts">;
  title: string;
  featuredImg?: string;
  postSlug: string;
  categorySlug: string;
  feedUrl: string;
}

export interface PostFollowState {
  isAuthenticated: boolean;
  isFollowing: boolean;
}

export interface PostPageData {
  post: PostWithFollowerCount;
  rssData: NonNullable<Awaited<ReturnType<typeof import("@/components/postpage/RSSFeed").getInitialEntries>>> | null;
  followState: PostFollowState;
  relatedFollowStates: Record<string, PostFollowState>;
}

// Post search types
export interface PostSearchState {
  searchQuery: string;
}

export interface PostSearchActions {
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

// Post page client component props
export interface PostPageClientScopeProps {
  mediaType?: string;
  postTitle: string;
  feedUrl: string;
  rssData: NonNullable<Awaited<ReturnType<typeof import("@/components/postpage/RSSFeed").getInitialEntries>>> | null;
  featuredImg?: string;
  verified?: boolean;
}

export interface PostTabsWrapperWithSearchProps {
  postTitle: string;
  feedUrl: string;
  rssData: NonNullable<Awaited<ReturnType<typeof import("@/components/postpage/RSSFeed").getInitialEntries>>> | null;
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}

export interface SearchRSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  searchQuery: string;
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}

export interface PostContentProps {
  post: PostWithFollowerCount;
  followState: PostFollowState;
  rssData: NonNullable<Awaited<ReturnType<typeof import("@/components/postpage/RSSFeed").getInitialEntries>>> | null;
}

// Phase 5: Custom Hook Types for Production Optimization
export interface UsePostSearchHeaderProps {
  title: string;
  mediaType?: string;
}

export interface UsePostSearchHeaderReturn {
  isSearching: boolean;
  localSearchValue: string;
  displayText: string;
  searchPlaceholder: string;
  toggleSearch: () => void;
  handleSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface UsePostHeaderUserMenuReturn {
  shouldShowUserMenu: boolean;
  userMenuProps: {
    initialDisplayName: string;
    initialProfileImage: string | undefined;
    isBoarded: boolean;
    pendingFriendRequestCount: number;
  };
  isAuthenticated: boolean;
}

export interface SearchEmptyStateProps {
  message: string;
  suggestion: string;
}

export type SearchRenderState = 'loading' | 'empty' | 'results';

export interface UseSearchFeedUIReturn {
  renderState: SearchRenderState;
  emptyStateProps: SearchEmptyStateProps;
}

// Post search results type (for search API responses)
export interface PostSearchRSSData {
  entries: PostPageRSSEntryWithData[];
  totalEntries: number;
  hasMore: boolean;
}

export interface PostPageRSSEntryWithData {
  entry: PostPageRSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
  postMetadata?: {
    postTitle: string;
    feedUrl: string;
    featuredImg?: string;
    mediaType?: string;
    verified?: boolean;
  };
}

export interface PostPageRSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  image?: string;
  feedUrl: string;
  mediaType?: string;
}

// Newsletter page types (centralized from app/newsletters/[postSlug]/)
export interface NewsletterPageProps {
  params: {
    postSlug: string;
  };
}

export interface NewsletterPost extends Doc<"posts"> {
  followerCount: number;
  relatedPosts?: Array<{
    _id: Id<"posts">;
    title: string;
    featuredImg?: string;
    postSlug: string;
    categorySlug: string;
    feedUrl: string;
  }>;
}

export interface NewsletterPageData {
  post: NewsletterPost;
  rssData: NonNullable<Awaited<ReturnType<typeof import("@/components/postpage/RSSFeed").getInitialEntries>>> | null;
  followState: {
    isAuthenticated: boolean;
    isFollowing: boolean;
  };
  relatedFollowStates: {
    [postId: string]: {
      isAuthenticated: boolean;
      isFollowing: boolean;
    };
  };
}

export interface NewsletterRSSEntryWithData {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
}

export interface NewsletterPostPageClientScopeProps {
  mediaType?: string;
  postTitle: string;
  feedUrl: string;
  rssData: {
    entries: NewsletterRSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null;
  featuredImg?: string;
  verified?: boolean;
}

export interface NewsletterPostTabsWrapperWithSearchProps {
  postTitle: string;
  feedUrl: string;
  rssData: {
    entries: NewsletterRSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null;
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}

export interface NewsletterPostContentProps {
  post: NewsletterPost;
  followState: { isAuthenticated: boolean; isFollowing: boolean };
  rssData: NonNullable<Awaited<ReturnType<typeof import("@/components/postpage/RSSFeed").getInitialEntries>>> | null;
}

// RSS Feed Component Types (Phase 1: Centralized State Management)
export interface RSSFeedEntry {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
    bookmarks?: { isBookmarked: boolean };
  };
  postMetadata?: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
  };
}

export interface RSSFeedLoadingState {
  isLoading: boolean;
  isInitialRender: boolean;
  fetchError: Error | null;
}

export interface RSSFeedPaginationState {
  currentPage: number;
  hasMore: boolean;
  totalEntries: number;
}

export interface RSSFeedCommentDrawerState {
  isOpen: boolean;
  selectedEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
}

export interface RSSFeedUIState {
  isActive: boolean;
  isSearchMode: boolean;
}

// Main RSS Feed Store State
export interface RSSFeedState {
  // Core data
  entries: RSSFeedEntry[];
  
  // Pagination state
  pagination: RSSFeedPaginationState;
  
  // Loading state
  loading: RSSFeedLoadingState;
  
  // Comment drawer state
  commentDrawer: RSSFeedCommentDrawerState;
  
  // UI state
  ui: RSSFeedUIState;
  
  // Feed metadata
  feedMetadata: {
    postTitle: string;
    feedUrl: string;
    featuredImg?: string;
    mediaType?: string;
    verified?: boolean;
    pageSize: number;
  };
}

// RSS Feed Store Actions
export interface RSSFeedActions {
  // Entry management
  setEntries: (entries: RSSFeedEntry[]) => void;
  addEntries: (entries: RSSFeedEntry[]) => void;
  updateEntryMetrics: (entryGuid: string, metrics: RSSFeedEntry['initialData']) => void;
  
  // Pagination actions
  setCurrentPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  setTotalEntries: (total: number) => void;
  
  // Loading actions
  setLoading: (isLoading: boolean) => void;
  setInitialRender: (isInitialRender: boolean) => void;
  setFetchError: (error: Error | null) => void;
  
  // Comment drawer actions
  openCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  closeCommentDrawer: () => void;
  
  // UI actions
  setActive: (isActive: boolean) => void;
  setSearchMode: (isSearchMode: boolean) => void;
  
  // Feed metadata actions
  setFeedMetadata: (metadata: Partial<RSSFeedState['feedMetadata']>) => void;
  
  // Utility actions
  reset: () => void;
  initialize: (initialData: {
    entries: RSSFeedEntry[];
    totalEntries: number;
    hasMore: boolean;
    postTitle: string;
    feedUrl: string;
    featuredImg?: string;
    mediaType?: string;
    verified?: boolean;
    pageSize?: number;
  }) => void;
}

// Combined RSS Feed Store Interface
export interface RSSFeedStore extends RSSFeedState, RSSFeedActions {}

// RSS Feed Component Props
export interface RSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  initialData: {
    entries: RSSFeedEntry[];
    totalEntries: number;
    hasMore: boolean;
  };
  pageSize?: number;
  featuredImg?: string;
  mediaType?: string;
  isActive?: boolean;
  verified?: boolean;
  customLoadMore?: () => Promise<void>;
  isSearchMode?: boolean;
  externalIsLoading?: boolean;
}

export interface RSSEntryProps {
  entryWithData: RSSFeedEntry;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
  verified?: boolean;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}

export interface FeedContentProps {
  entries: RSSFeedEntry[];
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isPending: boolean;
  loadMore: () => Promise<void>;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
  verified?: boolean;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  isInitialRender: boolean;
}

// RSS Feed API Response Types
export interface RSSFeedAPIResponse {
  entries: Array<{
    entry: RSSItem;
    initialData?: RSSFeedEntry['initialData'];
  }>;
  hasMore: boolean;
  totalEntries?: number;
}

// RSS Feed Hook Return Types
export interface UseRSSFeedPaginationReturn {
  loadMoreEntries: () => Promise<void>;
  isLoading: boolean;
  hasMore: boolean;
  currentPage: number;
  error: Error | null;
}

export interface UseRSSFeedMetricsReturn {
  entryMetricsMap: Record<string, RSSFeedEntry['initialData']> | null;
  isMetricsLoading: boolean;
  enhancedEntries: RSSFeedEntry[];
}

export interface UseRSSFeedUIReturn {
  checkContentHeight: () => void;
  handleCommentDrawer: {
    open: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
    close: () => void;
    isOpen: boolean;
    selectedEntry: RSSFeedCommentDrawerState['selectedEntry'];
  };
}

// Additional Component Props Interfaces for Production Readiness

// PostLayoutManager Props Interface
export interface PostLayoutManagerProps {
  children: React.ReactNode;
  post: {
    _id: Id<"posts">;
    title: string;
    category: string;
    body: string;
    featuredImg?: string;
    feedUrl: string;
    categorySlug: string;
    relatedPosts?: Array<{
      _id: Id<"posts">;
      title: string;
      featuredImg?: string;
      postSlug: string;
      categorySlug: string;
      feedUrl: string;
    }>;
  };
  className?: string;
  relatedFollowStates: {
    [postId: string]: {
      isAuthenticated: boolean;
      isFollowing: boolean;
    };
  };
}

// Search Input Component Props Interface
export interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  onClose: () => void;
}

// Header Navigation Component Props Interface
export interface HeaderNavigationProps {
  displayText: string;
  title: string;
  onSearchToggle: () => void;
  isAuthenticated: boolean;
}

// Newsletter-specific SearchRSSFeedClient Props Interface
export interface NewsletterSearchRSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  searchQuery: string;
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}

// Default PostTabsWrapper Props Interface
export interface DefaultPostTabsWrapperProps {
  postTitle: string;
  feedUrl: string;
  rssData: any;
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}

// Search Empty State Component Props Interface
export interface SearchEmptyStateComponentProps {
  message: string;
  suggestion: string;
}

// PostSearchProvider Props Interface
export interface PostSearchProviderProps {
  children: React.ReactNode;
}

// ===================================================================
// RSS ENTRIES DISPLAY TYPES - Phase 1: Type Centralization
// ===================================================================

// Core RSS Entries Display Entry Interface
export interface RSSEntriesDisplayEntry {
  entry: RSSItem;
  initialData: {
    likes: {
      isLiked: boolean;
      count: number;
    };
    comments: {
      count: number;
    };
    retweets?: {
      isRetweeted: boolean;
      count: number;
    };
    bookmarks?: {
      isBookmarked: boolean;
    };
  };
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    categorySlug?: string;
    postSlug?: string;
    verified?: boolean;
  };
}

// RSS Entries Display State Interfaces
export interface RSSEntriesDisplayPaginationState {
  currentPage: number;
  hasMore: boolean;
  totalEntries: number;
}

export interface RSSEntriesDisplayLoadingState {
  isLoading: boolean;
  isRefreshing: boolean;
  hasRefreshed: boolean;
  fetchError: Error | null;
  refreshError: string | null;
}

export interface RSSEntriesDisplayUIState {
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
  showNotification: boolean;
  notificationCount: number;
  notificationImages: string[];
  isActive: boolean;
}

export interface RSSEntriesDisplayMetadataState {
  postTitles: string[];
  feedUrls: string[];
  mediaTypes: string[];
  feedMetadataCache: Record<string, RSSEntriesDisplayEntry['postMetadata']>;
  newEntries: RSSEntriesDisplayEntry[];
}

// Main RSS Entries Display Store State
export interface RSSEntriesDisplayState {
  // Core data
  entries: RSSEntriesDisplayEntry[];
  
  // Pagination state
  pagination: RSSEntriesDisplayPaginationState;
  
  // Loading state
  loading: RSSEntriesDisplayLoadingState;
  
  // UI state
  ui: RSSEntriesDisplayUIState;
  
  // Metadata state
  metadata: RSSEntriesDisplayMetadataState;
  
  // Initialization flag
  hasInitialized: boolean;
}

// RSS Entries Display Store Actions
export interface RSSEntriesDisplayActions {
  // Entry management
  setEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  addEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  prependEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  updateEntryMetrics: (entryGuid: string, metrics: RSSEntriesDisplayEntry['initialData']) => void;
  
  // Pagination actions
  setCurrentPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  setTotalEntries: (total: number) => void;
  
  // Loading actions
  setLoading: (isLoading: boolean) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setHasRefreshed: (hasRefreshed: boolean) => void;
  setFetchError: (error: Error | null) => void;
  setRefreshError: (error: string | null) => void;
  
  // UI actions
  setActive: (isActive: boolean) => void;
  openCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  closeCommentDrawer: () => void;
  setNotification: (show: boolean, count?: number, images?: string[]) => void;
  
  // Metadata actions
  setPostTitles: (titles: string[]) => void;
  setFeedUrls: (urls: string[]) => void;
  setMediaTypes: (types: string[]) => void;
  updateFeedMetadataCache: (feedUrl: string, metadata: RSSEntriesDisplayEntry['postMetadata']) => void;
  setNewEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  clearNewEntries: () => void;
  
  // Utility actions
  reset: () => void;
  initialize: (initialData: {
    entries: RSSEntriesDisplayEntry[];
    totalEntries: number;
    hasMore: boolean;
    postTitles: string[];
    feedUrls: string[];
    mediaTypes: string[];
  }) => void;
}

// Combined RSS Entries Display Store Interface
export interface RSSEntriesDisplayStore extends RSSEntriesDisplayState, RSSEntriesDisplayActions {}

// RSS Entries Display Component Props
export interface RSSEntriesDisplayClientProps {
  initialData: {
    entries: RSSEntriesDisplayEntry[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
  };
  pageSize?: number;
  isActive?: boolean;
}

export interface RSSEntriesDisplayServerProps {
  skipRefresh?: boolean;
}

// RSS Entries Display Entry Component Props
export interface RSSEntriesDisplayEntryProps {
  entryWithData: RSSEntriesDisplayEntry;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}

// RSS Entries Display Content Component Props
export interface RSSEntriesDisplayContentProps {
  paginatedEntries: RSSEntriesDisplayEntry[];
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isPending: boolean;
  loadMore: () => void;
  entryMetrics: Record<string, RSSEntriesDisplayEntry['initialData']> | null;
  postMetadata?: Map<string, RSSEntriesDisplayEntry['postMetadata']>;
  initialData: {
    entries: RSSEntriesDisplayEntry[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
    feedMetadataCache: Record<string, RSSEntriesDisplayEntry['postMetadata']>;
  };
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  isInitializing?: boolean;
  pageSize: number;
}

// RSS Entries Display API Response Types
export interface RSSEntriesDisplayRefreshResponse {
  success: boolean;
  error?: string;
  refreshedAny?: boolean;
  entries?: RSSEntriesDisplayEntry[];
  postTitles?: string[];
  totalEntries?: number;
  hasMore?: boolean;
}

export interface RSSEntriesDisplayPaginationResponse {
  entries: RSSItem[];
  hasMore: boolean;
  totalEntries?: number;
  postTitles?: string[];
}

// RSS Entries Display Hook Return Types
export interface UseRSSEntriesDisplayPaginationReturn {
  loadMoreEntries: () => Promise<void>;
  isLoading: boolean;
  hasMore: boolean;
  currentPage: number;
  error: Error | null;
}

export interface UseRSSEntriesDisplayMetricsReturn {
  entryMetricsMap: Record<string, RSSEntriesDisplayEntry['initialData']> | null;
  isMetricsLoading: boolean;
  enhancedEntries: RSSEntriesDisplayEntry[];
}

export interface UseRSSEntriesDisplayRefreshReturn {
  triggerRefresh: () => Promise<void>;
  isRefreshing: boolean;
  refreshError: string | null;
  hasRefreshed: boolean;
}

export interface UseRSSEntriesDisplayUIReturn {
  handleCommentDrawer: {
    open: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
    close: () => void;
    isOpen: boolean;
    selectedEntry: RSSEntriesDisplayUIState['selectedCommentEntry'];
  };
  notification: {
    show: boolean;
    count: number;
    images: string[];
  };
  setNotification: (show: boolean, count?: number, images?: string[]) => void;
}

// RSS Entries Display Hook Props
export interface UseRSSEntriesDisplayPaginationProps {
  isActive: boolean;
  pageSize: number;
  initialData: RSSEntriesDisplayClientProps['initialData'];
}

export interface UseRSSEntriesDisplayMetricsProps {
  isActive: boolean;
}

export interface UseRSSEntriesDisplayRefreshProps {
  initialData: RSSEntriesDisplayClientProps['initialData'];
  isActive: boolean;
}

export interface UseRSSEntriesDisplayUIProps {
  // No props needed - uses store state
}

// ===================================================================
// FEED TABS CONTAINER TYPES - Phase 1.1 Type System Overhaul
// ===================================================================

// Core RSS Item interface for feed tabs (centralized from scattered definitions)
export interface FeedTabsRSSItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  description?: string;
  image?: string;
  mediaType?: string;
  feedUrl: string;
  feedTitle?: string;
}

// Post metadata interface for feed tabs
export interface FeedTabsPostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
  verified?: boolean;
}

// RSS Entry with interaction data for feed tabs
export interface FeedTabsRSSEntryWithData {
  entry: FeedTabsRSSItem;
  initialData: {
    likes: {
      isLiked: boolean;
      count: number;
    };
    comments: {
      count: number;
    };
    retweets?: {
      isRetweeted: boolean;
      count: number;
    };
    bookmarks?: {
      isBookmarked: boolean;
    };
  };
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    categorySlug?: string;
    postSlug?: string;
    verified?: boolean;
  };
}

// Featured entry interface (imported from featured_kv)
export interface FeedTabsFeaturedEntry {
  _id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  image?: string;
  feedUrl: string;
  mediaType?: string;
  isFeatured: boolean;
  featuredAt: number;
}

// Featured entry with interaction data
export interface FeedTabsFeaturedEntryWithData {
  entry: FeedTabsFeaturedEntry;
  initialData: {
    likes: {
      isLiked: boolean;
      count: number;
    };
    comments: {
      count: number;
    };
    retweets?: {
      isRetweeted: boolean;
      count: number;
    };
    bookmarks?: {
      isBookmarked: boolean;
    };
  };
  postMetadata: FeedTabsPostMetadata;
}

// RSS data structure for feed tabs
export interface FeedTabsRSSData {
  entries: FeedTabsRSSEntryWithData[];
  totalEntries: number;
  hasMore: boolean;
  postTitles?: string[];
  feedUrls?: string[];
  mediaTypes?: string[];
}

// Featured data structure for feed tabs
export interface FeedTabsFeaturedData {
  entries: FeedTabsFeaturedEntryWithData[];
  totalEntries: number;
}

// Loading state management for feed tabs
export interface FeedTabsLoadingState {
  isRSSLoading: boolean;
  isFeaturedLoading: boolean;
}

// Error state management for feed tabs
export interface FeedTabsErrorState {
  rssError: string | null;
  featuredError: string | null;
}

// Fetch progress tracking for feed tabs
export interface FeedTabsFetchProgress {
  rssFetchInProgress: boolean;
  featuredFetchInProgress: boolean;
}

// Authentication state for feed tabs
export interface FeedTabsAuthState {
  isAuthenticated: boolean;
  displayName: string;
  isBoarded: boolean;
  profileImage?: string | null;
  pendingFriendRequestCount: number;
}

// Tab configuration interface
export interface FeedTabsTabConfig {
  id: string;
  label: string;
  component: React.ComponentType;
}

// Main feed tabs state interface
export interface FeedTabsState {
  // Active tab management
  activeTabIndex: number;
  
  // Data state
  rssData: FeedTabsRSSData | null;
  featuredData: FeedTabsFeaturedData | null;
  
  // Loading state
  loading: FeedTabsLoadingState;
  
  // Error state
  errors: FeedTabsErrorState;
  
  // Fetch progress
  fetchProgress: FeedTabsFetchProgress;
  
  // Authentication state
  auth: FeedTabsAuthState;
  
  // Configuration
  pageSize: number;
  
  // Initialization flag
  hasInitialized: boolean;
}

// Feed tabs actions interface
export interface FeedTabsActions {
  // Tab management actions
  setActiveTabIndex: (index: number) => void;
  
  // Data management actions
  setRSSData: (data: FeedTabsRSSData | null) => void;
  setFeaturedData: (data: FeedTabsFeaturedData | null) => void;
  
  // Loading state actions
  setRSSLoading: (loading: boolean) => void;
  setFeaturedLoading: (loading: boolean) => void;
  
  // Error management actions
  setRSSError: (error: string | null) => void;
  setFeaturedError: (error: string | null) => void;
  
  // Fetch progress actions
  setRSSFetchInProgress: (inProgress: boolean) => void;
  setFeaturedFetchInProgress: (inProgress: boolean) => void;
  
  // Authentication actions
  setAuthState: (auth: Partial<FeedTabsAuthState>) => void;
  
  // Configuration actions
  setPageSize: (size: number) => void;
  
  // Initialization actions
  setInitialized: (initialized: boolean) => void;
  
  // Utility actions
  reset: () => void;
  initialize: (initialData: {
    rssData?: FeedTabsRSSData | null;
    featuredData?: FeedTabsFeaturedData | null;
    pageSize?: number;
    auth?: Partial<FeedTabsAuthState>;
  }) => void;
}

// Combined store interface
export interface FeedTabsStore extends FeedTabsState, FeedTabsActions {}

// Component props interfaces
export interface FeedTabsContainerProps {
  initialData: FeedTabsRSSData | null;
  featuredData?: FeedTabsFeaturedData | null;
  pageSize?: number;
}

export interface FeedTabsContainerClientWrapperProps {
  initialData: FeedTabsRSSData | null;
  featuredData?: FeedTabsFeaturedData | null;
  pageSize: number;
}

// Custom hooks props interfaces
export interface UseFeedTabsDataFetchingProps {
  isAuthenticated: boolean;
  router: any; // Next.js router type
}

export interface UseFeedTabsManagementProps {
  isAuthenticated: boolean;
  router: any; // Next.js router type
}

export interface UseFeedTabsAuthProps {
  isAuthenticated: boolean;
}

export interface UseFeedTabsUIProps {
  // No props needed - uses store state
}

// Custom hooks return interfaces
export interface UseFeedTabsDataFetchingReturn {
  fetchRSSData: () => Promise<void>;
  fetchFeaturedData: () => Promise<void>;
  cleanup: () => void;
}

export interface UseFeedTabsManagementReturn {
  handleTabChange: (index: number) => void;
  shouldFetchFeaturedData: () => boolean;
  shouldFetchRSSData: () => boolean;
  shouldRedirectToSignIn: () => boolean;
}

export interface UseFeedTabsAuthReturn {
  handleAuthChange: () => void;
  getUserMenuProps: () => {
    initialDisplayName: string;
    initialProfileImage: string | null;
    isBoarded: boolean;
    pendingFriendRequestCount: number;
  } | null;
  shouldShowSignInButton: () => boolean;
  shouldShowUserMenu: () => boolean;
  authState: FeedTabsAuthState;
}

export interface UseFeedTabsUIReturn {
  tabs: FeedTabsTabConfig[];
  renderErrorState: (error: string, onRetry: () => void) => React.ReactNode;
  renderLoadingState: () => React.ReactNode;
  getCurrentTab: () => FeedTabsTabConfig;
  hasCurrentTabError: () => boolean;
  isCurrentTabLoading: () => boolean;
}

// API response interfaces
export interface FeedTabsRSSAPIResponse {
  entries: FeedTabsRSSEntryWithData[];
  totalEntries: number;
  hasMore: boolean;
  postTitles?: string[];
  feedUrls?: string[];
  mediaTypes?: string[];
}

export interface FeedTabsFeaturedAPIResponse {
  entries: FeedTabsFeaturedEntryWithData[];
  totalEntries: number;
}

// Error boundary interfaces
export interface FeedTabsErrorBoundaryProps {
  children: React.ReactNode;
}

export interface FeedTabsErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

// Store provider interfaces
export interface FeedTabsStoreProviderProps {
  children: React.ReactNode;
}

// Memory management interfaces
export interface FeedTabsMemoryManagementReturn {
  cleanup: () => void;
  createManagedTimeout: (callback: () => void, delay: number) => NodeJS.Timeout;
  clearManagedTimeout: (timeout: NodeJS.Timeout) => void;
}

// Performance monitoring interfaces
export interface FeedTabsPerformanceMetrics {
  tabSwitchTime: number;
  dataFetchTime: number;
  renderTime: number;
  memoryUsage: number;
}

// Accessibility interfaces
export interface FeedTabsAccessibilityProps {
  'aria-label'?: string;
  'aria-describedby'?: string;
  role?: string;
}

// Type guards for runtime type checking
export type FeedTabsDataType = 'rss' | 'featured';

export interface FeedTabsTypeGuards {
  isRSSData: (data: unknown) => data is FeedTabsRSSData;
  isFeaturedData: (data: unknown) => data is FeedTabsFeaturedData;
  isRSSEntry: (entry: unknown) => entry is FeedTabsRSSEntryWithData;
  isFeaturedEntry: (entry: unknown) => entry is FeedTabsFeaturedEntryWithData;
}

// Configuration constants interface
export interface FeedTabsConfig {
  DEFAULT_PAGE_SIZE: number;
  MAX_RETRY_ATTEMPTS: number;
  FETCH_TIMEOUT: number;
  CACHE_TTL: number;
  SKELETON_COUNT: number;
}

// Event interfaces for analytics and monitoring
export interface FeedTabsEvent {
  type: 'tab_change' | 'data_fetch' | 'error' | 'performance';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface FeedTabsEventHandler {
  (event: FeedTabsEvent): void;
}

// Validation interfaces
export interface FeedTabsValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FeedTabsValidator {
  validateRSSData: (data: unknown) => FeedTabsValidationResult;
  validateFeaturedData: (data: unknown) => FeedTabsValidationResult;
  validateProps: (props: unknown) => FeedTabsValidationResult;
}

// ===================================================================
// END FEED TABS CONTAINER TYPES
// =================================================================== 