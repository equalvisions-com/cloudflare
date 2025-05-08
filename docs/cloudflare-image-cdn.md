# Cloudflare Image CDN Setup

This project uses Cloudflare as a CDN for image optimization and delivery. The setup provides:

- 12-month edge caching of all images
- Automatic format negotiation (AVIF/WebP/JPEG/PNG)
- EXIF metadata stripping
- Resizing and optimization
- Support for both local and external images

## Prerequisites

1. **Cloudflare Account and Zone**
   - The site must be proxied (orange-cloud) through Cloudflare

2. **Images Transformations Enabled**
   - Dashboard → Images → Transformations → Enable for zone
   - This enables the `/cdn-cgi/image/...` endpoint

3. **(Optional) R2 Bucket**
   - For storing images directly on Cloudflare's storage

## Cloudflare Configuration

### 1. Create a Cache Rule

In Cloudflare Dashboard:
1. Go to **Caching** → **Cache Rules** → **Create rule**
2. Set:
   - **When incoming requests match**: URI Path starts with "/cdn-cgi/image/"
   - **Then...**: Edge cache TTL → Override → 12 months

This ensures every image (original and resized variants) stays in Cloudflare's edge cache for 12 months.

### 2. (Optional) Set "immutable" Header for R2 Objects

If storing images in Cloudflare R2:

```bash
wrangler r2 object put my-bucket/image.jpg \
  --file ./image.jpg \
  --metadata '{"Cache-Control":"public, max-age=31536000, immutable"}'
```

## Usage in Components

The setup is already integrated with Next.js Image component. Use it normally:

```tsx
import Image from 'next/image';

export default function MyComponent() {
  return (
    <Image
      src="https://example.com/image.jpg" // Works with external URLs
      // or src="/local-image.jpg" for local images
      alt="Description"
      width={800}
      height={600}
      priority // optional
    />
  );
}
```

## How It Works

1. The custom loader in `lib/cloudflare-loader.ts` transforms image URLs to the Cloudflare format
2. At runtime, a URL like `/local-image.jpg` becomes:
   ```
   /cdn-cgi/image/width=800,quality=75,format=auto,metadata=none/local-image.jpg
   ```
3. Cloudflare fetches, optimizes, and caches the image at the edge

## Updating & Invalidating Images

To update cached images:
- **URL versioning**: Append `?v=2` to the image src
- **Rename the file**: Use a new filename (e.g., `hero_v2.jpg`)
- **Purge original**: Purging the original URL via Cloudflare's cache-purge API also clears all derived variants

## Security & Cost Considerations

- **Limit large images**: Add a Transformations limit in the dashboard (Images → Settings)
- **Free plan quota**: 5,000 unique transformations/month; cached variants are free
- **CSP**: Add `img-src https://<your-zone> https:` to your Content-Security-Policy 