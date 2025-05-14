'use client';

import { useEffect } from 'react';

/**
 * BFCacheBlocker
 *
 * A zero‑cost client component that makes the **current page** ineligible for
 * the Back‑Forward Cache (BFCache) in every modern browser.
 *
 * ▸ Browsers based on Chromium **and** Gecko refuse to BFCache any document that
 *   registers an `unload` (or `beforeunload`) listener.
 * ▸ WebKit ignores the listener but we pair this with a `Cache‑Control: no-store`
 *   header (export `fetchCache = 'force-no-store'`) so Safari is also blocked.
 *
 * Drop <BFCacheBlocker /> once in the page or layout *after* adding the
 * `no-store` header export.
 */
export default function BFCacheBlocker() {
  useEffect(() => {
    // An inert handler—never called in Safari (page is cached) but its mere
    // presence is enough to disqualify Chrome/Firefox from entering BFCache.
    const noop = () => {};

    window.addEventListener('unload', noop);
    return () => window.removeEventListener('unload', noop);
  }, []);

  // Renders nothing.
  return null;
}
