import type { NextRequest } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const siteUrl = process.env.SITE_URL ?? 'https://focusfix.app'
  
  const staticPages = [
    { url: `${siteUrl}/`, lastModified: new Date().toISOString(), priority: '1.0' },
    { url: `${siteUrl}/podcasts`, lastModified: new Date().toISOString(), priority: '0.8' },
    { url: `${siteUrl}/newsletters`, lastModified: new Date().toISOString(), priority: '0.8' },
    { url: `${siteUrl}/users`, lastModified: new Date().toISOString(), priority: '0.5' },
    { url: `${siteUrl}/chat`, lastModified: new Date().toISOString(), priority: '0.5' },
  ]

  const urls = staticPages.map(page => 
    `<url><loc>${page.url}</loc><lastmod>${page.lastModified}</lastmod><priority>${page.priority}</priority></url>`
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
} 