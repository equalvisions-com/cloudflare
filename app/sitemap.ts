import type { MetadataRoute } from 'next'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50_000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // count rows without pulling them into memory
  const { postsCount, usersCount, staticPagesCount } =
    await fetchQuery(api.sitemap.getSitemapCounts, {})

  const total = postsCount + usersCount + staticPagesCount
  const pages = Math.ceil(total / PAGE_SIZE)
  const siteUrl = process.env.SITE_URL || 'https://focusfix.app'

  // Return sitemap index entries pointing to our dynamic sitemap pages
  return Array.from({ length: pages }, (_, i) => ({
    url: `${siteUrl}/sitemap-pages/${i}/sitemap.xml`,
    lastModified: new Date(),
  }))
} 