import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50_000

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const page = Number(id)
  const site = process.env.SITE_URL ?? 'https://focusfix.app'

  const [posts, users, lastActivity] = await Promise.all([
    fetchQuery(api.sitemap.getPostsByPage, { page, pageSize: PAGE_SIZE }),
    fetchQuery(api.sitemap.getUsersByPage, { page, pageSize: PAGE_SIZE }),
    fetchQuery(api.sitemap.getLastActivityDate, {}),
  ])

  const urls: string[] = []

  // Add static pages only on the first sitemap (id: 0)
  if (page === 0) {
    const lm = new Date(lastActivity).toISOString()
    urls.push(
      `<url><loc>${site}/</loc><lastmod>${lm}</lastmod></url>`,
      `<url><loc>${site}/podcasts</loc><lastmod>${lm}</lastmod></url>`,
      `<url><loc>${site}/newsletters</loc><lastmod>${lm}</lastmod></url>`,
      `<url><loc>${site}/users</loc><lastmod>${lm}</lastmod></url>`
    )
  }

  // Add posts
  posts.forEach(p => {
    const lastmod = new Date(p.lastModified ?? p._creationTime).toISOString()
    urls.push(
      `<url><loc>${site}/${p.mediaType}s/${encodeURIComponent(p.postSlug)}</loc><lastmod>${lastmod}</lastmod></url>`
    )
  })

  // Add user profiles
  users.forEach(u => {
    if (u.username) {
      const lastmod = new Date(u.lastModified ?? u._creationTime).toISOString()
      urls.push(
        `<url><loc>${site}/@${encodeURIComponent(u.username)}</loc><lastmod>${lastmod}</lastmod></url>`
      )
    }
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
} 