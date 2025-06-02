# Sitemap System

This app uses Next.js's built-in sitemap functionality with automatic pagination to handle hundreds of thousands of URLs efficiently.

## How it works

### Automatic Pagination
- **Limit**: Each sitemap is limited to 50,000 URLs (Google's limit)
- **Auto-generation**: The system automatically creates multiple sitemaps when needed
- **URLs included**: 
  - **Static pages**: home, podcasts, newsletters, signin, onboarding
  - **User pages**: users list, bookmarks, alerts, chat
  - **All podcast posts**: `/podcasts/{postSlug}`
  - **All newsletter posts**: `/newsletters/{postSlug}`
  - **Category filters**: `/podcasts?category={categorySlug}`, `/newsletters?category={categorySlug}`
  - **All user profiles**: `/@{username}`

### Smart lastModified Dates
- **Posts/Users**: Use actual creation time from database
- **Categories**: Use the most recent post in that category
- **Dynamic pages**: Use most recent activity (latest post or user)
- **Static pages**: Use fixed dates for auth/onboarding pages
- **User-specific pages**: Use current date (bookmarks, alerts, chat)

### Files Structure
```
app/
├── sitemap.ts                    # Main sitemap with auto-pagination
├── sitemap-index.xml/route.ts    # Sitemap index (lists all sitemaps)
└── convex/sitemap.ts            # Optimized queries for sitemap data
```

### Generated URLs
- **Main sitemap**: `/sitemap.xml` → redirects to `/sitemap/0.xml`
- **Individual sitemaps**: `/sitemap/0.xml`, `/sitemap/1.xml`, etc.
- **Sitemap index**: `/sitemap-index.xml` (lists all sitemaps)

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