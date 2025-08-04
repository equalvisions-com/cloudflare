import type { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const siteUrl = process.env.SITE_URL ?? 'https://focusfix.app'
  
  try {
    // Get all user profiles
    const profiles = await fetchQuery(api.sitemap.getUsersByPage, {
      page: 0,
      pageSize: 50000 // Google's limit
    })

    const urls = profiles.map(user => 
      `<url><loc>${siteUrl}/@${encodeURIComponent(user.username as string)}</loc><lastmod>${new Date(user.lastModified).toISOString()}</lastmod><priority>0.6</priority></url>`
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
    console.error('Error generating profiles sitemap:', error)
    
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