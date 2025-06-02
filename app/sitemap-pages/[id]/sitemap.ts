import type { MetadataRoute } from 'next'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50_000

export default async function sitemap(
  { params }: { params: { id: string } }
): Promise<MetadataRoute.Sitemap> {

  const page = Number(params.id)
  const site = process.env.SITE_URL ?? 'https://focusfix.app'

  const [posts, users, lastActivity] = await Promise.all([
    fetchQuery(api.sitemap.getPostsByPage, { page, pageSize: PAGE_SIZE }),
    fetchQuery(api.sitemap.getUsersByPage, { page, pageSize: PAGE_SIZE }),
    fetchQuery(api.sitemap.getLastActivityDate, {}),
  ])

  const urls: MetadataRoute.Sitemap = []

  if (page === 0) {
    const lm = new Date(lastActivity)
    urls.push(
      { url: `${site}/`,           lastModified: lm },
      { url: `${site}/podcasts`,   lastModified: lm },
      { url: `${site}/newsletters`,lastModified: lm },
      { url: `${site}/users`,      lastModified: lm },
    )
  }

  posts.forEach(p =>
    urls.push({
      url: `${site}/${p.mediaType}s/${encodeURIComponent(p.postSlug)}`,
      lastModified: new Date(p.lastModified ?? p._creationTime),
    })
  )

  users.forEach(u =>
    u.username && urls.push({
      url: `${site}/@${encodeURIComponent(u.username)}`,
      lastModified: new Date(u.lastModified ?? u._creationTime),
    })
  )

  return urls
} 