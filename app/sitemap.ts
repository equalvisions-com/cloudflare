import type { MetadataRoute } from 'next'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

const PAGE_SIZE = 50_000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? 'https://focusfix.app'
  
  try {
    // Get counts for each content type
    const { newslettersCount, podcastsCount, usersCount } =
      await fetchQuery(api.sitemap.getSitemapCounts, {})

    // Calculate number of pages needed for each content type
    const newsletterPages = Math.ceil(newslettersCount / PAGE_SIZE)
    const podcastPages = Math.ceil(podcastsCount / PAGE_SIZE)
    const profilePages = Math.ceil(usersCount / PAGE_SIZE)

    const sitemaps: MetadataRoute.Sitemap = []

    // Always include static pages
    sitemaps.push({
      url: `${siteUrl}/sitemap/pages.xml`,
      lastModified: new Date(),
    })

    // Add newsletter sitemaps (paginated if needed)
    if (newslettersCount > 0) {
      if (newsletterPages <= 1) {
        // Single sitemap for newsletters
        sitemaps.push({
          url: `${siteUrl}/sitemap/newsletters.xml`,
          lastModified: new Date(),
        })
      } else {
        // Multiple paginated sitemaps for newsletters
        for (let i = 0; i < newsletterPages; i++) {
          sitemaps.push({
            url: `${siteUrl}/sitemap/newsletters/${i}.xml`,
            lastModified: new Date(),
          })
        }
      }
    }

    // Add podcast sitemaps (paginated if needed)
    if (podcastsCount > 0) {
      if (podcastPages <= 1) {
        // Single sitemap for podcasts
        sitemaps.push({
          url: `${siteUrl}/sitemap/podcasts.xml`,
          lastModified: new Date(),
        })
      } else {
        // Multiple paginated sitemaps for podcasts
        for (let i = 0; i < podcastPages; i++) {
          sitemaps.push({
            url: `${siteUrl}/sitemap/podcasts/${i}.xml`,
            lastModified: new Date(),
          })
        }
      }
    }

    // Add profile sitemaps (paginated if needed)
    if (usersCount > 0) {
      if (profilePages <= 1) {
        // Single sitemap for profiles
        sitemaps.push({
          url: `${siteUrl}/sitemap/profiles.xml`,
          lastModified: new Date(),
        })
      } else {
        // Multiple paginated sitemaps for profiles
        for (let i = 0; i < profilePages; i++) {
          sitemaps.push({
            url: `${siteUrl}/sitemap/profiles/${i}.xml`,
            lastModified: new Date(),
          })
        }
      }
    }

    return sitemaps

  } catch (error) {
    console.error('Error generating sitemap index:', error)
    
    // Return basic sitemaps on error
    return [
      {
        url: `${siteUrl}/sitemap/pages.xml`,
        lastModified: new Date(),
      },
      {
        url: `${siteUrl}/sitemap/newsletters.xml`,
        lastModified: new Date(),
      },
      {
        url: `${siteUrl}/sitemap/podcasts.xml`,
        lastModified: new Date(),
      },
      {
        url: `${siteUrl}/sitemap/profiles.xml`,
        lastModified: new Date(),
      },
    ]
  }
} 