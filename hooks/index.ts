// RSS Feed Custom Hooks
export { useRSSFeedPaginationHook } from './useRSSFeedPagination';
export { useRSSFeedMetrics } from './useRSSFeedMetrics';
export { useRSSFeedUI } from './useRSSFeedUI';

// Notifications Custom Hooks
export { useNotificationsVirtualization } from './useNotificationsVirtualization';

// Audio Player Hooks
export { useAudioControls } from './useAudioControls';
export { useAudioLifecycle } from './useAudioLifecycle';
export { useMediaSession } from './useMediaSession';

// Generic/Utility Hooks
export { useMountedRef } from './useMountedRef';

// New Hook - removed usePendingFriendRequests since we now use reactive queries directly in SidebarProvider 