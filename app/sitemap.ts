import type { MetadataRoute } from 'next'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50_000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. ask Convex how many total URLs ⇒ pages needed
  const { postsCount, usersCount, staticPagesCount } =
    await fetchQuery(api.sitemap.getSitemapCounts, {})

  const total = postsCount + usersCount + staticPagesCount
  const pages = Math.ceil(total / PAGE_SIZE)

  const siteUrl = process.env.SITE_URL ?? 'https://focusfix.app'

  // 2. build an index: one <sitemap> entry per chunk
  return Array.from({ length: pages }, (_, i) => ({
    url: `${siteUrl}/sitemap/${i}`,
    lastModified: new Date(),
  }))
} 