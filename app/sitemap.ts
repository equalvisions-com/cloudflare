import type { MetadataRoute } from 'next'
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const SITEMAP_LIMIT = 50000; // Google's limit per sitemap

// Generate multiple sitemaps based on content volume
export async function generateSitemaps() {
  try {
    const counts = await fetchQuery(api.sitemap.getSitemapCounts, {});
    const totalUrls = counts.totalCount;
    
    // Calculate number of sitemaps needed
    const sitemapCount = Math.ceil(totalUrls / SITEMAP_LIMIT);
    
    console.log(`Generating ${sitemapCount} sitemaps for ${totalUrls} total URLs`);
    
    return Array.from({ length: sitemapCount }, (_, i) => ({ id: i }));
  } catch (error) {
    console.error('Error generating sitemaps:', error);
    // Return at least one sitemap on error
    return [{ id: 0 }];
  }
}

export default async function sitemap({
  id,
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL || 'https://focusfix.app';
  
  try {
    // Get all data needed for sitemap generation
    const [posts, categories, users, lastActivityTime] = await Promise.all([
      fetchQuery(api.sitemap.getAllPostsForSitemap, {}),
      fetchQuery(api.sitemap.getAllCategoriesForSitemap, {}),
      fetchQuery(api.sitemap.getAllUsersForSitemap, {}),
      fetchQuery(api.sitemap.getLastActivityDate, {}),
    ]);

    // Create all URLs
    const allUrls: MetadataRoute.Sitemap = [];
    
    // Use the most recent activity for dynamic pages
    const lastActivityDate = new Date(lastActivityTime);

    // Static pages (only in first sitemap)
    if (id === 0) {
      allUrls.push(
        // Core pages
        {
          url: `${siteUrl}/`,
          lastModified: lastActivityDate, // Use recent activity since homepage shows latest content
          changeFrequency: 'daily',
          priority: 1,
        },
        {
          url: `${siteUrl}/podcasts`,
          lastModified: lastActivityDate, // Dynamic content page
          changeFrequency: 'daily',
          priority: 0.9,
        },
        {
          url: `${siteUrl}/newsletters`,
          lastModified: lastActivityDate, // Dynamic content page
          changeFrequency: 'daily',
          priority: 0.9,
        },
        
        // User-related pages
        {
          url: `${siteUrl}/users`,
          lastModified: lastActivityDate, // Shows user list
          changeFrequency: 'daily',
          priority: 0.7,
        },
        {
          url: `${siteUrl}/bookmarks`,
          lastModified: new Date(), // User-specific, always current
          changeFrequency: 'daily',
          priority: 0.6,
        },
        {
          url: `${siteUrl}/alerts`,
          lastModified: new Date(), // User-specific notifications
          changeFrequency: 'daily',
          priority: 0.5,
        },
        {
          url: `${siteUrl}/chat`,
          lastModified: new Date(), // Real-time feature
          changeFrequency: 'hourly',
          priority: 0.6,
        },
        {
          url: `${siteUrl}/settings`,
          lastModified: new Date(), // User-specific settings
          changeFrequency: 'weekly',
          priority: 0.4,
        },
        
        // Auth and onboarding pages
        {
          url: `${siteUrl}/signin`,
          lastModified: new Date('2024-01-01'), // Static auth page
          changeFrequency: 'monthly',
          priority: 0.3,
        },
        {
          url: `${siteUrl}/onboarding`,
          lastModified: new Date('2024-01-01'), // Static onboarding
          changeFrequency: 'monthly',
          priority: 0.3,
        },
        {
          url: `${siteUrl}/reset-password`,
          lastModified: new Date('2024-01-01'), // Static auth page
          changeFrequency: 'monthly',
          priority: 0.2,
        }
      );
    }

    // Add post URLs
    posts.forEach((post) => {
      allUrls.push({
        url: `${siteUrl}/${post.mediaType}s/${post.postSlug}`,
        lastModified: new Date(post._creationTime),
        changeFrequency: 'weekly',
        priority: post.verified ? 0.8 : 0.7,
      });
    });

    // Add category URLs (these are actually filtered views of the main pages)
    // Note: Based on the code analysis, categories are client-side filtered, not separate routes
    // But we can still include them as they represent distinct content groupings
    categories.forEach((category) => {
      allUrls.push({
        url: `${siteUrl}/${category.mediaType}s?category=${category.slug}`,
        lastModified: new Date(category.lastModified),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    });

    // Add user profile URLs
    users.forEach((user) => {
      allUrls.push({
        url: `${siteUrl}/@${user.username}`,
        lastModified: new Date(user._creationTime),
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    });

    // Calculate pagination
    const startIndex = id * SITEMAP_LIMIT;
    const endIndex = startIndex + SITEMAP_LIMIT;
    
    // Return the slice for this sitemap
    const sitemapUrls = allUrls.slice(startIndex, endIndex);
    
    console.log(`Sitemap ${id}: ${sitemapUrls.length} URLs (${startIndex}-${endIndex} of ${allUrls.length})`);
    
    return sitemapUrls;
  } catch (error) {
    console.error(`Error generating sitemap ${id}:`, error);
    
    // Return minimal sitemap on error
    if (id === 0) {
      return [
        {
          url: `${siteUrl}/`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 1,
        },
        {
          url: `${siteUrl}/podcasts`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.9,
        },
        {
          url: `${siteUrl}/newsletters`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.9,
        },
      ];
    }
    
    return [];
  }
} 