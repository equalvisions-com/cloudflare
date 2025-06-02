import type { MetadataRoute } from 'next'
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50000; // Google's limit per sitemap

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const siteUrl = process.env.SITE_URL || 'https://focusfix.app';
  const page = parseInt(params.id);
  
  try {
    // Get paginated data for this specific sitemap (removed categories)
    const [posts, users, lastActivityTime] = await Promise.all([
      fetchQuery(api.sitemap.getPostsByPage, { page, pageSize: PAGE_SIZE }),
      fetchQuery(api.sitemap.getUsersByPage, { page, pageSize: PAGE_SIZE }),
      fetchQuery(api.sitemap.getLastActivityDate, {}),
    ]);

    const allUrls: Array<{
      url: string;
      lastModified: Date;
    }> = [];
    const lastActivityDate = new Date(lastActivityTime);

    // Static pages (only in first sitemap) - removed auth pages
    if (page === 0) {
      allUrls.push(
        // Core public pages only
        {
          url: `${siteUrl}/`,
          lastModified: lastActivityDate,
        },
        {
          url: `${siteUrl}/podcasts`,
          lastModified: lastActivityDate,
        },
        {
          url: `${siteUrl}/newsletters`,
          lastModified: lastActivityDate,
        },
        {
          url: `${siteUrl}/users`,
          lastModified: lastActivityDate,
        }
      );
    }

    // Add post URLs
    posts.forEach((post) => {
      allUrls.push({
        url: `${siteUrl}/${post.mediaType}s/${encodeURIComponent(post.postSlug)}`,
        lastModified: new Date(post.lastModified || post._creationTime),
      });
    });

    // Add user profile URLs
    users.forEach((user) => {
      // Ensure username exists before encoding
      if (user.username) {
        allUrls.push({
          url: `${siteUrl}/@${encodeURIComponent(user.username)}`,
          lastModified: new Date(user.lastModified || user._creationTime),
        });
      }
    });

    // Generate XML (removed changefreq/priority to save bytes)
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url.url}</loc>
    <lastmod>${url.lastModified.toISOString()}</lastmod>
  </url>`).join('\n')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error(`Error generating sitemap ${page}:`, error);
    
    // Return minimal sitemap on error
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>
</urlset>`;

    return new Response(fallbackSitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }
}