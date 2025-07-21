// cloudflare-loader.ts
import type { LoaderProps } from './types';

export default function cloudflareLoader({ src, width, quality }: LoaderProps) {
  /** 1. In development (`next dev`) keep <Image> as a plain <img>. */
  if (process.env.NODE_ENV === 'development') {
    return src;
  }

  /** 2. Unwrap ONE existing Cloudflare-resize layer, if present. */
  if (src.includes('/cdn-cgi/image/')) {
    const u = new URL(src);
    u.pathname = u.pathname.replace(/^\/cdn-cgi\/image\/[^/]+/, '');
    src = u.toString();
  }

  /** 3. Add your own resize / optimisation parameters. */
  
  // Handle specific image sizes based on the sizes used in the app
  let optimalWidth: number;
  
  // Common image sizes in the application:
  if (width <= 16) {
    optimalWidth = 16;       // Tiny icons
  } else if (width <= 36) {
    optimalWidth = 36;       // Small icons
  } else if (width <= 40) {
    optimalWidth = 40;       // Small profile pics
  } else if (width <= 48) {
    optimalWidth = 48;       // Avatar size (w-12)
  } else if (width <= 56) {
    optimalWidth = 56;       // Persistent audio player
  } else if (width <= 64) {
    optimalWidth = 64;       // Medium icons/avatars
  } else if (width <= 82) {
    optimalWidth = 82;       // User profile cards
  } else if (width <= 96) {
    optimalWidth = 96;       // Larger avatars
  } else {
    optimalWidth = 516;      // Card images
  }
  
  // Create optimal image settings
  const opts = [
    `width=${optimalWidth}`,
    `quality=${quality ?? 85}`,
    'format=auto',
    'fit=scale-down',
    'metadata=none'
  ].join(',');

  /** 4. Return the single, final Cloudflare-resize URL. */
  return `/cdn-cgi/image/${opts}/${src}`;
}
