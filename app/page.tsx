import { LayoutManager } from "@/components/ui/LayoutManager";
import { Metadata } from "next";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/* ----------  a. static meta ---------- */
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.SITE_URL;
  
  return {
    title: 'Discover Newsletters & Podcasts – FocusFix',
    description: 'Real-time feed of the best newsletters, podcasts and creators. No login required.',
    alternates: { canonical: `${siteUrl}/` },
    openGraph: {
      title: 'Discover Newsletters & Podcasts – FocusFix',
      description: 'Scroll a live feed of the most useful newsletters, podcasts and creators.',
      url: `${siteUrl}/`,
      type: 'website',
      images: [`${siteUrl}/og-images/home.png`]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Discover on FocusFix'
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    }
  };
}

/* ----------  b. page component ---------- */
export default function HomePage() {
  const siteUrl = process.env.SITE_URL;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteUrl}/#breadcrumbs`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${siteUrl}/`
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Discover',
            item: `${siteUrl}/#homepage`
          }
        ]
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}/`,
        url: `${siteUrl}/`,
        name: 'FocusFix – Discover Great Newsletters & Podcasts',
        description: 'Find and follow the best newsletters, podcasts, and content creators. Join thousands discovering quality content daily.',
        inLanguage: 'en',
        isPartOf: { '@id': `${siteUrl}/#website` },
        breadcrumb: { '@id': `${siteUrl}/#breadcrumbs` }
      },
      {
        '@type': 'CollectionPage',
        '@id': `${siteUrl}/#discover-feed`,
        name: 'Discover Feed',
        mainEntity: {
          '@type': 'Thing',
          name: 'Trending newsletters and podcasts'
        },
        description: 'Continuously updated stream of featured content curated by FocusFix.'
      }
    ]
  });

  return (
    <>
      <script
        id="homepage-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* Existing layout – keeps lazy loading for the feed */}
      <LayoutManager />
    </>
  );
}
