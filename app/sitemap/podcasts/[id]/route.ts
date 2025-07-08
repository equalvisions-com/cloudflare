import type { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50_000

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const siteUrl = process.env.SITE_URL ?? 'https://focusfix.app'
  const pageId = parseInt(params.id)

  if (isNaN(pageId) || pageId < 0) {
    return new Response('Invalid page ID', { status: 400 })
  }

  try {
    // Get podcast posts for this specific page
    const podcasts = await fetchQuery(api.sitemap.getPostsByPage, {
      page: pageId,
      pageSize: PAGE_SIZE,
      mediaType: 'podcast'
    })

    const urls = podcasts.map(post => 
      `<url><loc>${siteUrl}/podcasts/${encodeURIComponent(post.postSlug)}</loc><lastmod>${new Date(post.lastModified).toISOString()}</lastmod><priority>0.7</priority></url>`
    ).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Error generating podcasts sitemap:', error)
    
    // Return empty sitemap on error
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  }
} 