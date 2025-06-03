# Sitemap Implementation

## Overview
This app implements a comprehensive sitemap system optimized for SEO with content-type-specific organization and proper XML extensions.

## Structure
```
/sitemap.xml                      # Main sitemap index
├── /sitemap/pages/0.xml         # Main navigation pages (/, /podcasts, /newsletters, /users, /chat)
├── /sitemap/newsletters/0.xml   # Newsletter posts
├── /sitemap/newsletters/1.xml   # More newsletters (if >50k)
├── /sitemap/podcasts/0.xml      # Podcast posts  
├── /sitemap/podcasts/1.xml      # More podcasts (if >50k)
├── /sitemap/profiles/0.xml      # User profiles
└── /sitemap/profiles/1.xml      # More profiles (if >50k)
```

## Benefits of Content-Type Organization
- **Better SEO**: Search engines can understand content types and crawl accordingly
- **Targeted crawling**: Different content types can have different crawl frequencies
- **Easier debugging**: Issues with specific content types are isolated
- **Performance**: Smaller, focused sitemaps load faster
- **Scalability**: Each content type can scale independently
- **Industry standard**: Proper .xml extensions for maximum compatibility

## Files

### Main Sitemap Index
- **File**: `app/sitemap.ts` (metadata route)
- **URL**: `/sitemap.xml`
- **Purpose**: Points to all content-type-specific sitemaps
- **Runtime**: Edge compatible

### Content-Type Sitemaps
- **Main Pages**: `app/sitemap/pages/[id].xml/route.ts` → `/sitemap/pages/{id}.xml`
- **Newsletters**: `app/sitemap/newsletters/[id].xml/route.ts` → `/sitemap/newsletters/{id}.xml`
- **Podcasts**: `app/sitemap/podcasts/[id].xml/route.ts` → `/sitemap/podcasts/{id}.xml`
- **Profiles**: `app/sitemap/profiles/[id].xml/route.ts` → `/sitemap/profiles/{id}.xml`

### Backend Queries
- **File**: `convex/sitemap.ts`
- **Functions**:
  - `getPostsByPage()` - Paginated posts with media type filtering
  - `getUsersByPage()` - Paginated user profiles
  - `getSitemapCounts()` - Count totals for each content type
  - `getLastActivityDate()` - Most recent activity for lastModified

## Features
- **Automatic pagination**: 50,000 URLs per sitemap
- **Content filtering**: Only public, accessible content
- **Media type separation**: Newsletters and podcasts in separate sitemaps
- **Smart lastModified**: Uses actual modification dates when available
- **URL encoding**: Proper encoding for special characters in slugs
- **Edge runtime**: Compatible with Cloudflare Pages
- **Caching**: 1-hour cache headers for performance
- **XML extensions**: Industry-standard .xml file extensions for maximum compatibility

## Content Included
- **Main pages**: Home, podcasts index, newsletters index, users index, chat
- **Newsletter posts**: `/newsletters/{slug}`
- **Podcast posts**: `/podcasts/{slug}`
- **User profiles**: `/@{username}` (only boarded, non-anonymous users)

## Content Excluded
- User-specific pages (bookmarks, alerts, settings)
- Authentication pages (signin, reset-password, onboarding)
- Anonymous or unboarded user profiles
- Draft or unverified posts

## SEO Optimization
- Content-type-specific organization for better crawling
- Proper XML structure with lastModified dates
- Industry-standard .xml file extensions
- Efficient pagination to stay under search engine limits
- Clean URLs with proper encoding
- Fast edge runtime for quick responses

## Edge Runtime Compatibility
- All sitemap functions use `export const runtime = 'edge'`
- Compatible with Cloudflare Pages deployment
- Optimized queries fetch minimal data needed for URLs

## Performance Considerations
- **Caching**: Sitemaps are cached for 1 hour
- **Minimal data**: Only fetches necessary fields (slug, creation time, etc.)
- **Parallel queries**: Posts, categories, users, and activity dates fetched in parallel
- **Error handling**: Falls back to minimal sitemap on errors
- **Smart lastModified**: Uses actual modification dates instead of current time

## Robots.txt Integration
Since you're using Cloudflare's robots.txt, make sure it includes:
```
Sitemap: https://yourdomain.com/sitemap.xml
Sitemap: https://yourdomain.com/sitemap-index.xml
```

## URL Priorities
- **Homepage**: 1.0 (highest)
- **Main sections**: 0.9 (podcasts, newsletters)
- **User pages**: 0.7 (users list)
- **Verified posts**: 0.8
- **Regular posts**: 0.7
- **User features**: 0.6 (bookmarks, chat)
- **Categories**: 0.6
- **User profiles**: 0.5
- **Notifications**: 0.5
- **Auth pages**: 0.3 (lowest)

## Change Frequencies
- **Homepage/Main sections**: daily
- **User features**: daily
- **Chat**: hourly (real-time)
- **Posts/Categories/Profiles**: weekly
- **Auth pages**: monthly

## Monitoring
The build process will show:
```
Generating X sitemaps for Y total URLs
```

Each sitemap generation logs:
```
Sitemap 0: 50000 URLs (0-50000 of 150000)
Sitemap 1: 50000 URLs (50000-100000 of 150000)
Sitemap 2: 50000 URLs (100000-150000 of 150000)
```

## Future Scaling
As your app grows to hundreds of thousands of pages:
- The system will automatically create more sitemaps
- Each sitemap stays under the 50,000 URL limit
- Search engines can efficiently crawl all your content
- No manual intervention needed
- lastModified dates help search engines prioritize fresh content 