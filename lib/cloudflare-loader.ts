// cloudflare-loader.ts
type LoaderProps = { src: string; width: number; quality?: number }

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

/**
 * Generate Open Graph optimized image URL using Cloudflare Image Resizing
 * Specifically for social media previews (1200x630 optimal dimensions)
 */
export function generateOpenGraphImageUrl(src: string, siteUrl: string): string {
  // In development, return the source as-is
  if (process.env.NODE_ENV === 'development') {
    return src;
  }

  // If it's already a Cloudflare-transformed URL, unwrap it first
  if (src.includes('/cdn-cgi/image/')) {
    const u = new URL(src);
    u.pathname = u.pathname.replace(/^\/cdn-cgi\/image\/[^/]+/, '');
    src = u.toString();
  }

  // Open Graph optimized settings
  const opts = [
    'width=1200',
    'height=630',
    'quality=90',
    'format=auto',
    'fit=cover',  // Cover ensures good aspect ratio for OG
    'metadata=none'
  ].join(',');

  // Return absolute URL with Cloudflare transformation
  return `${siteUrl}/cdn-cgi/image/${opts}/${src}`;
}

/**
 * Extract the original image URL from potentially Cloudflare-transformed URLs
 * This ensures Open Graph metadata always uses the original external URLs
 */
export function getOriginalImageUrl(src: string | undefined): string | undefined {
  if (!src) return undefined;

  // If it's a Cloudflare-transformed URL, extract the original
  if (src.includes('/cdn-cgi/image/')) {
    // Pattern: https://domain.com/cdn-cgi/image/params/original-url
    // We need to extract everything after the last /cdn-cgi/image/[params]/
    const match = src.match(/^(https?:\/\/[^\/]+)\/cdn-cgi\/image\/[^\/]+\/(.+)$/);
    if (match) {
      const [, domain, originalPath] = match;
      
      // If the originalPath starts with http, it's a complete URL
      if (originalPath.startsWith('http')) {
        return originalPath;
      }
      
      // Otherwise, it's a relative path that needs the domain
      return `${domain}/${originalPath}`;
    }
  }

  // If it's already an external URL, return as-is
  if (src.startsWith('http')) {
    return src;
  }

  // If it's a relative URL, it shouldn't be transformed by our loader anyway
  return src;
}
