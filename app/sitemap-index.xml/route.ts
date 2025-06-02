import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const siteUrl = process.env.SITE_URL || 'https://focusfix.app';
  
  try {
    // Get the count to determine how many sitemaps we have
    const counts = await fetchQuery(api.sitemap.getSitemapCounts, {});
    const totalUrls = counts.totalCount;
    const sitemapCount = Math.ceil(totalUrls / 50000); // 50,000 is Google's limit
    
    // Generate sitemap index XML
    const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: sitemapCount }, (_, i) => 
  `  <sitemap>
    <loc>${siteUrl}/sitemap/${i}.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`
).join('\n')}
</sitemapindex>`;

    return new Response(sitemapIndexXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    
    // Return minimal sitemap index on error
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap/0.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;

    return new Response(fallbackXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300', // Shorter cache on error
      },
    });
  }
} 