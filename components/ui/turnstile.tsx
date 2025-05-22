'use client';

import { useEffect, useRef } from 'react';

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  interface Window {
    turnstile?: any;
  }
}

/**
 * Simple Cloudflare Turnstile wrapper.
 *
 * Usage:
 *   <Turnstile />
 *
 * The component will:
 * 1. Load the Turnstile script once per page load.
 * 2. Render an explicit widget inside the returned div.
 * 3. Automatically place the hidden `cf-turnstile-response` input inside the surrounding `<form>`
 *    so it is included in the FormData when the form is submitted.
 */
export function Turnstile({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  options = {},
}: {
  /** Public site-key provided by Cloudflare (NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  siteKey?: string;
  /** Additional Turnstile render options. */
  options?: Record<string, unknown>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey) {
      // eslint-disable-next-line no-console
      console.warn('Turnstile site-key is missing. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in your env.');
      return;
    }

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      // Avoid rendering twice into the same element
      if (containerRef.current.dataset.rendered === 'true') return;

      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        ...options,
      });

      containerRef.current.dataset.rendered = 'true';
    };

    // If the Turnstile script is already present just render immediately.
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Otherwise inject the Turnstile script once and render on load.
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    if (existingScript) {
      // Someone else added it, just wait for it to load.
      existingScript.addEventListener('load', renderWidget);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-turnstile', 'true');
    script.addEventListener('load', renderWidget);
    document.body.appendChild(script);

    return () => {
      script.removeEventListener('load', renderWidget);
    };
  }, [siteKey, options]);

  // The Turnstile widget will be rendered inside this container.
  return <div ref={containerRef} className="cf-turnstile mb-4" />;
} 