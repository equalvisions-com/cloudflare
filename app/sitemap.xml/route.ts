import type { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50_000

export async function GET(request: NextRequest) {
  const siteUrl = process.env.SITE_URL ?? 'https://focusfix.app'
  
  try {
    // Get counts for each content type
    const { newslettersCount, podcastsCount, usersCount } =
      await fetchQuery(api.sitemap.getSitemapCounts, {})

    // Calculate number of pages needed for each content type
    const newsletterPages = Math.ceil(newslettersCount / PAGE_SIZE)
    const podcastPages = Math.ceil(podcastsCount / PAGE_SIZE)
    const profilePages = Math.ceil(usersCount / PAGE_SIZE)

    const sitemaps: string[] = []
    const lastModified = new Date().toISOString()

    // Always include static pages
    sitemaps.push(`<sitemap><loc>${siteUrl}/sitemap/pages.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`)

    // Add newsletter sitemaps (paginated if needed)
    if (newslettersCount > 0) {
      if (newsletterPages <= 1) {
        // Single sitemap for newsletters
        sitemaps.push(`<sitemap><loc>${siteUrl}/sitemap/newsletters.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`)
      } else {
        // Multiple paginated sitemaps for newsletters
        for (let i = 0; i < newsletterPages; i++) {
          sitemaps.push(`<sitemap><loc>${siteUrl}/sitemap/newsletters/${i}.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`)
        }
      }
    }

    // Add podcast sitemaps (paginated if needed)
    if (podcastsCount > 0) {
      if (podcastPages <= 1) {
        // Single sitemap for podcasts
        sitemaps.push(`<sitemap><loc>${siteUrl}/sitemap/podcasts.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`)
      } else {
        // Multiple paginated sitemaps for podcasts
        for (let i = 0; i < podcastPages; i++) {
          sitemaps.push(`<sitemap><loc>${siteUrl}/sitemap/podcasts/${i}.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`)
        }
      }
    }

    // Add profile sitemaps (paginated if needed)
    if (usersCount > 0) {
      if (profilePages <= 1) {
        // Single sitemap for profiles
        sitemaps.push(`<sitemap><loc>${siteUrl}/sitemap/profiles.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`)
      } else {
        // Multiple paginated sitemaps for profiles
        for (let i = 0; i < profilePages; i++) {
          sitemaps.push(`<sitemap><loc>${siteUrl}/sitemap/profiles/${i}.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`)
        }
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('\n')}
</sitemapindex>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })

  } catch (error) {
    console.error('Error generating sitemap index:', error)
    
    // Return basic sitemap index on error
    const lastModified = new Date().toISOString()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>${siteUrl}/sitemap/pages.xml</loc><lastmod>${lastModified}</lastmod></sitemap>
<sitemap><loc>${siteUrl}/sitemap/newsletters.xml</loc><lastmod>${lastModified}</lastmod></sitemap>
<sitemap><loc>${siteUrl}/sitemap/podcasts.xml</loc><lastmod>${lastModified}</lastmod></sitemap>
<sitemap><loc>${siteUrl}/sitemap/profiles.xml</loc><lastmod>${lastModified}</lastmod></sitemap>
</sitemapindex>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  }
} 