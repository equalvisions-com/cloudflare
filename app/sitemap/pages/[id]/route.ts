import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const page = Number(id)
  const site = process.env.SITE_URL ?? 'https://focusfix.app'

  // Only serve page 0 for pages sitemap
  if (page !== 0) {
    return new Response('Not Found', { status: 404 })
  }

  const lastActivity = await fetchQuery(api.sitemap.getLastActivityDate, {})
  const lm = new Date(lastActivity).toISOString()

  const urls = [
    `<url><loc>${site}/</loc><lastmod>${lm}</lastmod></url>`,
    `<url><loc>${site}/podcasts</loc><lastmod>${lm}</lastmod></url>`,
    `<url><loc>${site}/newsletters</loc><lastmod>${lm}</lastmod></url>`,
    `<url><loc>${site}/users</loc><lastmod>${lm}</lastmod></url>`,
    `<url><loc>${site}/chat</loc><lastmod>${lm}</lastmod></url>`
  ]

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