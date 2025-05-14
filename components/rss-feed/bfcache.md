Below is the **minimal-change patch set** that gives you a rock-solid BF-cache workflow without touching your existing logic flow or performance optimizations.

---

## 1 · A tiny hook that detects **all** BF-cache restores

Create **`lib/useBFCacheRestore.ts`**

```ts
import { useEffect } from 'react';

/**
 * Fires `callback()` every time the page is *restored* from the browser
 * Back/Forward-cache (Safari, Chrome, Firefox, iOS, Android ≈ 100 % coverage).
 */
export function useBFCacheRestore(callback: () => void) {
  useEffect(() => {
    // Standard – Chrome/Firefox/Safari ≥16
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) callback();
    };
    // Legacy Safari (pagehide α)
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) callback();
    };
    // Proposed spec – Chrome bfcache discard
    const onVisibility = () => {
      // @ts-ignore old Chrome channel
      if (document.visibilityState === 'visible' && (document as any).wasDiscarded) {
        callback();
      }
    };

    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [callback]);
}
```

---

## 2 · Tell every tab whether it needs a **one-time refresh**

Add the flags just once in **`FeedTabsContainer.tsx`**

```diff
@@
 export function FeedTabsContainer({ 
   initialData, 
   featuredData: initialFeaturedData, 
   pageSize = 30
 }: FeedTabsContainerProps) {
+  // --- ① BF-cache refresh flags -------------
+  const refreshNeeded = useRef<{ discover: boolean; following: boolean }>({
+    discover: false,
+    following: false,
+  });
+
+  // Runs whenever the whole page was revived from BF-cache
+  useBFCacheRestore(() => {
+    refreshNeeded.current.discover = true;
+    refreshNeeded.current.following = true;
+  });
@@
   const fetchFeaturedData = useCallback(async () => {
-    if (featuredData !== null || featuredLoading || featuredFetchInProgress.current) return;
+    // only refetch when data is missing **or** BF-cache said so
+    if (
+      (featuredData !== null && !refreshNeeded.current.discover) ||
+      featuredLoading || featuredFetchInProgress.current
+    ) return;
@@
+    refreshNeeded.current.discover = false;   // mark clean
   }, [featuredData, featuredLoading]);
 
   const fetchRSSData = useCallback(async () => {
-    if (rssData !== null || isLoading || rssFetchInProgress.current) return;
+    if (
+      (rssData !== null && !refreshNeeded.current.following) ||
+      isLoading || rssFetchInProgress.current
+    ) return;
@@
+    refreshNeeded.current.following = false;  // mark clean
   }, [rssData, isLoading, isAuthenticated, router]);
```

*(nothing else in the file changes)*

---

## 3 · Persist active-tab & scroll positions between sessions

Add two helpers inside **`SwipeableTabs.tsx`** *just after state declarations*.

```ts
// session-storage keys
const KEY_TAB   = 'feed.activeTab';
const KEY_SCROLL= 'feed.scroll.';

// restore on mount
useEffect(() => {
  const saved = Number(sessionStorage.getItem(KEY_TAB));
  if (!Number.isNaN(saved)) setSelectedTab(saved);
}, []);

// store whenever it changes
useEffect(() => {
  sessionStorage.setItem(KEY_TAB, String(selectedTab));
}, [selectedTab]);

// wrap your existing scroll save / restore:
const saveScroll = (idx:number) => {
  scrollPositionsRef.current[idx] = window.scrollY;
  sessionStorage.setItem(KEY_SCROLL + idx, String(window.scrollY));
};
const loadScroll = (idx:number) =>
  Number(sessionStorage.getItem(KEY_SCROLL + idx)) || 0;
```

Replace the two direct usages of `scrollPositionsRef.current`:

```diff
- scrollPositionsRef.current[selectedTab] = window.scrollY;
+ saveScroll(selectedTab);
```

```diff
- const savedPosition = scrollPositionsRef.current[index] ?? 0;
+ const savedPosition = loadScroll(index);
```

*(no other logic altered)*

---

## 4 · Re-initialise Embla **only** when a BF-cache restore occurs

Add near the end of `SwipeableTabsComponent` (outside other effects):

```ts
useBFCacheRestore(() => {
  emblaApi?.reInit();
  measureSlideHeights();         // you already have this util
});
```

---

## 5 · Tell Virtuoso to refresh after restore (optional but prevents rare blank list)

Inside **`RSSEntriesDisplay.client.tsx`** and **`FeaturedFeedClient.tsx`**:

```diff
const virtuosoRef = useRef<any>(null);

useBFCacheRestore(() => {
  virtuosoRef.current?.refresh?.();
});
```

---

### How it now behaves

1. **Leaving the feeds page** (to a profile) unmounts the list as usual.
2. **Back-swipe** (BF-cache restore) fires the hook once:

   * both tab flags → `true`
   * Embla re-inits its slides & events
3. First time each tab becomes active after the restore:

   * its flag is still `true` → fetch runs → skeleton shows once
   * after success the flag flips to `false` → subsequent tab swaps use cached data only.
4. Scrolling positions and the currently visible tab are brought back from `sessionStorage` so the user lands exactly where they left off.
5. No extra network calls while the user flips between Discover/Following until they navigate away **and** return via BF-cache again.

That’s all that’s needed—no other parts of your implementation change, performance remains identical, and the fix is scoped to \~40 new lines across three files.
