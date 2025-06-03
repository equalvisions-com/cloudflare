import type { MetadataRoute } from 'next'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50_000

export default async function sitemapIndex(): Promise<MetadataRoute.Sitemap> {
  const { newslettersCount, podcastsCount, usersCount, staticPagesCount } =
    await fetchQuery(api.sitemap.getSitemapCounts, {})

  const siteUrl = process.env.SITE_URL ?? 'https://focusfix.app'
  const sitemaps: MetadataRoute.Sitemap = []

  // Calculate pages needed for each content type
  const newsletterPages = Math.ceil(newslettersCount / PAGE_SIZE)
  const podcastPages = Math.ceil(podcastsCount / PAGE_SIZE)
  const profilePages = Math.ceil(usersCount / PAGE_SIZE)

  // Add pages sitemap (renamed from static)
  if (staticPagesCount > 0) {
    sitemaps.push({
      url: `${siteUrl}/sitemap/pages/0`,
      lastModified: new Date(),
    })
  }

  // Add newsletter sitemaps
  for (let i = 0; i < Math.max(1, newsletterPages); i++) {
    sitemaps.push({
      url: `${siteUrl}/sitemap/newsletters/${i}`,
      lastModified: new Date(),
    })
  }

  // Add podcast sitemaps
  for (let i = 0; i < Math.max(1, podcastPages); i++) {
    sitemaps.push({
      url: `${siteUrl}/sitemap/podcasts/${i}`,
      lastModified: new Date(),
    })
  }

  // Add profile sitemaps
  for (let i = 0; i < Math.max(1, profilePages); i++) {
    sitemaps.push({
      url: `${siteUrl}/sitemap/profiles/${i}`,
      lastModified: new Date(),
    })
  }

  return sitemaps
} 