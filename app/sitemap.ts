import type { MetadataRoute } from 'next'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50_000

// 1️⃣ Tell Next.js which IDs exist
export async function generateSitemaps() {
  // Fetch the total number of posts, users, and static pages
  const { postsCount, usersCount, staticPagesCount } =
    await fetchQuery(api.sitemap.getSitemapCounts, {})

  const total = postsCount + usersCount + staticPagesCount
  const pages = Math.ceil(total / PAGE_SIZE)

  // Return an array of objects with id property
  return Array.from({ length: pages }, (_, i) => ({ id: i }))
}

// 2️⃣ This becomes the "index" file at /sitemap.xml
export default async function sitemap({
  id,
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  const page = id
  const site = process.env.SITE_URL ?? 'https://focusfix.app'

  const [posts, users, lastActivity] = await Promise.all([
    fetchQuery(api.sitemap.getPostsByPage, { page, pageSize: PAGE_SIZE }),
    fetchQuery(api.sitemap.getUsersByPage, { page, pageSize: PAGE_SIZE }),
    fetchQuery(api.sitemap.getLastActivityDate, {}),
  ])

  const urls: MetadataRoute.Sitemap = []

  // Add static pages only on the first sitemap (id: 0)
  if (page === 0) {
    const lm = new Date(lastActivity)
    urls.push(
      { url: `${site}/`,           lastModified: lm },
      { url: `${site}/podcasts`,   lastModified: lm },
      { url: `${site}/newsletters`,lastModified: lm },
      { url: `${site}/users`,      lastModified: lm },
    )
  }

  // Add posts
  posts.forEach(p =>
    urls.push({
      url: `${site}/${p.mediaType}s/${encodeURIComponent(p.postSlug)}`,
      lastModified: new Date(p.lastModified ?? p._creationTime),
    })
  )

  // Add user profiles
  users.forEach(u =>
    u.username && urls.push({
      url: `${site}/@${encodeURIComponent(u.username)}`,
      lastModified: new Date(u.lastModified ?? u._creationTime),
    })
  )

  return urls
} 